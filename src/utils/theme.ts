/**
 * 主题检测：自动适配 HA 暗色/亮色模式
 */

export type ThemeMode = 'light' | 'dark' | 'auto'

let currentMode: ThemeMode = 'auto'
let currentTheme: 'light' | 'dark' = 'light'
const listeners: Array<(theme: 'light' | 'dark') => void> = []

/** 从 HA parent window 检测主题 */
function detectHATheme(): 'light' | 'dark' {
  try {
    const parent = window.parent
    const hass = (parent as any)?.hass
    if (hass?.themes?.darkMode !== undefined) {
      return hass.themes.darkMode ? 'dark' : 'light'
    }
    // Fallback: check background color
    const bg = getComputedStyle(parent.document.body).backgroundColor
    const rgb = bg.match(/\d+/g)
    if (rgb) {
      const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000
      return brightness < 128 ? 'dark' : 'light'
    }
  } catch {
    // Cross-origin
  }
  return 'light'
}

/** 检测系统偏好 */
function detectSystemTheme(): 'light' | 'dark' {
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

/** 获取当前主题 */
export function getTheme(): 'light' | 'dark' {
  if (currentMode === 'dark') return 'dark'
  if (currentMode === 'light') return 'light'
  // auto
  const ha = detectHATheme()
  if (ha) return ha
  return detectSystemTheme()
}

/** 应用 CSS 变量到根元素 */
export function applyTheme(theme: 'light' | 'dark'): void {
  currentTheme = theme
  const root = document.documentElement
  root.setAttribute('data-theme', theme)

  if (theme === 'dark') {
    root.style.setProperty('--bg-primary', '#1a1a2e')
    root.style.setProperty('--bg-secondary', '#16213e')
    root.style.setProperty('--bg-card', '#1e2a45')
    root.style.setProperty('--bg-hover', '#2a3a5c')
    root.style.setProperty('--text-primary', '#e0e0e0')
    root.style.setProperty('--text-secondary', '#a0a0b0')
    root.style.setProperty('--text-muted', '#6b7280')
    root.style.setProperty('--border-color', '#2d3748')
    root.style.setProperty('--accent', '#4a90d9')
    root.style.setProperty('--accent-light', '#3a7bc8')
    root.style.setProperty('--accent-bg', '#1a365d')
    root.style.setProperty('--shadow', '0 2px 8px rgba(0,0,0,0.3)')
    root.style.setProperty('--success', '#4ade80')
    root.style.setProperty('--warning', '#fbbf24')
    root.style.setProperty('--danger', '#f87171')
  } else {
    root.style.setProperty('--bg-primary', '#f5f5f5')
    root.style.setProperty('--bg-secondary', '#ffffff')
    root.style.setProperty('--bg-card', '#ffffff')
    root.style.setProperty('--bg-hover', '#f8f9fa')
    root.style.setProperty('--text-primary', '#2c3e50')
    root.style.setProperty('--text-secondary', '#555555')
    root.style.setProperty('--text-muted', '#999999')
    root.style.setProperty('--border-color', '#e8e8e8')
    root.style.setProperty('--accent', '#4a90d9')
    root.style.setProperty('--accent-light', '#357abd')
    root.style.setProperty('--accent-bg', '#f0f7ff')
    root.style.setProperty('--shadow', '0 2px 8px rgba(0,0,0,0.08)')
    root.style.setProperty('--success', '#52c41a')
    root.style.setProperty('--warning', '#faad14')
    root.style.setProperty('--danger', '#ff4d4f')
  }

  listeners.forEach(fn => fn(theme))
}

/** 初始化和监听主题变化 */
export function initTheme(mode: ThemeMode = 'auto'): void {
  currentMode = mode
  applyTheme(getTheme())

  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (currentMode === 'auto') {
      applyTheme(getTheme())
    }
  })

  // 定时检测 HA 主题（HA 可能动态切换）
  setInterval(() => {
    const newTheme = getTheme()
    if (newTheme !== currentTheme) {
      applyTheme(newTheme)
    }
  }, 3000)
}

/** 切换主题模式 */
export function setThemeMode(mode: ThemeMode): void {
  currentMode = mode
  applyTheme(getTheme())
}

/** 获取当前主题模式 */
export function getThemeMode(): ThemeMode {
  return currentMode
}

/** 注册主题变化监听 */
export function onThemeChange(fn: (theme: 'light' | 'dark') => void): () => void {
  listeners.push(fn)
  return () => {
    const idx = listeners.indexOf(fn)
    if (idx >= 0) listeners.splice(idx, 1)
  }
}
