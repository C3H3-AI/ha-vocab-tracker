/**
 * 语音朗读工具
 * 使用 Web Speech API 朗读单词
 */

let speechSynthInitialized = false

function getSpeechSynthesis(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null
  return window.speechSynthesis
}

/** 获取可用的英语语音 */
function getEnglishVoice(accent: 'us' | 'uk' = 'us'): SpeechSynthesisVoice | null {
  const synth = getSpeechSynthesis()
  if (!synth) return null

  const voices = synth.getVoices()
  
  // 美音优先
  if (accent === 'us') {
    const us = voices.find(v => v.lang.startsWith('en-US') && v.localService)
    if (us) return us
    const usAny = voices.find(v => v.lang.startsWith('en-US'))
    if (usAny) return usAny
  }

  // 英音
  const uk = voices.find(v => v.lang.startsWith('en-GB'))
  if (uk) return uk

  // 任何英语
  const anyEn = voices.find(v => v.lang.startsWith('en'))
  return anyEn || null
}

export interface SpeakOptions {
  rate?: number     // 语速 0.1-10 (默认 0.8)
  pitch?: number    // 音调 0-2 (默认 1)
  volume?: number   // 音量 0-1 (默认 1)
  accent?: 'us' | 'uk'
}

/** 朗读单词 */
export function speakWord(
  word: string,
  options: SpeakOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const synth = getSpeechSynthesis()
    if (!synth) {
      reject(new Error('SpeechSynthesis not supported'))
      return
    }

    // Cancel any ongoing speech
    synth.cancel()

    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = options.accent === 'uk' ? 'en-GB' : 'en-US'
    utterance.rate = options.rate ?? 0.8
    utterance.pitch = options.pitch ?? 1
    utterance.volume = options.volume ?? 1

    const voice = getEnglishVoice(options.accent)
    if (voice) utterance.voice = voice

    utterance.onend = () => resolve()
    utterance.onerror = (e) => reject(e)

    synth.speak(utterance)
  })
}

/** 朗读单词（不等待完成） */
export function speakWordFire(word: string, options: SpeakOptions = {}): void {
  speakWord(word, options).catch(() => {})
}

/** 初始化语音引擎（预加载语音列表） */
export function initSpeech(): void {
  if (speechSynthInitialized) return
  const synth = getSpeechSynthesis()
  if (!synth) return

  // 触发语音列表加载
  if (synth.getVoices().length === 0) {
    synth.addEventListener('voiceschanged', () => {}, { once: true })
  }
  speechSynthInitialized = true
}

/** 检测是否支持语音 */
export function isSpeechSupported(): boolean {
  return 'speechSynthesis' in window
}
