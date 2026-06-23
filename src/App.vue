<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { loadData, saveData, getCurrentUser, getBookProgress, saveBookProgress } from './utils/storage'
import { loadWordBank, getBookById } from './utils/wordbank'
import { getDueCount } from './utils/ebbinghaus'
import type { AppData, BookProgress } from './types/vocab'
import DailyStudy from './components/DailyStudy.vue'
import ReviewSession from './components/ReviewSession.vue'
import VocabBrowser from './components/VocabBrowser.vue'
import StatsDashboard from './components/StatsDashboard.vue'
import PrintPanel from './components/PrintPanel.vue'
import WordBookPicker from './components/WordBookPicker.vue'
import WrongWords from './components/WrongWords.vue'
import TestPanel from './components/TestPanel.vue'

const activeTab = ref('study')
const appData = ref<AppData>(loadData())
const user = getCurrentUser()
const isMobile = ref(true)
const wordBankLoaded = ref(false)

function checkScreenSize() {
  isMobile.value = window.innerWidth <= 768
}

onMounted(() => {
  checkScreenSize()
  window.addEventListener('resize', checkScreenSize)
  loadCurrentBook()
})

// Current book progress
const currentBookId = computed(() => appData.value.currentWordBook)
const currentBookMeta = computed(() => getBookById(currentBookId.value))

// Flatten book progress for children components (backward compatible)
const bookProgress = computed(() => getBookProgress(appData.value, currentBookId.value))

// Child-friendly appData (maps book-specific data to old structure)
const childAppData = computed(() => ({
  ...bookProgress.value,
  totalLearned: Object.keys(bookProgress.value.records).length,
  dailyMinutes: appData.value.dailyMinutes || {},
  wrongWords: appData.value.wrongWords || {}
}))

async function loadCurrentBook() {
  wordBankLoaded.value = false
  try {
    const words = await loadWordBank(currentBookId.value)
    wordBankLoaded.value = true
    // Cache in window for performance
    ;(window as any).__currentWordBank = words
  } catch (e) {
    console.warn('Failed to load word bank', e)
    wordBankLoaded.value = true
  }
}

async function switchBook(bookId: string) {
  if (bookId === currentBookId.value) return
  appData.value.currentWordBook = bookId
  saveData(appData.value)
  await loadCurrentBook()
  activeTab.value = 'study'
}

function onDataUpdate(data: any) {
  // Map back from child component's flat structure to book-specific
  const progress = getBookProgress(appData.value, currentBookId.value)
  progress.currentDay = data.currentDay || progress.currentDay
  progress.records = data.records || progress.records
  progress.streakDays = data.streakDays || progress.streakDays
  progress.lastCheckin = data.lastCheckin || progress.lastCheckin
  
  appData.value.dailyMinutes = data.dailyMinutes || appData.value.dailyMinutes
  
  if (data.wrongWords) {
    appData.value.wrongWords = data.wrongWords
  }
  
  saveData(appData.value)
}

function getDayProgress(): number {
  const meta = currentBookMeta.value
  if (!meta) return 0
  const total = bookProgress.value.totalLearned
  const target = meta.wordCount
  return Math.min(100, Math.round(total / target * 100))
}

const tabs = [
  { id: 'study', label: '学习', icon: '📖' },
  { id: 'review', label: '复习', icon: '🔄' },
  { id: 'test', label: '测试', icon: '📝' },
  { id: 'wrong', label: '错词本', icon: '📕' },
  { id: 'browse', label: '词库', icon: '📚' },
  { id: 'stats', label: '统计', icon: '📊' },
  { id: 'books', label: '单词书', icon: '📚' },
  { id: 'print', label: '打印', icon: '🖨️' },
]
</script>

