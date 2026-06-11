let audioContext = null
let soundEnabled = true
let musicEnabled = true
let volume = 0.7

const initAudio = () => {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)()
    } catch (e) {
      console.warn('Web Audio API 不支持')
    }
  }
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume()
  }
}

export const setSoundEnabled = (enabled) => {
  soundEnabled = enabled
}

export const setMusicEnabled = (enabled) => {
  musicEnabled = enabled
}

export const setVolume = (vol) => {
  volume = Math.max(0, Math.min(1, vol))
}

export const getSoundEnabled = () => soundEnabled
export const getMusicEnabled = () => musicEnabled
export const getVolume = () => volume

const playTone = (frequency, duration, type = 'sine', gain = 0.3) => {
  if (!soundEnabled || !audioContext) return

  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime)

  gainNode.gain.setValueAtTime(gain * volume, audioContext.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)

  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)

  oscillator.start(audioContext.currentTime)
  oscillator.stop(audioContext.currentTime + duration)
}

const playSequence = (notes, noteDuration = 0.15) => {
  if (!soundEnabled || !audioContext) return

  notes.forEach((note, index) => {
    setTimeout(() => {
      playTone(note.freq, noteDuration, note.type || 'sine', note.gain || 0.3)
    }, index * noteDuration * 1000)
  })
}

export const playPlant = () => {
  initAudio()
  playSequence([
    { freq: 440, type: 'sine' },
    { freq: 550, type: 'sine' },
    { freq: 660, type: 'sine' },
  ], 0.08)
}

export const playWater = () => {
  initAudio()
  if (!soundEnabled || !audioContext) return

  const noise = audioContext.createBufferSource()
  const bufferSize = audioContext.sampleRate * 0.3
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate)
  const data = buffer.getChannelData(0)

  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) * 0.3
  }

  noise.buffer = buffer
  const gainNode = audioContext.createGain()
  gainNode.gain.value = volume * 0.2
  const filter = audioContext.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 1000

  noise.connect(filter)
  filter.connect(gainNode)
  gainNode.connect(audioContext.destination)

  noise.start()
}

export const playHarvest = () => {
  initAudio()
  playSequence([
    { freq: 523, type: 'sine', gain: 0.4 },
    { freq: 659, type: 'sine', gain: 0.4 },
    { freq: 784, type: 'sine', gain: 0.4 },
    { freq: 1047, type: 'sine', gain: 0.5 },
  ], 0.1)
}

export const playCoin = () => {
  initAudio()
  playSequence([
    { freq: 988, type: 'square', gain: 0.2 },
    { freq: 1319, type: 'square', gain: 0.2 },
  ], 0.08)
}

export const playLevelUp = () => {
  initAudio()
  playSequence([
    { freq: 523, type: 'sine', gain: 0.4 },
    { freq: 659, type: 'sine', gain: 0.4 },
    { freq: 784, type: 'sine', gain: 0.4 },
    { freq: 880, type: 'sine', gain: 0.4 },
    { freq: 1047, type: 'sine', gain: 0.5 },
    { freq: 1319, type: 'sine', gain: 0.5 },
  ], 0.12)
}

export const playFishCatch = () => {
  initAudio()
  playSequence([
    { freq: 392, type: 'sine', gain: 0.3 },
    { freq: 523, type: 'sine', gain: 0.3 },
    { freq: 659, type: 'triangle', gain: 0.4 },
  ], 0.1)
}

export const playClick = () => {
  initAudio()
  playTone(800, 0.05, 'square', 0.15)
}

export const playError = () => {
  initAudio()
  playSequence([
    { freq: 200, type: 'sawtooth', gain: 0.2 },
    { freq: 150, type: 'sawtooth', gain: 0.2 },
  ], 0.15)
}

export const playBuy = () => {
  initAudio()
  playSequence([
    { freq: 700, type: 'sine', gain: 0.3 },
    { freq: 900, type: 'sine', gain: 0.3 },
    { freq: 1100, type: 'sine', gain: 0.35 },
  ], 0.07)
}

export const playAnimal = () => {
  initAudio()
  playTone(600, 0.1, 'sine', 0.25)
  setTimeout(() => playTone(450, 0.15, 'sine', 0.2), 100)
}
