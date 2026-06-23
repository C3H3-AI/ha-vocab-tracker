import type { AppData, BookProgress } from '../types/vocab'
import { getDefaultBook } from './wordbank'

export interface HAUser {
  id: string
  name: string
  isAdmin: boolean
}

const BASE_KEY = 'ha_vocab_tracker'

function getHAUser(): HAUser {
  try {
    const parentWin = window.parent
    const hass = (parentWin as any)?.hass
    if (hass?.user?.id) {
      return {
        id: hass.user.id,
        name: hass.user.name || 'HA User',
        isAdmin: hass.user.is_admin || false
      }
    }
  } catch {
    // Cross-origin iframe
  }
  return { id: 'local', name: '本地用户', isAdmin: true }
}

let cachedUser: HAUser | null = null

export function getCurrentUser(): HAUser {
  if (!cachedUser) {
    cachedUser = getHAUser()
  }
  return cachedUser
}

export function getStorageKey(): string {
  const user = getCurrentUser()
  return user.id === 'local' ? BASE_KEY : `${BASE_KEY}_${user.id}`
}

export function loadData(): AppData {
  try {
    const key = getStorageKey()
    const raw = localStorage.getItem(key)
    if (raw) {
      const data = JSON.parse(raw) as AppData
      // Migrate old format to new
      if (!data.bookProgress) {
        data.bookProgress = {}
        const old = data as any
        if (old.currentDay || old.records) {
          data.bookProgress[getDefaultBook()] = {
            currentDay: old.currentDay || 1,
            records: old.records || {},
            streakDays: old.streakDays || 0,
            totalLearned: old.totalLearned || 0,
            lastCheckin: old.lastCheckin || '',
            startedAt: old.startedAt || new Date().toISOString()
          }
        }
      }
      if (!data.currentWordBook) {
        data.currentWordBook = getDefaultBook()
      }
      return data
    }
  } catch (e) {
    console.warn('Failed to load data, resetting', e)
  }
  return getDefaultData()
}

export function saveData(data: AppData): void {
  try {
    const key = getStorageKey()
    localStorage.setItem(key, JSON.stringify(data))
  } catch (e) {
    console.error('Failed to save data', e)
  }
}

export function resetData(): void {
  const key = getStorageKey()
  localStorage.removeItem(key)
}

export function getBookProgress(data: AppData, bookId: string): BookProgress {
  if (!data.bookProgress) {
    data.bookProgress = {}
  }
  if (!data.bookProgress[bookId]) {
    data.bookProgress[bookId] = {
      currentDay: 1,
      records: {},
      streakDays: 0,
      totalLearned: 0,
      lastCheckin: '',
      startedAt: new Date().toISOString()
    }
  }
  return data.bookProgress[bookId]
}

export function saveBookProgress(data: AppData, bookId: string, progress: BookProgress): void {
  data.bookProgress[bookId] = progress
  saveData(data)
}

export function getDefaultData(): AppData {
  const defaultBook = getDefaultBook()
  return {
    currentWordBook: defaultBook,
    dailyMinutes: {},
    wrongWords: {},
    bookProgress: {
      [defaultBook]: {
        currentDay: 1,
        records: {},
        streakDays: 0,
        totalLearned: 0,
        lastCheckin: '',
        startedAt: new Date().toISOString()
      }
    }
  }
}

export function getDayStart(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
