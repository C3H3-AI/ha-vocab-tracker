<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { loadData, saveData, isHAConnected } from '../utils/storage'
import {
  DEFAULT_INTERVALS, getIntervals, setIntervals, resetIntervals,
  loadIntervalsFromData, getDueCount, getMasteredCount,
  getLearnedCount, getAverageEF, generateRetentionCurve,
  getSM2Config, setSM2Config
} from '../utils/ebbinghaus'
import { getLevel, getLevelProgress, checkNewAchievements, ACHIEVEMENTS, XP_RULES, LEVELS } from '../utils/gamification'
import StudyHeatmap from './StudyHeatmap.vue'

const props = defineProps<{ appData: any }>()

const data = ref(props.appData)

// SM-2 Stats
const totalXP = computed(() => (window as any).__appData?.totalXP || 0)
const levelInfo = computed(() => getLevel(totalXP.value))
const levelProgress = computed(() => getLevelProgress(totalXP.value))
const avgEF = computed(() => getAverageEF(data.value.records))
const masteredCount = computed(() => getMasteredCount(data.value.records))
const learnedCount = computed(() => getLearnedCount(data.value.records))
const dueCount = computed(() => getDueCount(data.value.records))
const haConnected = ref(false)

// Retention curve
const curveData = computed(() => {
  const records = Object.values(data.value.records)
  if (records.length === 0) return []
  const sample = records.find(r => r.status === 'review' || r.status === 'mastered')
  if (!sample) return []
  return generateRetentionCurve(sample)
})

// Achievements
const earnedAchievements = computed(() => {
  const saved = (window as any).__appData?.achievements || []
  return ACHIEVEMENTS.filter(a => saved.includes(a.id))
})

const unearnedAchievements = computed(() => {
  const saved = (window as any).__appData?.achievements || []
  return ACHIEVEMENTS.filter(a => !saved.includes(a.id))
})

// Ebbinghaus settings
const showSettings = ref(false)
const intervalInputs = ref([...getIntervals()])
const showSM2Config = ref(false)
const qualityPassInput = ref(getSM2Config().QUALITY_PASS)

onMounted(() => {
  const saved = loadData()
  loadIntervalsFromData(saved)
  intervalInputs.value = [...getIntervals()]
  haConnected.value = isHAConnected()
  ;(window as any).__appData = saved
  loadTestHistory()
})

// Test history
const testHistory = ref<Array<{ date: string; correct: number; wrong: number; total: number }>>([])

function loadTestHistory() {
  const data = loadData()
  if (data.testHistory) {
    // Show last 20 tests
    testHistory.value = data.testHistory.slice(-20).map(t => ({
      date: t.date,
      correct: t.correct,
      wrong: t.wrong,
      total: t.total
    }))
  }
}

const testAccuracy = computed(() => {
  if (testHistory.value.length === 0) return 0
  const total = testHistory.value.reduce((s, t) => s + t.total, 0)
  const correct = testHistory.value.reduce((s, t) => s + t.correct, 0)
  return Math.round(correct / total * 100)
})

function saveIntervals() {
  const valid = intervalInputs.value.filter(n => n >= 1)
  if (valid.length < 3) { alert('至少需要 3 轮间隔'); return }
  setIntervals(valid)
  const saved = loadData()
  saved.ebbinghausIntervals = valid
  saveData(saved)
  showSettings.value = false
}

function resetToDefault() {
  resetIntervals()
  intervalInputs.value = [...DEFAULT_INTERVALS]
  const saved = loadData()
  delete saved.ebbinghausIntervals
  saveData(saved)
  showSettings.value = false
}

function saveSM2Config() {
  setSM2Config({ QUALITY_PASS: qualityPassInput.value })
  showSM2Config.value = false
}

function handleReset() {
  if (confirm('确认重置所有学习数据？此操作不可撤销！')) {
    const key = `ha_vocab_tracker_${(window as any).__appData?.currentWordBook || 'local'}`
    localStorage.removeItem(key)
    location.reload()
  }
}

function formatDate(d: string): string {
  if (!d) return '从未'
  return d
}
</script>

