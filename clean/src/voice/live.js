const GAS_URL = 'https://script.google.com/macros/s/AKfycbxRNfeijUEwXwoFgBYbS60S5zn2fcuqHSm4TAbRePUzjTjqInXu10ZmK4cUvxoJ-dCAxw/exec';
const WS_BASE = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';

function base64ToInt16(b64) {
  const s = atob(b64);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return new Int16Array(b.buffer);
}

async function getToken(profile, signal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ taskType: 'liveToken', profile }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`token-http-${response.status}`);
    const data = await response.json();
    if (!data?.ok || !data?.token) {
      throw new Error(
        data?.error ||
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        'live-token-unavailable'
      );
    }
    return data.token;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export class LiveWs {
  constructor({ profile, setup, onMessage, onError } = {}) {
    this.profile = profile;
    this.setup = setup;
    this.onMessage = onMessage || (() => {});
    this.onError = onError || (() => {});
    this.ws = null;
    this.ready = false;
    this.controller = null;
    this.closedByClient = false;
  }

  async connect(signal) {
    if (this.ready) return true;
    this.close();

    this.closedByClient = false;
    const controller = new AbortController();
    this.controller = controller;
    const relayAbort = () => controller.abort();
    signal?.addEventListener('abort', relayAbort, { once: true });

    try {
      const token = await getToken(this.profile, controller.signal);
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');

      await new Promise((resolve, reject) => {
        const ws = new WebSocket(`${WS_BASE}?access_token=${encodeURIComponent(token)}`);
        this.ws = ws;
        let settled = false;
        const finishReject = error => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(error);
        };
        const finishResolve = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          this.ready = true;
          resolve(true);
        };
        const timer = setTimeout(() => {
          try { ws.close(); } catch (_) {}
          finishReject(new Error('live-connect-timeout'));
        }, 12000);

        const abortHandler = () => {
          try { ws.close(1000, 'aborted'); } catch (_) {}
          finishReject(new DOMException('Aborted', 'AbortError'));
        };
        controller.signal.addEventListener('abort', abortHandler, { once: true });

        ws.onopen = () => {
          if (controller.signal.aborted) {
            abortHandler();
            return;
          }
          ws.send(JSON.stringify({ setup: this.setup }));
        };
        ws.onmessage = event => {
          let message;
          try { message = JSON.parse(event.data); } catch (_) { return; }
          if (message.setupComplete) {
            finishResolve();
            return;
          }
          this.onMessage(message);
        };
        ws.onerror = () => {
          const error = new Error('live-websocket-error');
          if (!this.ready) finishReject(error);
          else this.onError(error);
        };
        ws.onclose = event => {
          const wasReady = this.ready;
          this.ready = false;
          if (!this.closedByClient && !controller.signal.aborted && event.code !== 1000) {
            const error = new Error(`live-closed-${event.code}`);
            if (!wasReady) finishReject(error);
            else this.onError(error);
          }
        };
      });
      return true;
    } finally {
      signal?.removeEventListener('abort', relayAbort);
    }
  }

  send(message) {
    if (this.ws?.readyState !== WebSocket.OPEN || !this.ready) return false;
    this.ws.send(JSON.stringify(message));
    return true;
  }

  audio(b64) {
    return this.send({
      realtimeInput: {
        audio: { data: b64, mimeType: 'audio/pcm;rate=16000' }
      }
    });
  }

  audioEnd() {
    return this.send({ realtimeInput: { audioStreamEnd: true } });
  }

  text(text) {
    return this.send({ realtimeInput: { text: String(text) } });
  }

  tool(functionResponses) {
    return this.send({ toolResponse: { functionResponses } });
  }

  close() {
    this.closedByClient = true;
    this.ready = false;
    try { this.controller?.abort(); } catch (_) {}
    this.controller = null;
    try { this.ws?.close(1000, 'client-close'); } catch (_) {}
    this.ws = null;
  }
}

export class AudioPlayer {
  constructor({ onFirst, onDrained } = {}) {
    this.onFirst = onFirst || (() => {});
    this.onDrained = onDrained || (() => {});
    this.ctx = null;
    this.next = 0;
    this.first = false;
    this.pending = 0;
    this.sources = new Set();
    this.generation = 0;
  }

  resetTurn() {
    this.first = false;
    this.next = Math.max(this.ctx?.currentTime || 0, 0);
  }

  async play(b64) {
    const generation = this.generation;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) throw new Error('audio-context-unsupported');
    if (!this.ctx) this.ctx = new AC();
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch (_) {}
    }
    if (generation !== this.generation || !this.ctx) return;

    const pcm = base64ToInt16(b64);
    const buffer = this.ctx.createBuffer(1, pcm.length, 24000);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 32768;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);
    const at = Math.max(this.ctx.currentTime + 0.012, this.next || 0);
    this.next = at + buffer.duration;

    if (!this.first) {
      this.first = true;
      this.onFirst(performance.now());
    }

    this.pending += 1;
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      this.pending = Math.max(0, this.pending - 1);
      if (!this.pending) this.onDrained();
    };
    source.start(at);
  }

  stopPlayback() {
    this.generation += 1;
    for (const source of this.sources) {
      try { source.stop(); } catch (_) {}
      try { source.disconnect(); } catch (_) {}
    }
    this.sources.clear();
    this.pending = 0;
    this.next = 0;
    this.first = false;
    try { this.ctx?.close(); } catch (_) {}
    this.ctx = null;
  }

  close() {
    this.stopPlayback();
  }
}
