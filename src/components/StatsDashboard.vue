<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { loadData, saveData } from '../utils/storage'
import { DEFAULT_INTERVALS, getIntervals, setIntervals, resetIntervals, loadIntervalsFromData } from '../utils/ebbinghaus'
import StudyHeatmap from './StudyHeatmap.vue'

const props = defineProps<{ appData: any }>()

const data = ref(props.appData)

const TOTAL_DAYS = 48
const WORDS_PER_DAY = 50

const completionRate = computed(() => {
  if (data.value.currentDay <= 1) return 0
  return Math.round(((data.value.currentDay - 1) / TOTAL_DAYS) * 100)
})

const todayRate = computed(() => {
  if (data.value.lastCheckin === new Date().toISOString().split('T')[0]) {
    return 100
  }
  return 0
})

const weeklyRate = computed(() => {
  return Math.round((data.value.streakDays / 7) * 100)
})

const reviewRoundStats = computed(() => {
  const rounds = BASE_INTERVALS.map((interval, i) => {
    const count = Object.values(data.value.records).filter(
      (r) => r.reviewCount === i || (r.reviewCount > i && i === BASE_INTERVALS.length - 1)
    ).length
    return {
      round: i + 1,
      interval: interval,
      count: count,
      label: `第${i + 1}轮 (${interval}天后)`
    }
  })
  return rounds
})

const masteredCount = computed(() => {
  return Object.values(data.value.records).filter((r) => r.status === 'mastered').length
})

const learningCount = computed(() => {
  return Object.values(data.value.records).filter((r) => r.status === 'learning').length
})

const reviewCount = computed(() => {
  return Object.values(data.value.records).filter((r) => r.status === 'review').length
})

const recordsTotal = computed(() => data.value.totalLearned)
const masteredPercent = computed(() => 
  recordsTotal.value > 0 ? Math.round((masteredCount.value / recordsTotal.value) * 100) : 0
)

