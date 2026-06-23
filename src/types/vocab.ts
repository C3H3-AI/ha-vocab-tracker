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
  /** SM-2: 复习次数 */
  reviewCount: number
  /** 下次复习时间戳 */
  nextReview: number
  /** 上次复习时间戳 */
  lastReview: number
  /** 总错误次数 */
  wrongCount: number
  /** SM-2: 最近3次自评结果 true=认识 */
  recentRatings: boolean[]
  /** 当前连续正确次数 */
  correctStreak: number
  /** SM-2: 易度因子 (2.5 起步, >= 1.3) */
  easinessFactor?: number
  /** SM-2: 当前间隔天数 */
  interval?: number
  /** SM-2: 上次回答质量 (0-5) */
  lastQuality?: number
  /** 累计学习时间(秒) */
  totalStudySeconds?: number
  /** 首次学习时间戳 */
  firstLearned?: number
}

export interface BookProgress {
  currentDay: number
  records: Record<string, WordRecord>
  streakDays: number
  totalLearned: number
  lastCheckin: string
  startedAt: string
  /** SM-2: 全局平均 EF */
  averageEF?: number
  /** 游戏化: XP 经验值 */
  xp?: number
  /** 游戏化: 等级 */
  level?: number
  /** 游戏化: 成就列表 */
  achievements?: string[]
}

export interface AppData {
  currentWordBook: string
  dailyMinutes: Record<string, number>
  wrongWords: Record<string, number>
  bookProgress: Record<string, BookProgress>
  /** 游戏化: 全局 XP */
  totalXP?: number
  /** 游戏化: 全局成就 */
  achievements?: string[]
  /** 游戏化: 连续学习天数记录 */
  streakHistory?: Record<string, boolean>
}
