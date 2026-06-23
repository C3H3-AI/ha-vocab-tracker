/**
 * SM-2 间隔重复算法（SuperMemo 2）
 * 
 * 参考: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 * 
 * 质量评分 (quality):
 *   5 - 完美回答，立即回忆
 *   4 - 正确，稍有犹豫
 *   3 - 正确，但回忆困难
 *   2 - 错误，但想起来接近正确
 *   1 - 错误，想起来有困难
 *   0 - 完全忘记
 * 
 * 质量 >= 3 → 通过，延长间隔
 * 质量 < 3  → 未通过，重置间隔
 */
import type { WordRecord } from '../types/vocab'

// ─── SM-2 默认参数 ──────────────────────────────

export const SM2_DEFAULTS = {
  MIN_EF: 1.3,
  INITIAL_EF: 2.5,
  QUALITY_PASS: 3,
  MAX_REVIEWS_PER_DAY: 50,
  INTERVALS: [1, 6], // 第1次、第2次通过的间隔
}

// ─── 可配置参数 ──────────────────────────────────

let config = { ...SM2_DEFAULTS }

export function setSM2Config(cfg: Partial<typeof config>) {
  Object.assign(config, cfg)
}

export function getSM2Config() {
  return { ...config }
}

// 向后兼容的别名
export const DEFAULT_INTERVALS = SM2_DEFAULTS.INTERVALS
export function getIntervals(): number[] { return [...config.INTERVALS] }
export function setIntervals(intervals: number[]) { config.INTERVALS = intervals }
export function resetIntervals() { config.INTERVALS = [...SM2_DEFAULTS.INTERVALS] }
export function loadIntervalsFromData(data: { ebbinghausIntervals?: number[] }) {
  if (data.ebbinghausIntervals && data.ebbinghausIntervals.length > 0) {
    config.INTERVALS = data.ebbinghausIntervals
  }
}

// ─── 核心算法 ────────────────────────────────────

/** 计算新的易度因子 (EF) */
export function calculateEF(currentEF: number, quality: number): number {
  const ef = currentEF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  return Math.max(config.MIN_EF, ef)
}

/** 计算新的间隔天数 */
export function calculateInterval(
  reviewCount: number,
  currentInterval: number,
  ef: number,
  quality: number
): number {
  if (quality < config.QUALITY_PASS) {
    // 未通过: 重置到最短间隔
    return 1
  }
  if (reviewCount <= 1) {
    return config.INTERVALS[0]
  }
  if (reviewCount === 2) {
    return config.INTERVALS[1] || 6
  }
  return Math.round(currentInterval * ef)
}

/** 质量评分升级/降级 */
export function getQualityFromRating(rating: 'known' | 'fuzzy' | 'forgot'): number {
  switch (rating) {
    case 'known':  return 4   // 认识 → 良好
    case 'fuzzy':  return 2   // 模糊 → 错误但接近
    case 'forgot': return 0   // 忘记 → 完全忘记
  }
}

/** 向后兼容: 从旧版 WordRecord 迁移 SM-2 字段 */
export function migrateRecord(record: WordRecord): WordRecord {
  if (record.easinessFactor === undefined) {
    record.easinessFactor = SM2_DEFAULTS.INITIAL_EF
  }
  if (record.interval === undefined) {
    record.interval = 1
  }
  if (record.totalStudySeconds === undefined) {
    record.totalStudySeconds = 0
  }
  return record
}

/** 创建新记录 */
export function createWordRecord(word: string): WordRecord {
  return migrateRecord({
    word,
    status: 'learning',
    reviewCount: 0,
    nextReview: Date.now() + 24 * 60 * 60 * 1000,
    lastReview: Date.now(),
    wrongCount: 0,
    recentRatings: [],
    correctStreak: 0,
    firstLearned: Date.now(),
  })
}

/**
 * SM-2 核心: 应用评分更新记录
 * @param record 当前记录
 * @param quality 质量评分 0-5
 * @param studySeconds 本次学习秒数
 */
