import { resolveFood, defaultAmount } from '../nutrition/catalog.js';
import { MicCapture } from './capture.js';
import { LiveWs, AudioPlayer } from './live.js';

const TRANSCRIBE_MODEL = 'gemini-3.5-transcribe-live';
const CONVERSATION_MODEL = 'gemini-3.1-flash-live-preview';
const BENCH_KEY = 'tf_voice_bench_v1';
const MAX_BENCH = 120;
const SILENCE_MS = 3200;
const MAX_BUFFER_MS = 8000;
const PIPELINE_READY_TIMEOUT_MS = 9000;

const MODE_META = Object.freeze({
  voice: { code: 'A', name: '最速Live', roles: '耳・脳・口＝会話Live' },
  chat: { code: 'B', name: '専用耳Live', roles: '耳＝文字起こしLive / 脳・口＝会話Live' },
  auto: { code: 'C', name: '完全分離', roles: '耳＝文字起こしLive / 脳＝Flash Lite / 口＝会話Live' }
});

const VOCABULARY = [
  '鶏むね','鶏もも','鶏胸肉','皮なし','皮あり','白米','玄米','雑穀米','麦ご飯','オートミール','パスタ',
  '納豆','味噌汁','全卵','ゆで卵','プロテイン','砂肝','サバ','アジ','鮭','マグロ','さつまいも','じゃがいも',
  'グラム','キログラム','ミリリットル','パック','スクープ','人前','大さじ','小さじ'
];

const HYBRID_VAD = Object.freeze({
  automaticActivityDetection: {
    disabled: false,
    prefixPaddingMs: 120,
    silenceDurationMs: 4500
  }
});

let activeInstance = null;
let lifecycleInstalled = false;

