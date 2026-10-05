// Original ascending chiptune; no game recording or copied melody.
export const fanClubNotes = [523.25, 659.25, 783.99, 1046.5, 880, 1174.66]
export function scheduleFanClubSound(context: AudioContext, start = context.currentTime, active = new Set<OscillatorNode>()): number {
  let cursor = start
  fanClubNotes.forEach((frequency, index) => {
    const duration = index === fanClubNotes.length - 1 ? 0.38 : 0.13
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'square'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0, cursor)
    gain.gain.linearRampToValueAtTime(0.035, cursor + 0.008)
    gain.gain.setValueAtTime(0.035, cursor + duration - 0.04)
    gain.gain.linearRampToValueAtTime(0, cursor + duration)
    oscillator.connect(gain)
    gain.connect(context.destination)
    active.add(oscillator)
    oscillator.onended = () => { active.delete(oscillator); oscillator.disconnect(); gain.disconnect() }
    oscillator.start(cursor)
    oscillator.stop(cursor + duration)
    cursor += duration + 0.025
  })
  return cursor
}

export class FanClubSound {
  private context: AudioContext | undefined
  private nextTime = 0
  private generation = 0
  private active = new Set<OscillatorNode>()
  unlock(): void {
    const Constructor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Constructor) return
    this.context ??= new Constructor()
    // Called from a tap/click to enable audio on iPad and other browsers.
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {})
  }
  async play(): Promise<boolean> {
    const context = this.context
    const generation = this.generation
    if (!context || context.state === 'closed') return false
    try {
      if (context.state === 'suspended') await context.resume()
      if (generation !== this.generation || context.state !== 'running') return false
      this.nextTime = scheduleFanClubSound(context, Math.max(context.currentTime, this.nextTime), this.active)
      return true
    } catch { return false }
  }
  stop(): void {
    this.generation++
    for (const oscillator of this.active) { try { oscillator.stop() } catch { /* already ended */ } }
    this.active.clear()
    this.nextTime = 0
  }
  dispose(): void {
    this.stop()
    const context = this.context
    this.context = undefined
    if (context) void context.close().catch(() => {})
  }
}