<template>
  <div class="stats-dashboard">
    <!-- Header -->
    <div class="stats-header">
      <h2>📊 学习统计</h2>
    </div>

    <!-- Level & XP Card -->
    <div class="card level-card">
      <div class="level-icon">{{ levelInfo.level >= 5 ? '👑' : levelInfo.level >= 3 ? '🏅' : '🌱' }}</div>
      <div class="level-info">
        <div class="level-title">{{ levelInfo.title }}</div>
        <div class="level-xp">Lv.{{ levelInfo.level }} · {{ totalXP }} XP · {{ levelInfo.xpForNext }} XP 到下一级</div>
        <div class="level-bar-bg">
          <div class="level-bar-fill" :style="{ width: levelProgress + '%' }"></div>
        </div>
      </div>
    </div>

    <!-- Core Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📖</div>
        <div class="stat-val">{{ learnedCount }}</div>
        <div class="stat-lbl">已学</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">✅</div>
        <div class="stat-val" style="color:#52c41a">{{ masteredCount }}</div>
        <div class="stat-lbl">掌握</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🔄</div>
        <div class="stat-val" style="color:#faad14">{{ dueCount }}</div>
        <div class="stat-lbl">待复习</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🧠</div>
        <div class="stat-val" style="color:#9b59b6">{{ avgEF.toFixed(2) }}</div>
        <div class="stat-lbl">平均EF</div>
      </div>
    </div>

    <!-- SM-2 Forgetting Curve -->
    <div class="card" v-if="curveData.length > 0">
      <h3 class="card-title">📈 遗忘曲线预测</h3>
      <div class="curve-container">
        <div class="curve-bars">
          <div v-for="(p, i) in curveData" :key="i" class="curve-bar-item">
            <div class="curve-bar-fill" :style="{ height: (p.retention * 100) + '%', background: p.retention > 0.7 ? '#52c41a' : p.retention > 0.4 ? '#faad14' : '#ff4d4f' }"
              :title="`${p.label}: ${Math.round(p.retention * 100)}%`">
            </div>
            <div class="curve-bar-label">{{ p.label }}</div>
          </div>
        </div>
      </div>
      <div class="curve-note">基于 SM-2 算法预测，假设每次回答质量 = 4</div>
    </div>

    <!-- Test History Trend -->
    <div class="card" v-if="testHistory.length > 0">
      <h3 class="card-title">📊 测试成绩趋势</h3>
      <div class="test-trend">
        <div class="trend-header">
          <span class="trend-accuracy">总正确率 <strong>{{ testAccuracy }}%</strong></span>
          <span class="trend-count">{{ testHistory.length }} 次测试</span>
        </div>
        <div class="trend-chart">
          <div v-for="(t, i) in testHistory" :key="i" class="trend-bar"
            :style="{ height: Math.max(4, (t.correct / Math.max(1, t.total)) * 60) + 'px' }"
            :class="{ good: t.correct / t.total >= 0.8, mid: t.correct / t.total >= 0.5, poor: t.correct / t.total < 0.5 }"
            :title="`${new Date(t.date).toLocaleDateString()}: ${t.correct}/${t.total} (${Math.round(t.correct/t.total*100)}%)`">
          </div>
        </div>
        <div class="trend-labels">
          <span>早期</span>
          <span>最近</span>
        </div>
      </div>
    </div>

    <!-- Study Heatmap -->
    <StudyHeatmap :dailyMinutes="data.dailyMinutes || {}" />

    <!-- Achievements -->
    <div class="card">
      <h3 class="card-title">🏆 成就</h3>
      <div class="achievement-grid">
        <div v-for="a in earnedAchievements" :key="a.id" class="achievement earned" :title="a.desc">
          <span class="ach-icon">{{ a.icon }}</span>
          <span class="ach-name">{{ a.name }}</span>
        </div>
        <div v-for="a in unearnedAchievements.slice(0, 6)" :key="a.id" class="achievement locked" :title="a.desc">
          <span class="ach-icon">❓</span>
          <span class="ach-name">???</span>
        </div>
      </div>
    </div>

    <!-- Settings -->
    <div class="card settings-card">
      <div class="setting-item" @click="showSettings = !showSettings">
        <span>⚙️ 复习间隔</span>
        <span>{{ showSettings ? '▲' : '▼' }}</span>
      </div>
      <div v-if="showSettings" class="setting-body">
        <p class="setting-desc">自定义 SM-2 基础间隔天数</p>
        <div class="interval-list">
          <div v-for="(v, i) in intervalInputs" :key="i" class="interval-row">
            <span class="int-label">第{{ i + 1 }}轮</span>
            <input type="number" v-model.number="intervalInputs[i]" min="1" max="90" class="int-input" />
            <span class="int-unit">天</span>
            <button v-if="i === intervalInputs.length - 1" class="int-add" @click="intervalInputs.push(7)">+</button>
            <button v-if="intervalInputs.length > 3" class="int-remove" @click="intervalInputs.splice(i, 1)">✕</button>
          </div>
        </div>
        <div class="setting-actions">
          <button class="btn-save" @click="saveIntervals()">保存</button>
          <button class="btn-reset-sm" @click="resetToDefault()">默认</button>
        </div>
      </div>

      <div class="setting-item" @click="showSM2Config = !showSM2Config" style="margin-top:8px">
        <span>🧠 SM-2 及格线</span>
        <span>{{ showSM2Config ? '▲' : '▼' }}</span>
      </div>
      <div v-if="showSM2Config" class="setting-body">
        <p class="setting-desc">回答质量 ≥ 多少算通过 (当前: {{ getSM2Config().QUALITY_PASS }})</p>
        <input type="range" v-model.number="qualityPassInput" min="1" max="5" step="1" class="range-input" />
        <div class="range-labels"><span>1 宽松</span><span>5 严格</span></div>
        <button class="btn-save" @click="saveSM2Config()" style="width:100%;margin-top:10px">保存</button>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer-row">
      <span class="last-checkin">上次打卡: {{ formatDate(data.lastCheckin) }}</span>
      <button class="btn-reset" @click="handleReset">重置数据</button>
    </div>
  </div>
</template>