<template>
  <div class="app-container" :class="{ 'is-mobile': isMobile }">
    <!-- Desktop Sidebar -->
    <aside class="desktop-sidebar" v-if="!isMobile">
      <div class="sidebar-header">
        <h1 class="sidebar-logo">📚 词汇学习</h1>
        <div class="sidebar-user">
          <span class="user-avatar">{{ user.name.charAt(0) }}</span>
          <div class="user-info">
            <span class="user-name">{{ user.name }}</span>
            <span class="user-badge">{{ user.id === 'local' ? '本地' : 'HA' }}</span>
          </div>
        </div>
      </div>

      <!-- Current book badge -->
      <div class="sidebar-book" v-if="currentBookMeta">
        <span class="book-dot" :style="{ background: currentBookMeta.color }"></span>
        <span class="book-name">{{ currentBookMeta.name }}</span>
      </div>

      <nav class="sidebar-nav">
        <button v-for="t in tabs" :key="t.id"
          :class="['sidebar-btn', { active: activeTab === t.id }]"
          @click="activeTab = t.id">
          <span class="sidebar-icon">{{ t.icon }}</span>
          <span class="sidebar-label">{{ t.label }}</span>
          <span v-if="t.id === 'review'" class="sidebar-count">
            {{ getDueCount(bookProgress.records) }}
          </span>
        </button>
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-day">Day {{ bookProgress.currentDay }}</div>
        <div class="sidebar-progress">
          <div class="sidebar-progress-bar">
            <div class="sidebar-progress-fill" :style="{ width: getDayProgress() + '%' }"></div>
          </div>
          <span class="sidebar-progress-label">{{ getDayProgress() }}%</span>
        </div>
        <div v-if="bookProgress.streakDays > 0" class="sidebar-streak">🔥 {{ bookProgress.streakDays }} 天</div>
      </div>
    </aside>

    <!-- Main Content Area -->
    <div class="main-area">
      <!-- Mobile Header -->
      <header class="mobile-header" v-if="isMobile">
        <div class="header-top">
          <h1>📚 词汇学习</h1>
          <div class="header-top-right">
            <span class="user-chip">{{ user.name }}</span>
            <span class="book-chip" v-if="currentBookMeta" :style="{ background: currentBookMeta.color }">
              {{ currentBookMeta.name }}
            </span>
          </div>
        </div>
        <div class="header-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: getDayProgress() + '%' }"></div>
          </div>
          <span class="progress-label">Day {{ bookProgress.currentDay }}</span>
        </div>
        <div class="header-streak" v-if="bookProgress.streakDays > 0">
          🔥 连续 {{ bookProgress.streakDays }} 天
        </div>
      </header>

      <!-- Content -->
      <main class="app-content">
        <DailyStudy
          v-if="activeTab === 'study'"
          :appData="childAppData"
          :bookId="currentBookId"
          @update="onDataUpdate"
        />
        <ReviewSession
          v-else-if="activeTab === 'review'"
          :appData="childAppData"
          :bookId="currentBookId"
          @update="onDataUpdate"
        />
        <TestPanel
          v-else-if="activeTab === 'test'"
          :appData="childAppData"
          :bookId="currentBookId"
          @update="onDataUpdate"
        />
        <VocabBrowser v-else-if="activeTab === 'browse'" />
        <WrongWords v-else-if="activeTab === 'wrong'" />
        <StatsDashboard
          v-else-if="activeTab === 'stats'"
          :appData="childAppData"
        />
        <WordBookPicker
          v-else-if="activeTab === 'books'"
          :appData="appData"
          @switchBook="switchBook"
        />
        <PrintPanel v-else-if="activeTab === 'print'" :appData="childAppData" />
      </main>

      <!-- Mobile Bottom Nav -->
      <nav class="bottom-nav" v-if="isMobile">
        <button v-for="t in tabs" :key="t.id"
          :class="['nav-btn', { active: activeTab === t.id }]"
          @click="activeTab = t.id">
          <span class="nav-icon">{{ t.icon }}</span>
          <span class="nav-label">{{ t.label }}</span>
        </button>
      </nav>
    </div>
  </div>
</template>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', Roboto, 'Helvetica Neue', sans-serif;
  background: #f5f5f5;
  color: #333;
  font-size: 14px;
  line-height: 1.5;
}
@media print {
  .desktop-sidebar, .bottom-nav, .mobile-header { display: none !important; }
  body { background: white; }
}

