let ctx: AudioContext | null = null;

/** A short synthesized shutter click (no audio asset needed). */
export function playShutter() {
  try {
    ctx ??= new AudioContext();
    const len = Math.floor(ctx.sampleRate * 0.09);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      // Two decaying noise bursts: shutter open and close.
      const env = Math.exp(-t * 18) + (t > 0.45 ? 0.6 * Math.exp(-(t - 0.45) * 22) : 0);
      d[i] = (Math.random() * 2 - 1) * env * 0.35;
    }
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1200;
    src.buffer = buf;
    src.connect(filter).connect(ctx.destination);
    src.start();
  } catch {
    // Audio is optional.
  }
}
