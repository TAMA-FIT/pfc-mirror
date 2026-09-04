export class VoiceInput {
  constructor({ onText, onInterim, onState, onError } = {}) {
    this.onText = onText || (()=>{});
    this.onInterim = onInterim || (()=>{});
    this.onState = onState || (()=>{});
    this.onError = onError || (()=>{});
    this.Recognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    this.recognition = null;
    this.active = false;
    this.manualStop = false;
    this.finalBuffer = '';
    this.restartTimer = null;
    this.maxAutoRestarts = 12;
    this.restartCount = 0;
  }

  supported() { return !!this.Recognition; }

  _build() {
    const r = new this.Recognition();
    r.lang = 'ja-JP';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onstart = () => {
      this.restartCount = 0;
      this.onState('listening');
    };

    r.onresult = event => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) {
          this.finalBuffer += (this.finalBuffer ? ' ' : '') + chunk.trim();
          this.onText(chunk.trim(), this.finalBuffer.trim());
        } else {
          interim += chunk;
        }
      }
      this.onInterim(interim.trim(), this.finalBuffer.trim());
    };

    r.onerror = event => {
      const code = String(event.error || 'unknown');
      if (!['no-speech','aborted'].includes(code)) this.onError(code);
    };

    r.onend = () => {
      if (!this.active || this.manualStop) {
        this.onState('idle');
        return;
      }
      if (this.restartCount >= this.maxAutoRestarts) {
        this.active = false;
        this.onState('idle');
        this.onError('recognition-ended');
        return;
      }
      this.restartCount += 1;
      this.onState('reconnecting');
      clearTimeout(this.restartTimer);
      this.restartTimer = setTimeout(() => {
        if (!this.active || this.manualStop) return;
        try { r.start(); } catch (_) {}
      }, 180);
    };
    return r;
  }

  start({ clear = true } = {}) {
    if (!this.supported()) {
      this.onError('unsupported');
      return false;
    }
    this.stop(false);
    if (clear) this.finalBuffer = '';
    this.manualStop = false;
    this.active = true;
    this.recognition = this._build();
    try {
      this.recognition.start();
      return true;
    } catch (e) {
      this.active = false;
      this.onError(e?.message || 'start-failed');
      return false;
    }
  }

  stop(manual = true) {
    this.manualStop = manual;
    this.active = false;
    clearTimeout(this.restartTimer);
    if (this.recognition) {
      try { this.recognition.stop(); } catch (_) {}
      this.recognition = null;
    }
    this.onState('idle');
  }

  resetBuffer() { this.finalBuffer = ''; }
  getText() { return this.finalBuffer.trim(); }
}

export function speak(text, onEnd) {
  if (!('speechSynthesis' in window) || !text) { if (onEnd) onEnd(); return; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = 'ja-JP';
    u.rate = 0.95;
    u.pitch = 1;
    if (onEnd) u.onend = onEnd;
    speechSynthesis.speak(u);
  } catch (_) {}
}
