/**
 * IndexedDB 词库缓存
 * 减少重复网络请求，支持离线加载
 */

const DB_NAME = 'vocab-tracker'
const DB_VERSION = 1
const STORE_NAME = 'wordbanks'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export interface CachedBank {
  id: string
  data: any[]
  timestamp: number
  ttl: number // 缓存有效期(ms), 默认 24h
}

const DEFAULT_TTL = 24 * 60 * 60 * 1000

/** 从 IndexedDB 获取缓存的词库 */
export async function getCachedBank(id: string): Promise<any[] | null> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(id)

    const result = await new Promise<CachedBank | undefined>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    db.close()

    if (result && Date.now() - result.timestamp < result.ttl) {
      return result.data
    }
    return null
  } catch (e) {
    console.warn('IndexedDB read failed', e)
    return null
  }
}

/** 缓存词库到 IndexedDB */
export async function setCachedBank(id: string, data: any[], ttl?: number): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put({
      id,
      data,
      timestamp: Date.now(),
      ttl: ttl || DEFAULT_TTL
    })
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch (e) {
    console.warn('IndexedDB write failed', e)
  }
}

/** 清除所有缓存 */
export async function clearBankCache(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch (e) {
    console.warn('IndexedDB clear failed', e)
  }
}

/** 获取缓存统计 */
export async function getCacheStats(): Promise<{ count: number; size: number }> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.getAll()

    const items = await new Promise<CachedBank[]>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    db.close()

    return {
      count: items.length,
      size: items.reduce((s, i) => s + new Blob([JSON.stringify(i.data)]).size, 0)
    }
  } catch {
    return { count: 0, size: 0 }
  }
}
