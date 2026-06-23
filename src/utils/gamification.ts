/**
 * 游戏化系统: XP / 等级 / 成就
 */

import type { AppData, BookProgress } from '../types/vocab'
import { getMasteredCount, getAverageEF, getLearnedCount } from './ebbinghaus'

// ─── XP 规则 ────────────────────────────────────

export const XP_RULES = {
  NEW_WORD: 10,          // 学一个新词
  REVIEW_KNOWN: 5,       // 复习认识
  REVIEW_FUZZY: 2,       // 复习模糊
  REVIEW_FORGOT: 0,      // 复习忘记
  PERFECT_MASTERY: 20,   // 完美掌握 (quality >= 4)
  DAILY_CHECKIN: 15,     // 每日打卡
  STREAK_BONUS: 5,       // 每连续一天额外加
  PER_5_MINUTES: 3,      // 每5分钟学习
}

export const LEVELS = [
  { level: 1,  xp: 0,    title: '初学者' },
  { level: 2,  xp: 100,  title: '学徒' },
  { level: 3,  xp: 300,  title: '勤学者' },
  { level: 4,  xp: 600,  title: '词汇兵' },
  { level: 5,  xp: 1000, title: '词汇士' },
  { level: 6,  xp: 1500, title: '词汇师' },
  { level: 7,  xp: 2200, title: '词汇专家' },
  { level: 8,  xp: 3000, title: '词汇大师' },
  { level: 9,  xp: 4000, title: '词汇学者' },
  { level: 10, xp: 5500, title: '词汇宗师' },
]

// ─── 成就系统 ────────────────────────────────────

export interface Achievement {
  id: string
  icon: string
  name: string
  desc: string
  check: (data: AppData, progress: BookProgress) => boolean
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_word', icon: '🌱', name: '初识词汇', desc: '完成第一次学习', check: (_, p) => getLearnedCount(p.records) >= 1 },
  { id: 'day7', icon: '🔥', name: '一周坚持', desc: '连续学习7天', check: (_, p) => p.streakDays >= 7 },
  { id: 'day30', icon: '💪', name: '月之星', desc: '连续学习30天', check: (_, p) => p.streakDays >= 30 },
  { id: 'master100', icon: '🎯', name: '百词斩', desc: '掌握100个词', check: (_, p) => getMasteredCount(p.records) >= 100 },
  { id: 'master500', icon: '🏅', name: '词汇达人', desc: '掌握500个词', check: (_, p) => getMasteredCount(p.records) >= 500 },
  { id: 'master1000', icon: '👑', name: '千词王', desc: '掌握1000个词', check: (_, p) => getMasteredCount(p.records) >= 1000 },
  { id: 'ef25', icon: '🧠', name: '记忆天才', desc: '平均EF达到2.5+', check: (_, p) => getAverageEF(p.records) >= 2.4 },
  { id: 'night_owl', icon: '🦉', name: '夜猫子', desc: '在23点后学习', check: (d, _) => {
    const h = new Date().getHours()
    return h >= 23 || h < 5
  }},
  { id: 'speed_demon', icon: '⚡', name: '速度之星', desc: '1分钟内学完10个词', check: (_, p) => {
    // Checked externally since we don't track time per session here
    return false
  }},
  { id: 'all_rounder', icon: '🌟', name: '全能王', desc: '完成所有词书的第一天', check: (d, _) => {
    const books = Object.keys(d.bookProgress || {})
    return books.length >= 5
  }},
]

// ─── 函数 ───────────────────────────────────────

export function getLevel(totalXP: number): { level: number; title: string; xpForNext: number } {
  let level = 1
  let title = LEVELS[0].title
  for (const l of LEVELS) {
    if (totalXP >= l.xp) {
      level = l.level
      title = l.title
    }
  }
  const nextLevel = LEVELS.find(l => l.level === level + 1)
  const xpForNext = nextLevel ? nextLevel.xp - totalXP : 0
  return { level, title, xpForNext }
}

export function getLevelProgress(totalXP: number): number {
  const current = getLevel(totalXP)
  const currentLevelXP = LEVELS.find(l => l.level === current.level)?.xp || 0
  const nextLevelXP = LEVELS.find(l => l.level === current.level + 1)?.xp
  if (!nextLevelXP) return 100
  return Math.round((totalXP - currentLevelXP) / (nextLevelXP - currentLevelXP) * 100)
}

export function checkNewAchievements(
  data: AppData,
  bookId: string
): Achievement[] {
  const progress = data.bookProgress?.[bookId]
  if (!progress) return []

  const earned = new Set(data.achievements || [])
  const result: Achievement[] = []

  for (const a of ACHIEVEMENTS) {
    if (earned.has(a.id)) continue
    if (a.check(data, progress)) {
      result.push(a)
    }
  }

  return result
}

export function awardXP(
  data: AppData,
  bookId: string,
  xp: number
): { newXP: number; leveledUp: boolean } {
  if (!data.totalXP) data.totalXP = 0
  const oldLevel = getLevel(data.totalXP)
  data.totalXP += xp

  if (!data.bookProgress[bookId]) return { newXP: data.totalXP, leveledUp: false }
  data.bookProgress[bookId].xp = (data.bookProgress[bookId].xp || 0) + xp

  const newLevel = getLevel(data.totalXP)
  return {
    newXP: data.totalXP,
    leveledUp: newLevel.level > oldLevel.level
  }
}