const perfNow = () => performance.now();
const clean = value => String(value ?? '').trim();
const uid = () => globalThis.crypto?.randomUUID?.() || `vl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const ms = value => Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;

function currentMode() {
  return document.querySelector('.voice-mode.selected')?.dataset.mode || 'voice';
}

function readBench() {
  try {
    const rows = JSON.parse(localStorage.getItem(BENCH_KEY) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function saveBench(rows) {
  localStorage.setItem(BENCH_KEY, JSON.stringify(rows.slice(-MAX_BENCH)));
}

function pushBench(sample) {
  const rows = readBench();
  rows.push(sample);
  saveBench(rows);
  globalThis.dispatchEvent(new CustomEvent('pfc-voice-bench', { detail: sample }));
  return sample;
}

function rateLatest(accurate) {
  const rows = readBench();
  if (!rows.length) return null;
  rows[rows.length - 1].accurate = !!accurate;
  saveBench(rows);
  globalThis.dispatchEvent(new CustomEvent('pfc-voice-bench', { detail: rows[rows.length - 1] }));
  return rows[rows.length - 1];
}

function clearBench() {
  localStorage.removeItem(BENCH_KEY);
  globalThis.dispatchEvent(new CustomEvent('pfc-voice-bench', { detail: null }));
}

function normalizeMealItems(rawItems, current = []) {
  const out = [];
  const fallbackMeal = current.at(-1)?.meal || '';
  for (const raw of Array.isArray(rawItems) ? rawItems : []) {
    const requested = clean(raw?.name);
    if (!requested) continue;
    const food = resolveFood(requested);
    if (!food) {
      out.push({
        key: uid(),
        name: requested,
        foodId: null,
        amount: null,
        unit: clean(raw?.unit) || 'g',
        meal: clean(raw?.meal) || fallbackMeal,
        unresolved: true,
        needsAmount: false,
        assumed: false
      });
      continue;
    }
    const d = defaultAmount(food);
    const n = Number(raw?.amount);
    const hasAmount = Number.isFinite(n) && n > 0;
    out.push({
      key: uid(),
      name: food.name,
      foodId: food.id,
      amount: hasAmount ? n : (food.criticalAmount ? null : d.amount),
      unit: clean(raw?.unit) || d.unit,
      meal: clean(raw?.meal) || fallbackMeal,
      unresolved: false,
      needsAmount: !hasAmount && food.criticalAmount,
      assumed: !hasAmount && !food.criticalAmount
    });
  }
  return out;
}

function mealTool() {
  return {
    functionDeclarations: [{
      name: 'update_meal_memo',
      description: '食事発話を食品名・量・単位・食事区分へ構造化してアプリへ渡す。栄養値は生成しない。',
      parameters: {
        type: 'OBJECT',
        properties: {
          items: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                amount: { type: 'NUMBER' },
                unit: { type: 'STRING' },
                meal: { type: 'STRING' }
              },
              required: ['name']
            }
          },
          question: { type: 'STRING' }
        },
        required: ['items', 'question']
      }
    }]
  };
}

function transcribeSetup() {
  return {
    model: `models/${TRANSCRIBE_MODEL}`,
    generationConfig: { responseModalities: ['TEXT'] },
    realtimeInputConfig: HYBRID_VAD,
    inputAudioTranscription: {
      languageCodes: ['ja-JP'],
      mode: 'SMART',
      customVocabulary: VOCABULARY
    }
  };
}

function agentSetup() {
  return {
    model: `models/${CONVERSATION_MODEL}`,
    generationConfig: { responseModalities: ['AUDIO'], temperature: 0.1 },
    realtimeInputConfig: HYBRID_VAD,
    systemInstruction: {
      parts: [{
        text: 'あなたは、たまフィットPFCの食事記録用Liveエージェントです。ユーザーの食事発話を理解したら必ず update_meal_memo を呼び出してください。栄養値やカロリーは推測しません。食品名・量・単位・食事区分だけを返します。肉・魚・米・パスタ・オートミールなど量依存食品で量が不明なら最小限の質問を作ってください。納豆・味噌汁・卵など明白な単位食品は標準1単位で構いません。ツール応答後、質問があれば質問だけ、なければ「記録候補を作りました」とだけ短く話してください。'
      }]
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    tools: [mealTool()]
  };
}

function mouthSetup() {
  return {
    model: `models/${CONVERSATION_MODEL}`,
    generationConfig: { responseModalities: ['AUDIO'], temperature: 0 },
    systemInstruction: {
      parts: [{
        text: 'あなたは読み上げ専用です。受け取った日本語を意味を変えず短く自然に読み上げてください。内容を追加しないでください。'
      }]
    },
    outputAudioTranscription: {}
  };
}

class Profile {
  constructor(mode) {
    this.id = uid();
    this.mode = mode;
    this.t = { created: perfNow() };
    this.transcript = '';
    this.done = false;
  }

  mark(key, t = perfNow()) {
    if (key === 'speechEnd') {
      this.t[key] = t;
      return;
    }
    if (!Number.isFinite(this.t[key])) this.t[key] = t;
  }

  voice(t) {
    if (!Number.isFinite(this.t.speechStart)) this.t.speechStart = t;
    this.t.speechEnd = t;
  }

  finish(ok = true, error = null) {
    if (this.done) return null;
    this.done = true;
    const t = this.t;
    const end = t.speechEnd || t.micStop || t.transcriptFinal || t.created;
    const sample = {
      id: this.id,
      at: new Date().toISOString(),
      mode: this.mode,
      ok,
      error: error ? String(error) : null,
      transcript: this.transcript,
      metrics: {
        micStartMs: ms(Number.isFinite(t.micStarted) ? t.micStarted - t.created : NaN),
        pipelineReadyMs: ms(Number.isFinite(t.connectDone) ? t.connectDone - t.created : NaN),
        connectMs: ms(
          Number.isFinite(t.connectStart) && Number.isFinite(t.connectDone)
            ? t.connectDone - t.connectStart
            : NaN
        ),
        transcriptMs: ms(
          Number.isFinite(t.transcriptFinal) ? t.transcriptFinal - end : NaN
        ),
        brainMs: ms(
          Number.isFinite(t.brainStart) && Number.isFinite(t.brainDone)
            ? t.brainDone - t.brainStart
            : NaN
        ),
        mouthMs: ms(
          Number.isFinite(t.mouthStart) && Number.isFinite(t.firstAudio)
            ? t.firstAudio - t.mouthStart
            : NaN
        ),
        responseMs: ms(
          Number.isFinite(t.firstAudio)
            ? t.firstAudio - end
            : (Number.isFinite(t.memoReady) ? t.memoReady - end : NaN)
        ),
        totalMs: ms(
          (t.turnDone || t.firstAudio || t.memoReady || perfNow()) -
          (t.speechStart || t.created)
        )
      }
    };
    return pushBench(sample);
  }
}

function installLifecycle() {
  if (lifecycleInstalled) return;
  lifecycleInstalled = true;

  document.addEventListener('click', event => {
    const modeButton = event.target.closest?.('.voice-mode[data-mode]');
    if (modeButton && activeInstance) {
      activeInstance.selectMode(modeButton.dataset.mode);
      return;
    }
    if (event.target.closest?.('[data-view]')) {
      activeInstance?.stop(true, false);
    }
  }, true);

  globalThis.addEventListener('pagehide', () => {
    activeInstance?.stop(true, false);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) activeInstance?.stop(true, false);
  });
}

export class VoiceInput {
  constructor({ onText, onInterim, onState, onError, onUtterance, silenceMs = SILENCE_MS } = {}) {
    this.onText = onText || (() => {});
    this.onInterim = onInterim || (() => {});
    this.onState = onState || (() => {});
    this.onError = onError || (() => {});
    this.onUtterance = onUtterance || (() => {});
    this.silenceMs = silenceMs;

    this.active = false;
    this.processing = false;
    this.mode = 'voice';
    this.transcript = '';
    this.interim = '';

    this.transcribe = null;
    this.conversation = null;
    this.convKind = '';
    this.mic = null;
    this.player = new AudioPlayer({
      onFirst: t => this._firstAudio(t),
      onDrained: () => this._audioDrained()
    });

    this.profile = null;
    this.liveResult = null;
    this.emitted = false;
    this.pendingSpeakEnd = null;
    this.serverTurnComplete = false;
    this.transcriptHandled = false;

    this.generation = 1;
    this.turnId = 0;
    this.preparePromise = null;
    this.prepareController = null;
    this.startPromise = null;
    this.pipelineReady = false;
    this.pipelineTimeout = null;
    this.flushTimer = null;
    this.audioQueue = [];
    this.audioQueueMs = 0;
    this.pendingAudioEnd = false;

    activeInstance = this;
    installLifecycle();
    this._installBridge();
  }

  _installBridge() {
    const self = this;
    globalThis.__PFC_VOICE_LAB__ = {
      consumeLiveResult(mode) {
        if (!self.liveResult || self.liveResult.mode !== mode) return null;
        const result = self.liveResult;
        self.liveResult = null;
        return result;
      },
      brainStart() {
        self.profile?.mark('brainStart');
      },
      brainDone(result) {
        self.profile?.mark('brainDone');
        self.profile?.mark('memoReady');
        if (!clean(result?.question)) self._speakC('記録候補を作りました', null);
      },
      brainError(error) {
        self._turnError(error);
      },
      rateLatest,
      clearBench,
      modeMeta: MODE_META,
      benchKey: BENCH_KEY
    };
  }

  supported() {
    return !!(
      navigator.mediaDevices?.getUserMedia &&
      globalThis.WebSocket &&
      (globalThis.AudioContext || globalThis.webkitAudioContext)
    );
  }

  getText() {
    return clean(this.transcript || this.interim);
  }

  resetBuffer() {
    this.transcript = '';
    this.interim = '';
  }

  _emitPipelineState(state) {
    globalThis.dispatchEvent(new CustomEvent('pfc-voice-pipeline', {
      detail: { state, mode: this.mode }
    }));
  }

  _isCurrent(generation, turnId = null) {
    return generation === this.generation && (turnId == null || turnId === this.turnId);
  }

  _ready(mode = this.mode) {
    if (mode === 'voice') return !!this.conversation?.ready;
    return !!this.transcribe?.ready && !!this.conversation?.ready;
  }

  _closeSockets() {
    this.prepareController?.abort();
    this.prepareController = null;
    this.transcribe?.close();
    this.conversation?.close();
    this.transcribe = null;
    this.conversation = null;
    this.convKind = '';
    this.pipelineReady = false;
    this._emitPipelineState('disconnected');
  }

  async _connect(profile, setup, kind, generation, signal) {
    const socket = new LiveWs({
      profile,
      setup,
      onMessage: message => {
        if (!this._isCurrent(generation)) return;
        if (kind === 'transcribe') this._onTranscribe(message);
        else this._onConversation(message, kind);
      },
      onError: error => {
        if (this._isCurrent(generation)) this._socketError(error);
      }
    });
    await socket.connect(signal);
    if (!this._isCurrent(generation)) {
      socket.close();
      throw new DOMException('Aborted', 'AbortError');
    }
    return socket;
  }

  async _prepare(mode, generation) {
    if (!this._isCurrent(generation)) return false;

    if (this.mode === mode && this._ready(mode)) {
      this.pipelineReady = true;
      this.profile?.mark('connectStart');
      this.profile?.mark('connectDone');
      this._emitPipelineState('ready');
      return true;
    }

    this._closeSockets();
    if (!this._isCurrent(generation)) return false;

    this.mode = mode;
    this.pipelineReady = false;
    this.profile?.mark('connectStart');
    this._emitPipelineState('connecting');

    const controller = new AbortController();
    this.prepareController = controller;

    const run = (async () => {
      if (mode === 'voice') {
        const conversation = await this._connect(
          'conversation',
          agentSetup(),
          'agent',
          generation,
          controller.signal
        );
        if (!this._isCurrent(generation)) {
          conversation.close();
          return false;
        }
        this.conversation = conversation;
      } else {
        const convSetup = mode === 'chat' ? agentSetup() : mouthSetup();
        const [transcribe, conversation] = await Promise.all([
          this._connect(
            'transcribe',
            transcribeSetup(),
            'transcribe',
            generation,
            controller.signal
          ),
          this._connect(
            'conversation',
            convSetup,
            mode === 'chat' ? 'agent' : 'mouth',
            generation,
            controller.signal
          )
        ]);
        if (!this._isCurrent(generation)) {
          transcribe.close();
          conversation.close();
          return false;
        }
        this.transcribe = transcribe;
        this.conversation = conversation;
        this.convKind = mode === 'chat' ? 'agent' : 'mouth';
      }

      this.pipelineReady = true;
      this.profile?.mark('connectDone');
      this._emitPipelineState('ready');
      this._flushQueuedAudio();
      return true;
    })();

    this.preparePromise = run;
    try {
      return await run;
    } finally {
      if (this.preparePromise === run) this.preparePromise = null;
      if (this.prepareController === controller) this.prepareController = null;
    }
  }

  _audioTarget() {
    return this.mode === 'voice' ? this.conversation : this.transcribe;
  }

  _queueAudio(chunk) {
    this.audioQueue.push(chunk.b64);
    this.audioQueueMs += Number(chunk.durationMs) || 0;
    if (this.audioQueueMs > MAX_BUFFER_MS) {
      this._turnError(new Error('pipeline-connect-too-slow'));
    }
  }

  _pushAudio(chunk, generation, turnId) {
    if (!this._isCurrent(generation, turnId) || !this.active) return;
    const target = this._audioTarget();
    if (this.pipelineReady && target?.ready) {
      target.audio(chunk.b64);
    } else {
      this._queueAudio(chunk);
    }
  }

  _flushQueuedAudio() {
    if (!this.pipelineReady) return;
    const target = this._audioTarget();
    if (!target?.ready) return;

    for (const b64 of this.audioQueue) target.audio(b64);
    this.audioQueue = [];
    this.audioQueueMs = 0;

    if (this.pendingAudioEnd) {
      this.pendingAudioEnd = false;
      target.audioEnd();
      if (this.mode !== 'voice') this._maybeHandleTranscribed();
    }
  }

  _armPipelineTimeout(generation, turnId) {
    clearTimeout(this.pipelineTimeout);
    this.pipelineTimeout = setTimeout(() => {
      if (!this._isCurrent(generation, turnId) || this.pipelineReady) return;
      this._turnError(new Error('pipeline-connect-timeout'));
    }, PIPELINE_READY_TIMEOUT_MS);
  }

  async start({ clear = true } = {}) {
    if (!this.supported()) {
      this.onError('unsupported');
      return false;
    }
    if (this.active) return true;
    if (this.startPromise) return this.startPromise;

    const requestedMode = currentMode();
    if (requestedMode !== this.mode && (this.transcribe || this.conversation || this.preparePromise)) {
      this.selectMode(requestedMode);
    }
    this.mode = requestedMode;

    if (clear) this.resetBuffer();
    this.processing = false;
    this.liveResult = null;
    this.emitted = false;
    this.pendingSpeakEnd = null;
    this.serverTurnComplete = false;
    this.transcriptHandled = false;
    this.pendingAudioEnd = false;
    this.audioQueue = [];
    this.audioQueueMs = 0;
    this.player.resetTurn();

    const generation = this.generation;
    const turnId = ++this.turnId;
    this.profile = new Profile(this.mode);

    const mic = new MicCapture({
      silenceMs: this.silenceMs,
      onChunk: chunk => this._pushAudio(chunk, generation, turnId),
      onVoice: t => {
        if (this._isCurrent(generation, turnId)) this.profile?.voice(t);
      },
      onSilence: () => {
        if (this._isCurrent(generation, turnId) && this.active) this.commitNow('silence');
      },
      onStarted: t => {
        if (!this._isCurrent(generation, turnId)) return;
        this.profile?.mark('micStarted', t);
        this.onState('listening');
      },
      onError: error => {
        if (this._isCurrent(generation, turnId)) this._turnError(error);
      }
    });
    this.mic = mic;
    this.active = true;

    const micPromise = mic.start();
    const preparePromise = this._prepare(this.mode, generation)
      .then(ok => {
        if (!ok || !this._isCurrent(generation, turnId)) return false;
        clearTimeout(this.pipelineTimeout);
        this._flushQueuedAudio();
        return true;
      })
      .catch(error => {
        if (this._isCurrent(generation, turnId) && error?.name !== 'AbortError') {
          this._turnError(error);
        }
        return false;
      });

    this._armPipelineTimeout(generation, turnId);

    const startPromise = (async () => {
      try {
        const ok = await micPromise;
        if (!ok || !this._isCurrent(generation, turnId)) {
          mic.stop();
          return false;
        }
        void preparePromise;
        return true;
      } catch (error) {
        if (this._isCurrent(generation, turnId) && error?.name !== 'AbortError') {
          this._turnError(error);
        }
        return false;
      } finally {
        if (this.startPromise === startPromise) this.startPromise = null;
      }
    })();

    this.startPromise = startPromise;
    return startPromise;
  }

  commitNow(reason = 'manual') {
    if (!this.active) return this.getText();
    if (!this.mic?.active) {
      this.stop(true, true);
      return '';
    }

    this.profile?.mark('micStop');
    this.mic?.stop();
    this.mic = null;
    this.active = false;
    this.processing = true;
    this.pendingAudioEnd = true;
    clearTimeout(this.pipelineTimeout);

    if (this.pipelineReady) this._flushQueuedAudio();
    this.onState('processing');

    if (this.mode !== 'voice') this._maybeHandleTranscribed();
    return reason || this.getText();
  }

  _maybeHandleTranscribed() {
    if (this.active || this.transcriptHandled || !this.transcript) return;

    this.transcriptHandled = true;
    const text = this.transcript;

    if (this.mode === 'chat') {
      this.profile?.mark('brainStart');
      this.serverTurnComplete = false;
      this.conversation?.text(text);
      this.onState('processing');
    } else if (this.mode === 'auto') {
      this.profile?.mark('brainStart');
      this.processing = true;
      this.onState('processing');
      queueMicrotask(() => this.onUtterance(text, 'transcribe-live'));
    }
  }

  _onTranscribe(message) {
    const content = message.serverContent;
    if (content?.interimInputTranscription?.text) {
      this.interim = clean(content.interimInputTranscription.text);
      this.onInterim(this.interim, this.transcript);
    }

    if (content?.inputTranscription?.text) {
      const text = clean(content.inputTranscription.text);
      if (!text) return;
      this.transcript = text;
      this.interim = '';
      if (this.profile) {
        this.profile.transcript = text;
        this.profile.mark('transcriptFinal');
      }
      this.onText(text, text);
      this._maybeHandleTranscribed();
    }
  }

  _onConversation(message, kind) {
    const profile = this.profile;
    const content = message.serverContent;

    if (this.mode === 'voice' && content?.inputTranscription?.text) {
      const text = clean(content.inputTranscription.text);
      if (text) {
        this.transcript = text;
        if (profile) {
          profile.transcript = text;
          profile.mark('transcriptFinal');
          profile.mark('brainStart');
        }
        this.onText(text, text);
        this._maybeEmitLive();
      }
    }

    if (message.toolCall?.functionCalls?.length && kind === 'agent') {
      profile?.mark('brainDone');
      let items = [];
      let question = '';
      const responses = [];

      for (const call of message.toolCall.functionCalls) {
        if (call.name === 'update_meal_memo') {
          items = normalizeMealItems(call.args?.items, []);
          question = clean(call.args?.question);
          if (!question && items.some(item => item.needsAmount)) {
            question = '量が必要な食品は何グラムでしたか？';
          }
          responses.push({
            name: call.name,
            id: call.id,
            response: {
              result: {
                accepted: true,
                ready: items.length > 0 && !items.some(item => item.unresolved || item.needsAmount),
                question
              }
            }
          });
        } else {
          responses.push({
            name: call.name,
            id: call.id,
            response: { result: { accepted: false } }
          });
        }
      }

      this.liveResult = { mode: this.mode, items, question };
      if (question && this.mode === 'voice') {
        const followGeneration = this.generation;
        this.pendingSpeakEnd = () => {
          if (this.generation === followGeneration && !document.hidden) {
            this.start({ clear: true });
          }
        };
      }

      profile?.mark('memoReady');
      profile?.mark('mouthStart');
      this.conversation?.tool(responses);
      this._maybeEmitLive();
    }

    if (content?.modelTurn?.parts) {
      for (const part of content.modelTurn.parts) {
        if (part.inlineData?.data) {
          this.onState('processing');
          this.player.play(part.inlineData.data).catch(error => this._turnError(error));
        }
      }
    }

    if (content?.turnComplete) {
      this.serverTurnComplete = true;
      profile?.mark('turnDone');
      this._finishBench(true);
      this._flushPendingSpeakEnd();
    }
  }

  _maybeEmitLive() {
    if (this.emitted || !this.liveResult) return;
    const text = clean(this.transcript);
    if (!text && this.mode === 'voice') return;
    this.emitted = true;
    this.processing = true;
    queueMicrotask(() => this.onUtterance(text || 'Live音声入力', 'conversation-live'));
  }

  _firstAudio(t) {
    this.profile?.mark('firstAudio', t);
  }

  _audioDrained() {
    this._flushPendingSpeakEnd();
  }

  _flushPendingSpeakEnd() {
    clearTimeout(this.flushTimer);
    if (!this.serverTurnComplete || this.player.pending > 0) return;
    if (this.processing) {
      this.flushTimer = setTimeout(() => this._flushPendingSpeakEnd(), 40);
      return;
    }

    const callback = this.pendingSpeakEnd;
    this.pendingSpeakEnd = null;
    this.serverTurnComplete = false;
    if (callback) {
      this.flushTimer = setTimeout(callback, 0);
    } else if (!this.active) {
      this.onState('ready');
    }
  }

  _finishBench(ok, error = null) {
    const sample = this.profile?.finish(ok, error);
    if (sample) this.profile = null;
  }

  _turnError(error) {
    console.warn('[Voice Lab]', error);

    this.mic?.stop();
    this.mic = null;
    this.active = false;
    this.processing = false;
    this.pendingSpeakEnd = null;
    this.serverTurnComplete = false;
    this.pendingAudioEnd = false;
    this.audioQueue = [];
    this.audioQueueMs = 0;
    clearTimeout(this.pipelineTimeout);
    clearTimeout(this.flushTimer);
    this.startPromise = null;

    this._finishBench(false, error?.message || error);
    this.generation += 1;
    this.turnId += 1;
    this._closeSockets();
    this.player.stopPlayback();

    this.onState('idle');
    const code = error?.name === 'NotAllowedError'
      ? 'permission-denied'
      : (error?.message || String(error));
    this.onError(code);
  }

  _socketError(error) {
    console.warn('[Voice Lab socket]', error);
    if (this.profile) this._turnError(error);
    else this.onError(error?.message || String(error));
  }

  finishProcessing() {
    this.processing = false;
    this._flushPendingSpeakEnd();
  }

  async _speakC(text, onEnd) {
    if (this.mode !== 'auto') {
      onEnd?.();
      return;
    }

    const generation = this.generation;
    try {
      if (!this._ready('auto')) await this._prepare('auto', generation);
      if (!this._isCurrent(generation)) return;
      this.serverTurnComplete = false;
      this.player.resetTurn();
      this.profile?.mark('mouthStart');
      this.pendingSpeakEnd = onEnd || this.pendingSpeakEnd;
      this.conversation?.text(text);
    } catch (error) {
      if (this._isCurrent(generation)) this._turnError(error);
      onEnd?.();
    }
  }

  speak(text, onEnd) {
    if (!text) {
      onEnd?.();
      return;
    }
    if (this.mode === 'chat') {
      this.pendingSpeakEnd = onEnd || this.pendingSpeakEnd;
      this._flushPendingSpeakEnd();
      return;
    }
    if (this.mode === 'auto') {
      this._speakC(text, onEnd);
      return;
    }
    onEnd?.();
  }

  selectMode(mode) {
    if (!MODE_META[mode]) return;
    if (mode === this.mode && !this.active && !this.processing) return;
    this.stop(true, true);
    this.mode = mode;
  }

  stop(manual = true, emitState = true) {
    this.generation += 1;
    this.turnId += 1;

    clearTimeout(this.pipelineTimeout);
    clearTimeout(this.flushTimer);
    this.pipelineTimeout = null;
    this.flushTimer = null;

    this.prepareController?.abort();
    this.prepareController = null;
    this.preparePromise = null;
    this.startPromise = null;

    this.mic?.stop();
    this.mic = null;
    this.active = false;
    this.processing = false;

    this.pendingSpeakEnd = null;
    this.serverTurnComplete = false;
    this.transcriptHandled = false;
    this.pendingAudioEnd = false;
    this.audioQueue = [];
    this.audioQueueMs = 0;

    this.profile = null;
    this.liveResult = null;
    this.emitted = false;

    this._closeSockets();
    this.player.close();

    if (emitState) this.onState('idle');
  }

  close() {
    this.stop(true, true);
  }
}

export function speak(text, onEnd) {
  if (activeInstance) {
    activeInstance.speak(String(text || ''), onEnd);
    return;
  }
  onEnd?.();
}

export const VOICE_INFO = Object.freeze({
  capture: 'shared PCM16 capture',
  silenceMs: SILENCE_MS,
  modes: MODE_META,
  transcribeModel: TRANSCRIBE_MODEL,
  conversationModel: CONVERSATION_MODEL
});
