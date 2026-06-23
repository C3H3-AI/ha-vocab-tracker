<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ dailyMinutes: Record<string, number> }>()

// Generate the last 365 days
const today = new Date()
const days = computed(() => {
  const result: Array<{ date: string; count: number; day: number; month: string }> = []
  for (let i = 363; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const count = props.dailyMinutes?.[dateStr] || 0
    result.push({
      date: dateStr,
      count,
      day: d.getDate(),
      month: i % 30 === 0 || i === 0 ? `${d.getMonth() + 1}月` : ''
    })
  }
  return result
})

/** Returns color intensity based on study time */
function getColorClass(count: number): string {
  if (count <= 0) return 'level-0'
  if (count < 15) return 'level-1'
  if (count < 30) return 'level-2'
  if (count < 60) return 'level-3'
  return 'level-4'
}

const totalActiveDays = computed(() => days.value.filter(d => d.count > 0).length)
const currentStreak = computed(() => {
  let streak = 0
  for (let i = days.value.length - 1; i >= 0; i--) {
    if (days.value[i].count > 0) streak++
    else break
  }
  return streak
})
const maxMinutes = computed(() => Math.max(...days.value.map(d => d.count), 0))
</script>

<template>
  <div class="heatmap">
    <div class="heatmap-header">
      <h3>学习热力图</h3>
      <div class="heatmap-stats">
        <span class="stat">📅 {{ totalActiveDays }} 天有学习</span>
        <span class="stat">🔥 连续 {{ currentStreak }} 天</span>
        <span class="stat">📈 单日最高 {{ maxMinutes }} 分钟</span>
      </div>
    </div>

    <!-- Month labels -->
    <div class="month-labels">
      <span v-for="(d, i) in days.filter((_, idx) => idx % 30 === 0 || idx === days.length - 1)" :key="i" class="month-label">
        {{ d.month }}
      </span>
    </div>

    <!-- Grid -->
    <div class="heatmap-grid">
      <div
        v-for="(d, i) in days"
        :key="i"
        :class="['heatmap-cell', getColorClass(d.count)]"
        :title="`${d.date}: ${d.count} 分钟`"
      >
      </div>
    </div>

    <!-- Legend -->
    <div class="heatmap-legend">
      <span>少</span>
      <span class="legend-cell level-0"></span>
      <span class="legend-cell level-1"></span>
      <span class="legend-cell level-2"></span>
      <span class="legend-cell level-3"></span>
      <span class="legend-cell level-4"></span>
      <span>多</span>
    </div>
  </div>
</template>

<style scoped>
.heatmap {
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 12px;
}
.heatmap-header {
  margin-bottom: 12px;
}
.heatmap-header h3 {
  font-size: 15px;
  color: #333;
  margin-bottom: 6px;
}
.heatmap-stats {
  display: flex;
  gap: 14px;
  font-size: 12px;
  color: #888;
  flex-wrap: wrap;
}
.heatmap-stats .stat {
  white-space: nowrap;
}
.month-labels {
  display: flex;
  gap: 28px;
  padding-left: 0;
  margin-bottom: 4px;
  font-size: 10px;
  color: #bbb;
}
.month-label {
  min-width: 0;
}

/* Grid: 53 columns (weeks) × 7 rows (days) */
.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(53, 1fr);
  gap: 2px;
  margin-bottom: 8px;
}
.heatmap-cell {
  aspect-ratio: 1;
  border-radius: 2px;
  min-width: 6px;
  min-height: 6px;
}
.level-0 { background: #ebedf0; }
.level-1 { background: #9be9a8; }
.level-2 { background: #40c463; }
.level-3 { background: #30a14e; }
.level-4 { background: #216e39; }

/* Legend */
.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: #999;
  justify-content: flex-end;
}
.legend-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}
</style>