.app-container {
  display: flex;
  min-height: 100vh;
}

/* Desktop Sidebar */
.desktop-sidebar {
  width: 220px;
  min-width: 220px;
  background: #1a2332;
  color: #c8d0da;
  display: flex;
  flex-direction: column;
  padding: 20px 0;
  position: sticky;
  top: 0;
  height: 100vh;
}
.sidebar-header {
  padding: 0 16px 16px;
  border-bottom: 0.5px solid rgba(255,255,255,0.1);
}
.sidebar-logo {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 12px;
}
.sidebar-user {
  display: flex;
  align-items: center;
  gap: 10px;
}
.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #378ADD;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
}
.user-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.user-name {
  font-size: 13px;
  color: #e8ecf1;
  font-weight: 500;
}
.user-badge {
  font-size: 10px;
  color: #8896a8;
}

/* Sidebar current book */
.sidebar-book {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 0.5px solid rgba(255,255,255,0.06);
  font-size: 13px;
  color: #8896a8;
}
.book-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.sidebar-book .book-name {
  color: #c8d0da;
}

.sidebar-nav {
  flex: 1;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sidebar-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: #8896a8;
  font-size: 14px;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.15s;
  text-align: left;
}
.sidebar-btn:hover {
  background: rgba(255,255,255,0.06);
  color: #c8d0da;
}
.sidebar-btn.active {
  background: #378ADD;
  color: #fff;
}
.sidebar-icon { font-size: 16px; }
.sidebar-label { flex: 1; }
.sidebar-count {
  background: rgba(255,255,255,0.15);
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11px;
}

.sidebar-footer {
  padding: 16px;
  border-top: 0.5px solid rgba(255,255,255,0.1);
}
.sidebar-day {
  font-size: 12px;
  color: #8896a8;
  margin-bottom: 8px;
}
.sidebar-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sidebar-progress-bar {
  flex: 1;
  height: 4px;
  background: rgba(255,255,255,0.1);
  border-radius: 2px;
  overflow: hidden;
}
.sidebar-progress-fill {
  height: 100%;
  background: #1D9E75;
  border-radius: 2px;
  transition: width 0.3s;
}
.sidebar-progress-label {
  font-size: 11px;
  color: #8896a8;
  min-width: 30px;
  text-align: right;
}
.sidebar-streak {
  margin-top: 8px;
  font-size: 12px;
  color: #f5a623;
}

/* Main Area */
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Mobile Header */
.mobile-header {
  background: white;
  border-bottom: 0.5px solid #e0e0e0;
  padding: 12px 16px;
  position: sticky;
  top: 0;
  z-index: 10;
}
.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.header-top h1 {
  font-size: 18px;
  font-weight: 600;
}
.header-top-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.user-chip {
  background: #f0f4f8;
  color: #378ADD;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}
.book-chip {
  color: white;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}
.header-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}
.progress-bar {
  flex: 1;
  height: 6px;
  background: #e8e8e8;
  border-radius: 3px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: #1D9E75;
  border-radius: 3px;
  transition: width 0.3s;
}
.progress-label {
  font-size: 12px;
  color: #888;
  white-space: nowrap;
}
.header-streak {
  font-size: 13px;
  color: #D85A30;
  margin-top: 4px;
  font-weight: 500;
}

/* Content */
.app-content {
  flex: 1;
  padding: 16px;
  max-width: 100%;
}
.app-container.is-mobile .app-content {
  padding: 12px;
  padding-bottom: 70px;
}

/* Mobile Bottom Nav */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  border-top: 0.5px solid #e0e0e0;
  display: flex;
  justify-content: space-around;
  padding: 6px 0;
  z-index: 10;
}
.nav-btn {
  flex: 1;
  border: none;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 0;
  cursor: pointer;
  color: #999;
  font-size: 11px;
  transition: color 0.2s;
}
.nav-btn.active {
  color: #378ADD;
}
.nav-btn .nav-icon { font-size: 18px; }
.nav-btn .nav-label { font-size: 10px; }

@media (min-width: 769px) {
  .app-content {
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
  }
}
</style>
