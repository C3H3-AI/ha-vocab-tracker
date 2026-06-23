<script setup lang="ts">
import { computed } from 'vue'
import type { AppData } from '../types/vocab'
import { REVIEW_INTERVALS } from '../utils/ebbinghaus'

const props = defineProps<{ appData: AppData }>()

const streakDays = computed(() => props.appData.streakDays)

const totalLearned = computed(() => props.appData.totalLearned)

const totalWords = computed(() => Object.keys(props.appData.records).length)

const todayStart = computed(() => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
})

const todayReviewed = computed(() => {
  const start = todayStart.value
  return Object.values(props.appData.records).filter(r => r.lastReview >= start).length
})

const todayCompletionRate = computed(() => {
  if (totalWords.value === 0) return 0
  return Math.round((todayReviewed.value / totalWords.value) * 100)
})

const planProgress = computed(() => {
  return Math.min(100, Math.round((props.appData.currentDay / 48) * 100))
})

interface RoundStat {
  label: string
  completed: number
  inProgress: number
  pending: number
  total: number
}

const roundStatuses = computed<RoundStat[]>(() => {
  const records = Object.values(props.appData.records)
  return REVIEW_INTERVALS.map((_, i) => {
    const round = i + 1
    const completed = records.filter(r => r.reviewCount > round || r.status === 'mastered').length
    const inProgress = records.filter(r => r.reviewCount === round && r.status !== 'mastered').length
    const pending = records.filter(r => r.reviewCount < round && r.status !== 'mastered').length
    const total = records.length
    return { label: `R${round}`, completed, inProgress, pending, total }
  })
})
</script>

<template>
  <div class="stats-dashboard">
    <h2>统计看板</h2>

    <div class="cards-grid">
      <!-- Streak Days -->
      <div class="stat-card">
        <div class="card-icon">🔥</div>
        <div class="card-value">{{ streakDays }}</div>
        <div class="card-label">连续打卡天数</div>
      </div>

      <!-- Total Vocabulary -->
      <div class="stat-card">
        <div class="card-icon">📚</div>
        <div class="card-value">{{ totalLearned }}</div>
        <div class="card-label">累计词汇量</div>
      </div>

      <!-- Today Completion Rate -->
      <div class="stat-card">
        <div class="card-icon">✅</div>
        <div class="card-value">{{ todayCompletionRate }}%</div>
        <div class="card-label">今日完成率 ({{ todayReviewed }}/{{ totalWords }})</div>
      </div>
    </div>

    <!-- Plan Progress -->
    <div class="section-card">
      <div class="section-title">48天计划进度</div>
      <div class="plan-bar">
        <div class="plan-fill" :style="{ width: planProgress + '%' }"></div>
        <span class="plan-text">{{ props.appData.currentDay }} / 48 天</span>
      </div>
    </div>

    <!-- Ebbinghaus Rounds -->
    <div class="section-card">
      <div class="section-title">艾宾浩斯复习轮次</div>
      <div class="rounds-grid">
        <div v-for="rs in roundStatuses" :key="rs.label" class="round-item">
          <div class="round-label">{{ rs.label }}</div>
          <div class="round-bar">
            <div
              class="round-segment completed"
              :style="{ width: (rs.total > 0 ? (rs.completed / rs.total) * 100 : 0) + '%' }"
              :title="`已完成: ${rs.completed}`"
            ></div>
            <div
              class="round-segment in-progress"
              :style="{ width: (rs.total > 0 ? (rs.inProgress / rs.total) * 100 : 0) + '%' }"
              :title="`进行中: ${rs.inProgress}`"
            ></div>
          </div>
          <div class="round-stats">
            <span class="stat-dot done">{{ rs.completed }}</span>
            <span class="stat-dot doing">{{ rs.inProgress }}</span>
            <span class="stat-dot todo">{{ rs.pending }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-dashboard {
  padding: 16px;
}
.stats-dashboard h2 {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0 0 16px;
}
.cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}
.stat-card {
  background: white;
  border-radius: 12px;
  padding: 16px 12px;
  text-align: center;
  border: 0.5px solid #e8e8e8;
}
.card-icon {
  font-size: 24px;
  margin-bottom: 4px;
}
.card-value {
  font-size: 28px;
  font-weight: 700;
  color: #378ADD;
}
.card-label {
  font-size: 12px;
  color: #888;
  margin-top: 2px;
}
.section-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  border: 0.5px solid #e8e8e8;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #555;
  margin-bottom: 12px;
}
.plan-bar {
  position: relative;
  height: 28px;
  background: #e8e8e8;
  border-radius: 14px;
  overflow: hidden;
}
.plan-fill {
  height: 100%;
  background: linear-gradient(90deg, #378ADD, #1D9E75);
  border-radius: 14px;
  transition: width 0.5s;
}
.plan-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}
.rounds-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.round-item {
  display: flex;
  align-items: center;
  gap: 10px;
}
.round-label {
  font-size: 12px;
  font-weight: 600;
  color: #555;
  min-width: 24px;
}
.round-bar {
  flex: 1;
  height: 8px;
  background: #e8e8e8;
  border-radius: 4px;
  overflow: hidden;
  display: flex;
}
.round-segment {
  height: 100%;
  transition: width 0.3s;
}
.round-segment.completed {
  background: #1D9E75;
}
.round-segment.in-progress {
  background: #F5A623;
}
.round-stats {
  display: flex;
  gap: 4px;
  min-width: 60px;
  justify-content: flex-end;
}
.stat-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 600;
  color: white;
}
.stat-dot.done {
  background: #1D9E75;
}
.stat-dot.doing {
  background: #F5A623;
}
.stat-dot.todo {
  background: #ccc;
}
</style>
