/**
 * Loud repeating alert tone synthesized with Web Audio (no audio asset).
 *
 * The whole pattern is scheduled on the audio clock up front, so it keeps
 * time in background tabs where JS timers are throttled.
 */

const ALERT_VOLUME = 0.8 // Square-wave peak gain (0..1). Tune loudness here.
const ALERT_SECONDS = 6
const BEEP_PERIOD = 0.5
const BEEP_LENGTH = 0.15
const BEEPS = [[0, 988], [0.18, 1319]] // [offset seconds, Hz] within one period

let ctx = null
let current = null
let armed = false

function unlock () {
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return
  if (!ctx) ctx = new Ctor()
  if (ctx.state !== 'running') ctx.resume().catch(() => {})
}

/**
 * Browsers keep an AudioContext suspended until a user gesture, so the context
 * is created and resumed from the first (and any later) pointer or key event.
 */
export function armAlertSound () {
  if (armed || typeof window === 'undefined') return
  armed = true
  const options = { capture: true, passive: true }
  window.addEventListener('pointerdown', unlock, options)
  window.addEventListener('keydown', unlock, options)
}

export function stopAlertSound () {
  if (!current) return
  const osc = current
  current = null
  try {
    osc.stop()
  } catch (e) { /* already stopped */ }
}

/** Returns false when the browser has not allowed audio yet (no user gesture). */
export function playAlertSound (seconds = ALERT_SECONDS) {
  stopAlertSound()
  if (!ctx || ctx.state !== 'running') return false

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'square'
  gain.gain.value = 0
  osc.connect(gain)
  gain.connect(ctx.destination)

  const t0 = ctx.currentTime + 0.05
  for (let period = 0; period < seconds; period += BEEP_PERIOD) {
    for (const [offset, hz] of BEEPS) {
      const start = t0 + period + offset
      osc.frequency.setValueAtTime(hz, start)
      // Short ramps avoid clicks at the beep edges.
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(ALERT_VOLUME, start + 0.01)
      gain.gain.setValueAtTime(ALERT_VOLUME, start + BEEP_LENGTH - 0.01)
      gain.gain.linearRampToValueAtTime(0, start + BEEP_LENGTH)
    }
  }
  osc.onended = () => {
    gain.disconnect()
    if (current === osc) current = null
  }
  osc.start(t0)
  osc.stop(t0 + seconds)
  current = osc
  return true
}