<style scoped>
.stats-dashboard { max-width: 600px; margin: 0 auto; }
.stats-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.stats-header h2 { font-size: 20px; color: var(--text-primary, #2c3e50); margin: 0; }

.card { background: var(--bg-card, white); border: 1px solid var(--border-color, #e8e8e8); border-radius: 12px; padding: 16px; margin-bottom: 12px; }
.card-title { font-size: 14px; color: var(--text-secondary, #555); margin: 0 0 12px; }

/* Level */
.level-card { display: flex; align-items: center; gap: 14px; }
.level-icon { font-size: 40px; }
.level-info { flex: 1; }
.level-title { font-size: 18px; font-weight: 700; color: var(--text-primary, #2c3e50); }
.level-xp { font-size: 12px; color: var(--text-muted, #888); margin: 2px 0 6px; }
.level-bar-bg { height: 8px; background: #f0f0f0; border-radius: 4px; overflow: hidden; }
.level-bar-fill { height: 100%; background: linear-gradient(90deg, #4a90d9, #9b59b6); border-radius: 4px; transition: width 0.3s; }

/* Grid */
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
.stat-card { background: var(--bg-card, white); border: 1px solid var(--border-color, #e8e8e8); border-radius: 10px; padding: 12px; text-align: center; }
.stat-icon { font-size: 24px; margin-bottom: 4px; }
.stat-val { font-size: 22px; font-weight: 700; color: var(--text-primary, #2c3e50); }
.stat-lbl { font-size: 11px; color: var(--text-muted, #888); margin-top: 2px; }

/* Curve */
.curve-container { height: 140px; display: flex; align-items: flex-end; padding: 0 8px; }
.curve-bars { display: flex; align-items: flex-end; gap: 6px; width: 100%; height: 120px; }
.curve-bar-item { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
.curve-bar-fill { width: 100%; max-width: 30px; border-radius: 4px 4px 0 0; transition: height 0.3s; min-height: 4px; }
.curve-bar-label { font-size: 9px; color: var(--text-muted, #999); margin-top: 4px; }
.curve-note { font-size: 11px; color: var(--text-muted, #999); text-align: center; margin-top: 8px; }

/* Test Trend */
.test-trend { padding: 0 4px; }
.trend-header { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-secondary, #555); margin-bottom: 12px; }
.trend-accuracy strong { color: var(--accent, #4a90d9); }
.trend-count { color: var(--text-muted, #888); }
.trend-chart { display: flex; align-items: flex-end; gap: 3px; height: 64px; padding: 4px 0; }
.trend-bar { flex: 1; min-width: 6px; border-radius: 3px 3px 0 0; transition: height 0.3s; }
.trend-bar.good { background: #52c41a; }
.trend-bar.mid { background: #faad14; }
.trend-bar.poor { background: #ff4d4f; }
.trend-labels { display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted, #bbb); margin-top: 4px; }

/* Achievements */
.achievement-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.achievement { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 20px; font-size: 12px; }
.achievement.earned { background: #fff8e1; color: #7c4dff; }
.achievement.locked { background: #f5f5f5; color: #bbb; }
.ach-icon { font-size: 16px; }
.ach-name { font-weight: 500; }

/* Settings */
.setting-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; cursor: pointer; font-size: 14px; color: var(--text-secondary, #555); }
.setting-item:hover { color: var(--accent, #4a90d9); }
.setting-body { margin-top: 10px; padding: 12px; background: var(--bg-primary, #f8f9fa); border-radius: 8px; }
.setting-desc { font-size: 12px; color: var(--text-muted, #888); margin-bottom: 10px; }
.interval-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.interval-row { display: flex; align-items: center; gap: 6px; }
.int-label { font-size: 12px; color: var(--text-secondary, #555); min-width: 45px; }
.int-input { width: 50px; padding: 4px 6px; border: 1px solid var(--border-color, #ddd); border-radius: 4px; text-align: center; font-size: 13px; }
.int-unit { font-size: 11px; color: var(--text-muted, #999); }
.int-add { padding: 2px 6px; border: 1px solid #52c41a; border-radius: 4px; background: white; color: #52c41a; font-size: 13px; cursor: pointer; }
.int-remove { padding: 2px 6px; border: 1px solid #ff4d4f; border-radius: 4px; background: white; color: #ff4d4f; font-size: 11px; cursor: pointer; }
.setting-actions { display: flex; gap: 8px; }
.btn-save { flex: 1; padding: 8px; background: var(--accent, #4a90d9); color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; }
.btn-reset-sm { padding: 8px 14px; background: white; border: 1px solid var(--border-color, #e0e0e0); border-radius: 6px; font-size: 12px; cursor: pointer; }
.range-input { width: 100%; margin: 8px 0; }
.range-labels { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted, #999); }

.footer-row { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; }
.last-checkin { font-size: 12px; color: var(--text-muted, #888); }
.btn-reset { padding: 6px 14px; border: 1px solid #ff4d4f; border-radius: 6px; background: white; color: #ff4d4f; font-size: 12px; cursor: pointer; }
.btn-reset:hover { background: #fff2f0; }
</style>
