export interface VocabWord {
  word: string
  phonetic?: string
  pos?: string
  meaning: string
  phrases?: Array<{ phrase: string; translation: string }>
}

export type WordStatus = 'new' | 'learning' | 'review' | 'mastered'

export interface WordRecord {
  word: string
  status: WordStatus
  reviewCount: number
  nextReview: number  // timestamp
  lastReview: number  // timestamp
  wrongCount: number
}

export interface AppData {
  currentDay: number
  records: Record<string, WordRecord>
  streakDays: number
  totalLearned: number
  lastCheckin: string
  startedAt: string
}
