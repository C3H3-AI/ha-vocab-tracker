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

// ─── HA Cloud Sync ─────────────────────────────────────

const SYNC_ENTITY_BASE = 'sensor.vocab_tracker'

function getHass(): any | null {
  try {
    return (window.parent as any)?.hass || null
  } catch { return null }
}

export function isHAConnected(): boolean {
  return !!getHass()?.user?.id
}

/** Push data to HA as sensor state (cloud backup) */
export async function pushToHA(data: AppData): Promise<boolean> {
  const user = getCurrentUser()
  if (user.id === 'local') return false

  const hass = getHass()
  if (!hass) return false

  try {
    // Store as HA state attribute
    const entityId = `${SYNC_ENTITY_BASE}_${user.id}`
    const payload = {
      state: 'stored',
      attributes: {
        friendly_name: `词汇学习 - ${user.name}`,
        data: JSON.stringify(data),
        updated_at: new Date().toISOString(),
        user_id: user.id
      }
    }
    await hass.callApi('POST', `/api/states/${entityId}`, payload)
    return true
  } catch (e) {
    console.warn('HA sync failed (silent)', e)
    return false
  }
}

/** Pull data from HA sensor state */
export async function pullFromHA(): Promise<AppData | null> {
  const user = getCurrentUser()
  if (user.id === 'local') return null

  const hass = getHass()
  if (!hass) return null

  try {
    const entityId = `${SYNC_ENTITY_BASE}_${user.id}`
    const state = await hass.callApi('GET', `/api/states/${entityId}`)
    if (state?.attributes?.data) {
      return JSON.parse(state.attributes.data) as AppData
    }
  } catch { /* not found — first use */ }
  return null
}

// ─── Main Storage ──────────────────────────────────────

export async function loadDataAsync(): Promise<AppData> {
  // Try HA cloud first
  const cloud = await pullFromHA()
  if (cloud) {
    // Sync to localStorage
    const key = getStorageKey()
    localStorage.setItem(key, JSON.stringify(cloud))
    return cloud
  }
  return loadData()
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

export async function saveDataAsync(data: AppData): Promise<void> {
  saveData(data)
  // Fire-and-forget HA sync
  pushToHA(data).then(synced => {
    if (synced) console.log('HA cloud sync OK')
  })
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