export function applyRating(
  record: WordRecord,
  quality: number,
  studySeconds: number = 5
): WordRecord {
  const r = migrateRecord({ ...record })

  // 更新累计学习时间
  r.totalStudySeconds = (r.totalStudySeconds || 0) + studySeconds

  // 更新最近评分 (保留最近3次)
  const passed = quality >= config.QUALITY_PASS
  r.recentRatings = [...(r.recentRatings || []), passed]
  if (r.recentRatings.length > 3) {
    r.recentRatings = r.recentRatings.slice(-3)
  }

  // SM-2 核心计算
  const newEF = calculateEF(r.easinessFactor!, quality)
  const newInterval = calculateInterval(r.reviewCount, r.interval!, r.easinessFactor!, quality)

  r.easinessFactor = newEF
  r.interval = newInterval
  r.lastQuality = quality
  r.lastReview = Date.now()
  r.nextReview = Date.now() + newInterval * 24 * 60 * 60 * 1000

  if (passed) {
    // 通过: 增加复习次数、连续正确
    r.reviewCount++
    r.correctStreak++
    r.wrongCount = r.wrongCount // 不重置错误次数
  } else {
    // 未通过
    r.correctStreak = 0
    r.wrongCount++
    if (quality < 2) {
      // 完全忘记或严重错误 → 重置复习计数
      r.reviewCount = Math.max(0, r.reviewCount - 1)
    } else {
      r.reviewCount++
    }
  }

  // 更新状态
  if (r.correctStreak >= 3 || (r.reviewCount >= 5 && passed)) {
    r.status = 'mastered'
  } else if (r.reviewCount >= 1) {
    r.status = 'review'
  } else {
    r.status = 'learning'
  }

  return r
}

// ─── 查询函数 ────────────────────────────────────

/** 获取到期复习的词 */
export function getDueReviews(
  records: Record<string, WordRecord>,
  _currentDay?: number
): WordRecord[] {
  const now = Date.now()
  return Object.values(records).filter(r => {
    if (r.status === 'mastered') {
      // 已掌握的词也周期性出现 (长期复习)
      return r.nextReview <= now
    }
    return r.nextReview <= now
  })
}

/** 到期数 */
export function getDueCount(records: Record<string, WordRecord>): number {
  return getDueReviews(records).length
}

/** 获取所有已学词 (排除 new 状态) */
export function getLearnedCount(records: Record<string, WordRecord>): number {
  return Object.values(records).filter(r => r.reviewCount > 0).length
}

/** 获取平均 EF */
export function getAverageEF(records: Record<string, WordRecord>): number {
  const vals = Object.values(records).filter(r => r.easinessFactor)
  if (vals.length === 0) return SM2_DEFAULTS.INITIAL_EF
  return vals.reduce((sum, r) => sum + (r.easinessFactor || SM2_DEFAULTS.INITIAL_EF), 0) / vals.length
}

/** 获取 mastered 的词数 */
export function getMasteredCount(records: Record<string, WordRecord>): number {
  return Object.values(records).filter(r => r.status === 'mastered').length
}

// ─── 干扰项生成 ──────────────────────────────────

export function generateDistractors(
  correctMeaning: string,
  allWords: Array<{ word: string; meaning: string }>,
  count: number = 3
): string[] {
  const others = allWords.filter(w => w.meaning !== correctMeaning)
  const shuffled = others.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count).map(w => w.meaning)
}

// ─── 遗忘曲线预测 ────────────────────────────────

export interface RetentionPoint {
  label: string
  days: number
  retention: number // 0-1
}

/**
 * 基于 SM-2 参数的预测遗忘曲线
 * 使用 Ebbinghaus 遗忘曲线: R = e^(-t/S)
 * 其中 S = interval * 0.6 (假设60%时间后回忆率约37%)
 */
export function predictRetention(
  ef: number,
  interval: number,
  quality: number,
  days: number
): number {
  // S = 记忆稳定度 (day)
  const S = interval * (0.5 + ef * 0.2)
  return Math.exp(-days / S)
}

/** 生成未来7次复习的遗忘曲线点 */
export function generateRetentionCurve(
  record: WordRecord
): RetentionPoint[] {
  const r = migrateRecord({ ...record })
  let ef = r.easinessFactor!
  let interval = r.interval!
  let reviewCount = r.reviewCount || 1

  const points: RetentionPoint[] = [
    { label: '今天', days: 0, retention: 1 }
  ]

  let cumDays = 0
  for (let i = 0; i < 7; i++) {
    const quality = 4 // 假设良好回答
    ef = calculateEF(ef, quality)
    if (reviewCount <= 1) {
      interval = config.INTERVALS[0]
    } else if (reviewCount === 2) {
      interval = config.INTERVALS[1] || 6
    } else {
      interval = Math.round(interval * ef)
    }
    reviewCount++
    cumDays += interval
    const retention = predictRetention(ef, interval, quality, interval)
    points.push({
      label: `${cumDays}天`,
      days: cumDays,
      retention
    })
  }

  return points
}
