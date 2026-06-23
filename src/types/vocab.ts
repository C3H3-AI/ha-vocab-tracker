export interface VocabWord {
  word: string
  phonetic?: string
  pos?: string
  meaning: string
  phrases?: Array<{ phrase: string; translation: string }>
  sentences?: Array<{ en: string; zh: string }>
  roots?: string
  mnemonics?: string
  synos?: string
}

export type WordStatus = 'new' | 'learning' | 'review' | 'mastered'

export interface WordRecord {
  word: string
  status: WordStatus
  reviewCount: number
  nextReview: number  // timestamp
  lastReview: number  // timestamp
  wrongCount: number
  /** 最近3次自评结果: true=认识, false=忘记/模糊 */
  recentRatings: boolean[]
  /** 当前学习轮次中已正确次数 (连续正确3次才算掌握) */
  correctStreak: number
}

export interface BookProgress {
  currentDay: number
  records: Record<string, WordRecord>
  streakDays: number
  totalLearned: number
  lastCheckin: string
  startedAt: string
}

export interface AppData {
  currentWordBook: string
  dailyMinutes: Record<string, number>
  wrongWords: Record<string, number>
  bookProgress: Record<string, BookProgress>
}