function formatDate(dateStr: string): string {
  if (!dateStr) return '从未'
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function handleReset() {
  if (confirm('确定要重置所有学习数据吗？此操作不可撤销。')) {
    localStorage.removeItem('ha-vocab-tracker')
    data.value = {
      currentDay: 1,
      records: {},
      streakDays: 0,
      totalLearned: 0,
      lastCheckin: '',
      startedAt: new Date().toISOString(),
      dailyMinutes: {},
      wrongWords: {}
    }
  }
}
</script>

<template>
  <div class="stats-dashboard">
    <div class="stats-header">
      <h2>学习统计</h2>
      <span class="stats-subtitle">第 {{ data.currentDay }} 天 / {{ TOTAL_DAYS }} 天</span>
    </div>

    <!-- Top Stats Row -->
    <div class="stats-row">
      <div class="stat-card streak">
    <div class="stat-value">{{ data.streakDays }}</div>
    <div class="stat-label">连续天数</div>
      </div>
      <div class="stat-card total">
        <div class="stat-value">{{ data.totalLearned }}</div>
        <div class="stat-label">累计词汇</div>
      </div>
      <div class="stat-card today">
        <div class="stat-value">{{ todayRate }}%</div>
        <div class="stat-label">今日完成</div>
      </div>
      <div class="stat-card mastered">
        <div class="stat-value">{{ masteredPercent }}%</div>
        <div class="stat-label">掌握率</div>
      </div>
    </div>

    <!-- Progress & Status (desktop side-by-side) -->
    <div class="stats-grid-2col">
      <div class="progress-card">
        <div class="progress-header">
          <h3>计划进度</h3>
          <span class="progress-percent">{{ completionRate }}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: completionRate + '%' }"></div>
        </div>
        <div class="progress-detail">
          <span>已完成 {{ Math.max(0, data.currentDay - 1) }} / {{ TOTAL_DAYS }} 天</span>
          <span>每日 {{ WORDS_PER_DAY }} 词</span>
        </div>
      </div>

      <div class="progress-card">
        <div class="progress-header">
          <h3>词汇状态分布</h3>
        </div>
        <div class="status-chart">
          <div class="status-bar">
            <div
              class="status-segment mastered"
              :style="{ width: (masteredCount / Math.max(1, recordsTotal)) * 100 + '%' }"
            ></div>
            <div
              class="status-segment review"
              :style="{ width: (reviewCount / Math.max(1, recordsTotal)) * 100 + '%' }"
            ></div>
            <div
              class="status-segment learning"
              :style="{ width: (learningCount / Math.max(1, recordsTotal)) * 100 + '%' }"
            ></div>
          </div>
          <div class="status-legend">
            <span><span class="dot mastered"></span> 已掌握 {{ masteredCount }}</span>
            <span><span class="dot review"></span> 复习中 {{ reviewCount }}</span>
            <span><span class="dot learning"></span> 学习中 {{ learningCount }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Memory Curve -->
    <div class="progress-card">
      <div class="progress-header">
        <h3>记忆曲线 - 各轮次词汇量</h3>
        <span class="progress-subtitle">6 轮间隔复习</span>
      </div>
      <div class="rounds-chart">
        <div v-for="(rs, i) in reviewRoundStats" :key="i" class="round-item">
          <div class="round-label">{{ rs.label }}</div>
          <div class="round-bar-bg">
            <div
              class="round-bar-fill"
              :style="{ width: Math.min(100, (rs.count / 100) * 100) + '%' }"
            ></div>
          </div>
          <div class="round-count">{{ rs.count }}</div>
        </div>
      </div>
    </div>

    <!-- Study Heatmap -->
    <StudyHeatmap :dailyMinutes="data.dailyMinutes || {}" />

    <!-- Ebbinghaus Settings -->
    <div class="settings-section">
      <button class="btn-settings" @click="showSettings = !showSettings">
        ⚙️ 艾宾浩斯间隔设置
        <span class="toggle-arrow">{{ showSettings ? '▲' : '▼' }}</span>
      </button>

      <div v-if="showSettings" class="settings-body">
        <p class="settings-desc">设置复习间隔天数（每轮逐渐增长，至少 3 轮）</p>
        <div class="interval-list">
          <div v-for="(v, i) in intervalInputs" :key="i" class="interval-row">
            <span class="interval-label">第 {{ i + 1 }} 轮</span>
            <input type="number" v-model.number="intervalInputs[i]" min="1" max="90" class="interval-input" />
            <span class="interval-unit">天</span>
            <button v-if="i === intervalInputs.length - 1" class="btn-add" @click="intervalInputs.push(7)">+</button>
            <button v-if="intervalInputs.length > 3" class="btn-remove" @click="intervalInputs.splice(i, 1)">✕</button>
          </div>
        </div>
        <div class="settings-actions">
          <button class="btn-save" @click="saveIntervals()">保存</button>
          <button class="btn-reset-small" @click="resetToDefault()">恢复默认</button>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="info-row">
      <span class="last-checkin">
        上次打卡：{{ formatDate(data.lastCheckin) }}
      </span>
      <button class="btn-reset" @click="handleReset">重置数据</button>
    </div>
  </div>
</template>

<style scoped>
.stats-dashboard {
  padding: 0;
}
.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 4px;
}
.stats-header h2 {
  margin: 0;
  font-size: 20px;
  color: #2c3e50;
}
.stats-subtitle {
  font-size: 13px;
  color: #999;
}

