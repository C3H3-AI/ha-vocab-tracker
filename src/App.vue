<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { loadData, saveData, type AppData } from './utils/storage'
import DailyStudy from './components/DailyStudy.vue'
import ReviewSession from './components/ReviewSession.vue'
import VocabBrowser from './components/VocabBrowser.vue'
import StatsDashboard from './components/StatsDashboard.vue'
import PrintPanel from './components/PrintPanel.vue'

const activeTab = ref('study')
const appData = ref<AppData>(loadData())

const tabs = [
  { id: 'study', label: '📖 学习', icon: 'mdi:book-open-variant' },
  { id: 'review', label: '🔄 复习', icon: 'mdi:repeat' },
  { id: 'browse', label: '📚 词库', icon: 'mdi:bookshelf' },
  { id: 'stats', label: '📊 统计', icon: 'mdi:chart-bar' },
  { id: 'print', label: '🖨️ 打印', icon: 'mdi:printer' },
]

function onDataUpdate(data: AppData) {
  appData.value = data
  saveData(data)
}

function getDayProgress(): number {
  const total = appData.value.totalLearned
  const target = 2400
  return Math.min(100, Math.round(total / target * 100))
}
</script>

<template>
  <div class="app-container">
    <!-- Header -->
    <header class="app-header no-print">
      <div class="header-top">
        <h1>📚 词汇学习</h1>
        <span class="day-badge">Day {{ appData.currentDay }} / 48</span>
      </div>
      <div class="header-progress">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: getDayProgress() + '%' }"></div>
        </div>
        <span class="progress-label">{{ appData.totalLearned }} / 2400 词</span>
      </div>
      <div class="header-streak" v-if="appData.streakDays > 0">
        🔥 连续 {{ appData.streakDays }} 天
      </div>
    </header>

    <!-- Content -->
    <main class="app-content">
      <DailyStudy v-if="activeTab === 'study'" :appData="appData" @update="onDataUpdate" />
      <ReviewSession v-else-if="activeTab === 'review'" :appData="appData" @update="onDataUpdate" />
      <VocabBrowser v-else-if="activeTab === 'browse'" />
      <StatsDashboard v-else-if="activeTab === 'stats'" :appData="appData" />
      <PrintPanel v-else-if="activeTab === 'print'" :appData="appData" />
    </main>

    <!-- Bottom Nav -->
    <nav class="bottom-nav no-print">
      <button v-for="t in tabs" :key="t.id"
        :class="['nav-btn', { active: activeTab === t.id }]"
        @click="activeTab = t.id">
        <span class="nav-icon">{{ t.label.split(' ')[0] }}</span>
        <span class="nav-label">{{ t.label.split(' ').slice(1).join(' ') }}</span>
      </button>
    </nav>
  </div>
</template>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
  color: #333;
  font-size: 14px;
  line-height: 1.5;
}
@media print {
  .no-print { display: none !important; }
  body { background: white; }
}
.app-container {
  max-width: 960px;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.app-header {
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
.day-badge {
  background: #378ADD;
  color: white;
  padding: 3px 12px;
  border-radius: 12px;
  font-size: 12px;
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
.app-content {
  flex: 1;
  padding: 12px 16px;
  padding-bottom: 70px;
}
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
  max-width: 960px;
  margin: 0 auto;
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
</style>
