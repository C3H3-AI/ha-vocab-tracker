import type { WordRecord } from '../types/vocab'

/** 基础间隔 (天) - 用于 "认识" 评级 */
export const DEFAULT_INTERVALS = [1, 2, 4, 7, 15, 30]

/** 模糊的间隔因子 - 间隔减半 */
const FUZZY_FACTOR = 0.5

/** 忘记的间隔因子 - 回到第1轮 */
const FORGOT_RESET = true

// 当前生效的间隔配置（可从 storage 覆盖）
let currentIntervals = [...DEFAULT_INTERVALS]

/** 设置自定义间隔 */
export function setIntervals(intervals: number[]): void {
  currentIntervals = intervals
}

/** 重置为默认间隔 */
export function resetIntervals(): void {
  currentIntervals = [...DEFAULT_INTERVALS]
}

/** 获取当前间隔配置 */
export function getIntervals(): number[] {
  return currentIntervals
}

/** 从 AppData 加载间隔配置 */
export function loadIntervalsFromData(data: { ebbinghausIntervals?: number[] }): void {
  if (data.ebbinghausIntervals && data.ebbinghausIntervals.length > 0) {
    currentIntervals = data.ebbinghausIntervals
  }
}

export function getNextReviewInterval(
  reviewCount: number,
  rating: 'known' | 'fuzzy' | 'forgot'
): number {
  if (rating === 'forgot') {
    return currentIntervals[0]
  }

  const idx = Math.min(reviewCount, currentIntervals.length - 1)
  const base = currentIntervals[idx]

  if (rating === 'fuzzy') {
    return Math.max(1, Math.round(base * FUZZY_FACTOR))
  }

  return base
}

export function getNextReviewTimestamp(
  reviewCount: number,
  rating: 'known' | 'fuzzy' | 'forgot'
): number {
  const interval = getNextReviewInterval(reviewCount, rating)
  const now = Date.now()
  return now + interval * 24 * 60 * 60 * 1000
}

export function getDueReviews(
  records: Record<string, WordRecord>,
  _currentDay?: number
): WordRecord[] {
  const now = Date.now()
  return Object.values(records).filter(r => {
    if (r.status === 'mastered') return false
    return r.nextReview <= now
  })
}

export function getDueCount(
  records: Record<string, WordRecord>
): number {
  return getDueReviews(records).length
}

export function createWordRecord(word: string): WordRecord {
  const now = Date.now()
  return {
    word,
    status: 'learning',
    reviewCount: 0,
    nextReview: now + currentIntervals[0] * 24 * 60 * 60 * 1000,
    lastReview: now,
    wrongCount: 0,
    recentRatings: [],
    correctStreak: 0
  }
}

export function applyRating(
  record: WordRecord,
  rating: 'known' | 'fuzzy' | 'forgot'
): WordRecord {
  const updated = { ...record }

  // 更新最近3次自评
  updated.recentRatings = [...(record.recentRatings || []), rating === 'known']
  if (updated.recentRatings.length > 3) {
    updated.recentRatings = updated.recentRatings.slice(-3)
  }

  if (rating === 'known') {
    updated.correctStreak++
    updated.reviewCount++
  } else if (rating === 'fuzzy') {
    updated.correctStreak = 0
    updated.reviewCount++
    updated.wrongCount++
  } else {
    // forgot
    updated.correctStreak = 0
    updated.reviewCount = Math.max(0, updated.reviewCount - 1)
    updated.wrongCount++
  }

  // 更新状态
  if (updated.correctStreak >= 3 && rating === 'known') {
    updated.status = 'mastered'
  } else if (rating === 'forgot' || rating === 'fuzzy') {
    updated.status = 'learning'
  } else {
    updated.status = 'review'
  }

  // 计算下次复习时间
  updated.nextReview = getNextReviewTimestamp(updated.reviewCount, rating)
  updated.lastReview = Date.now()

  return updated
}

/** 从词库中为选择题生成干扰项 */
export function generateDistractors(
  correctMeaning: string,
  allWords: Array<{ word: string; meaning: string }>,
  count: number = 3
): string[] {
  const others = allWords.filter(w => w.meaning !== correctMeaning)
  const shuffled = others.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count).map(w => w.meaning)
}