/* Top Stats Row - auto grid, responsive */
.stats-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}
@media (min-width: 480px) {
  .stats-row {
    grid-template-columns: repeat(4, 1fr);
  }
}
.stat-card {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  padding: 16px 10px;
  text-align: center;
}
.stat-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}
@media (min-width: 480px) {
  .stat-value { font-size: 32px; }
}
.stat-label {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}
.stat-card.streak .stat-value { color: #f5a623; }
.stat-card.total .stat-value { color: #4a90d9; }
.stat-card.today .stat-value { color: #52c41a; }
.stat-card.mastered .stat-value { color: #1D9E75; }

/* 2-col grid for desktop */
.stats-grid-2col {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-bottom: 12px;
}
@media (min-width: 600px) {
  .stats-grid-2col {
    grid-template-columns: 1fr 1fr;
  }
}

/* Cards */
.progress-card {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 12px;
}
.progress-card h3 {
  margin: 0;
  font-size: 15px;
  color: #333;
}
.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.progress-percent {
  font-size: 18px;
  font-weight: 600;
  color: #4a90d9;
}
.progress-subtitle {
  font-size: 12px;
  color: #aaa;
}

.progress-bar {
  height: 10px;
  background: #f0f0f0;
  border-radius: 5px;
  overflow: hidden;
  margin-bottom: 8px;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #f5a623, #f7c948);
  border-radius: 5px;
  transition: width 0.3s;
}
.progress-fill.blue {
  background: linear-gradient(90deg, #4a90d9, #67b8f7);
}
.progress-detail {
  display: flex;
  justify-content: space-between;
  color: #999;
  font-size: 12px;
}

/* Status Chart */
.status-bar {
  display: flex;
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 10px;
}
.status-segment.mastered { background: #52c41a; }
.status-segment.review { background: #4a90d9; }
.status-segment.learning { background: #faad14; }
.status-legend {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #666;
  flex-wrap: wrap;
}
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
}
.dot.mastered { background: #52c41a; }
.dot.review { background: #4a90d9; }
.dot.learning { background: #faad14; }

/* Rounds Chart */
.rounds-chart {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.round-item {
  display: flex;
  align-items: center;
  gap: 10px;
}
.round-label {
  min-width: 90px;
  font-size: 12px;
  color: #666;
  flex-shrink: 0;
}
@media (min-width: 480px) {
  .round-label { min-width: 120px; font-size: 13px; }
}
.round-bar-bg {
  flex: 1;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}
.round-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #4a90d9, #67b8f7);
  border-radius: 4px;
  transition: width 0.3s;
}
.round-count {
  min-width: 30px;
  text-align: right;
  font-size: 12px;
  color: #999;
}

/* Info Row */
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  flex-wrap: wrap;
  gap: 8px;
}
.last-checkin {
  font-size: 13px;
  color: #999;
}
.btn-reset {
  padding: 6px 16px;
  border: 1px solid #ff4d4f;
  border-radius: 4px;
  background: #fff;
  color: #ff4d4f;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-reset:hover {
  background: #fff2f0;
}

/* Settings Section */
.settings-section {
  margin-bottom: 20px;
}
.btn-settings {
  width: 100%;
  padding: 12px 16px;
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #555;
  transition: all 0.15s;
}
.btn-settings:hover {
  border-color: #4a90d9;
  color: #4a90d9;
}
.toggle-arrow {
  font-size: 12px;
  color: #999;
}
.settings-body {
  margin-top: 10px;
  padding: 16px;
  background: #fafbfc;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
}
.settings-desc {
  font-size: 12px;
  color: #888;
  margin-bottom: 12px;
}
.interval-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}
.interval-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.interval-label {
  font-size: 13px;
  color: #555;
  min-width: 60px;
}
.interval-input {
  width: 60px;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  text-align: center;
}
.interval-unit {
  font-size: 12px;
  color: #999;
}
.btn-add {
  padding: 2px 8px;
  border: 1px solid #52c41a;
  border-radius: 4px;
  background: white;
  color: #52c41a;
  font-size: 14px;
  cursor: pointer;
}
.btn-remove {
  padding: 2px 6px;
  border: 1px solid #ff4d4f;
  border-radius: 4px;
  background: white;
  color: #ff4d4f;
  font-size: 12px;
  cursor: pointer;
}
.settings-actions {
  display: flex;
  gap: 10px;
}
.btn-save {
  flex: 1;
  padding: 10px;
  background: #4a90d9;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}
.btn-save:hover { background: #357abd; }
.btn-reset-small {
  padding: 10px 16px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
}
.btn-reset-small:hover { border-color: #999; }
</style>
