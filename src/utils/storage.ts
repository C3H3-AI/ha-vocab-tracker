import type { AppData } from '../types/vocab'

const STORAGE_KEY = 'ha_vocab_tracker'

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw) as AppData
    }
  } catch (e) {
    console.warn('Failed to load data, resetting', e)
  }
  return getDefaultData()
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('Failed to save data', e)
  }
}

export function resetData(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function exportData(data: AppData): string {
  return JSON.stringify(data, null, 2)
}

export function importData(json: string): boolean {
  try {
    const data = JSON.parse(json) as AppData
    if (typeof data.currentDay === 'number' && data.records && typeof data.streakDays === 'number') {
      saveData(data)
      return true
    }
    return false
  } catch {
    return false
  }
}

function getDefaultData(): AppData {
  return {
    currentDay: 1,
    records: {},
    streakDays: 0,
    totalLearned: 0,
    lastCheckin: '',
    startedAt: new Date().toISOString()
  }
}

export function getDayStart(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
