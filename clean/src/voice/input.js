export class VoiceInput {
  constructor({ onText, onInterim, onState, onError, onUtterance, silenceMs = 3200 } = {}) {
    this.onText = onText || (() => {});
    this.onInterim = onInterim || (() => {});
    this.onState = onState || (() => {});
    this.onError = onError || (() => {});
    this.onUtterance = onUtterance || (() => {});
    this.silenceMs = silenceMs;
    this.Recognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    this.recognition = null;
    this.active = false;
    this.manualStop = false;
    this.processing = false;
    this.finalBuffer = '';
    this.interimBuffer = '';
    this.restartTimer = null;
    this.silenceTimer = null;
    this.maxAutoRestarts = 6;
    this.restartCount = 0;
    this.session = 0;
  }

  supported() { return !!this.Recognition; }
  getText() { return [this.finalBuffer, this.interimBuffer].filter(Boolean).join(' ').trim(); }
  resetBuffer() { this.finalBuffer = ''; this.interimBuffer = ''; }

  _clearTimers() {
    clearTimeout(this.restartTimer);
    clearTimeout(this.silenceTimer);
  }

  _scheduleCommit() {
    clearTimeout(this.silenceTimer);
    if (!this.active || this.processing || !this.getText()) return;
    this.silenceTimer = setTimeout(() => this.commitNow('silence'), this.silenceMs);
  }

  _build(session) {
    const r = new this.Recognition();
    r.lang = 'ja-JP';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onstart = () => {
      if (session !== this.session) return;
      this.onState('listening');
    };

    r.onresult = event => {
      if (session !== this.session || this.processing) return;
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = String(event.results[i][0]?.transcript || '').trim();
        if (!chunk) continue;
        if (event.results[i].isFinal) {
          this.finalBuffer += (this.finalBuffer ? ' ' : '') + chunk;
          this.interimBuffer = '';
          this.onText(chunk, this.finalBuffer.trim());
        } else {
          interim += (interim ? ' ' : '') + chunk;
        }
      }
      this.interimBuffer = interim.trim();
      this.onInterim(this.interimBuffer, this.finalBuffer.trim());
      this._scheduleCommit();
    };

    r.onerror = event => {
      if (session !== this.session) return;
      const code = String(event.error || 'unknown');
      if (code === 'aborted') return;
      if (code === 'no-speech') {
        this._scheduleCommit();
        return;
      }
      this.onError(code);
    };

    r.onend = () => {
      if (session !== this.session || this.processing) return;
      if (!this.active || this.manualStop) {
        this.onState('idle');
        return;
      }
      if (this.restartCount >= this.maxAutoRestarts) {
        if (this.getText()) { this.commitNow('recognition-end'); return; }
        this.active = false;
        this.onState('idle');
        this.onError('recognition-ended');
        return;
      }
      this.restartCount += 1;
      this.onState('reconnecting');
      clearTimeout(this.restartTimer);
      this.restartTimer = setTimeout(() => {
        if (!this.active || this.manualStop || this.processing || session !== this.session) return;
        try { r.start(); } catch (_) {}
      }, 260);
    };
    return r;
  }

  start({ clear = true } = {}) {
    if (!this.supported()) {
      this.onError('unsupported');
      return false;
    }
    this.stop(false, false);
    if (clear) this.resetBuffer();
    this.manualStop = false;
    this.processing = false;
    this.active = true;
    this.restartCount = 0;
    const session = ++this.session;
    this.recognition = this._build(session);
    try {
      this.recognition.start();
      return true;
    } catch (error) {
      this.active = false;
      this.onState('idle');
      this.onError(error?.message || 'start-failed');
      return false;
    }
  }

  commitNow(reason = 'manual') {
    const text = this.getText();
    if (!text || this.processing) return '';
    this.processing = true;
    this.manualStop = true;
    this.active = false;
    this._clearTimers();
    const r = this.recognition;
    this.recognition = null;
    if (r) {
      try { r.stop(); } catch (_) {}
    }
    this.onState('processing');
    queueMicrotask(() => this.onUtterance(text, reason));
    return text;
  }

  finishProcessing() {
    this.processing = false;
    this.manualStop = true;
    this.active = false;
    this.onState('idle');
  }

  stop(manual = true, emitState = true) {
    this.manualStop = manual;
    this.active = false;
    this.processing = false;
    this._clearTimers();
    this.session += 1;
    const r = this.recognition;
    this.recognition = null;
    if (r) {
      try { r.stop(); } catch (_) {}
    }
    if (emitState) this.onState('idle');
  }
}

export function speak(text, onEnd) {
  if (!('speechSynthesis' in window) || !text) { if (onEnd) onEnd(); return; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = 'ja-JP';
    u.rate = 0.94;
    u.pitch = 1;
    let done = false;
    const finish = () => { if (done) return; done = true; if (onEnd) onEnd(); };
    u.onend = finish;
    u.onerror = finish;
    speechSynthesis.speak(u);
    setTimeout(finish, Math.max(3500, String(text).length * 180));
  } catch (_) { if (onEnd) onEnd(); }
}
