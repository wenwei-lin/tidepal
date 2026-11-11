// Turns microphone audio into 16-bit PCM chunks of ~100 ms for speech recognition.
// The AudioContext runs at 16 kHz, so no resampling is needed here.
class PcmChunker extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Int16Array(1600);
    this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    let sum = 0;
    for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      sum += s * s;
      this.buf[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === this.buf.length) {
        this.port.postMessage({ pcm: this.buf.buffer.slice(0) });
        this.n = 0;
      }
    }
    this.port.postMessage({ level: Math.sqrt(sum / ch.length) });
    return true;
  }
}
registerProcessor('pcm-chunker', PcmChunker);
