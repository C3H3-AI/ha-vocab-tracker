import type { WordRecord, AppData, WordStatus } from '../types/vocab'

export const REVIEW_INTERVALS = [1, 2, 4, 7, 15, 30]

export function getReviewDay(learnDay: number, round: number): number {
  if (round < 0 || round >= REVIEW_INTERVALS.length) return -1
  return learnDay + REVIEW_INTERVALS[round]
}

export function getNextReview(learnDay: number, round: number): number {
  if (round < 0) return learnDay + REVIEW_INTERVALS[0]
  if (round >= REVIEW_INTERVALS.length) return -1
  return learnDay + REVIEW_INTERVALS[round]
}

export function getReviewRound(reviewCount: number): number {
  return Math.min(reviewCount, REVIEW_INTERVALS.length - 1)
}

export function getDueReviews(
  records: Record<string, WordRecord>,
  currentDay: number
): WordRecord[] {
  const now = Date.now()
  return Object.values(records).filter(r => {
    if (r.status === 'mastered') return false
    return r.nextReview <= now
  })
}

export function getDayReviews(
  records: Record<string, WordRecord>,
  currentDay: number
): { daySources: number[]; total: number } {
  const due = getDueReviews(records, currentDay)
  return { daySources: [], total: due.length }
}
