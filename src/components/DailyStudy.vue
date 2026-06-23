<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { getWordsForDay } from '../utils/wordbank'
import { applyRating, createWordRecord } from '../utils/ebbinghaus'
import { loadData, saveData, getCurrentUser } from '../utils/storage'
import type { VocabWord, WordRecord } from '../types/vocab'

const props = defineProps<{ appData: any; bookId?: string }>()
const emit = defineEmits<{ update: [data: any] }>()

const WORDS_PER_DAY = 50
const TOTAL_DAYS = 48
const GROUP_SIZE = 10

const data = ref({ ...props.appData, records: { ...props.appData.records } })
const user = getCurrentUser()

// Learning state
const phase = ref<'ready' | 'learning' | 'summarize' | 'done'>('ready')
const currentGroup = ref(0)
const currentIdx = ref(0)
const isFlipped = ref(false)
const sessionStarted = ref(false)
const startTime = ref(0)

// Session data
const todayWords = ref<VocabWord[]>([])
const sessionResults = ref<Array<{
  word: VocabWord
  rating: 'known' | 'fuzzy' | 'forgot'
  timeMs: number
}>>([])
const wrongWords = ref<VocabWord[]>([])
const groupRecords = ref<WordRecord[]>([])

// Stats
const correctCount = computed(() => sessionResults.value.filter(r => r.rating === 'known').length)
const fuzzyCount = computed(() => sessionResults.value.filter(r => r.rating === 'fuzzy').length)
const forgotCount = computed(() => sessionResults.value.filter(r => r.rating === 'forgot').length)
const progress = computed(() => Math.round((sessionResults.value.length / todayWords.value.length) * 100))
const elapsedMinutes = ref(0)

const groups = computed(() => {
  const gs: VocabWord[][] = []
  for (let i = 0; i < todayWords.value.length; i += GROUP_SIZE) {
    gs.push(todayWords.value.slice(i, i + GROUP_SIZE))
  }
  return gs
})

const currentWord = computed(() => {
  const g = groups.value[currentGroup.value]
  return g?.[currentIdx.value] || null
})

const groupProgress = computed(() => {
  const g = groups.value[currentGroup.value]
  if (!g) return 0
  return Math.round((currentIdx.value / g.length) * 100)
})

const totalProgress = computed(() => {
  let done = 0
  for (let i = 0; i < currentGroup.value; i++) done += groups.value[i]?.length || 0
  done += currentIdx.value
  return Math.round((done / todayWords.value.length) * 100)
})

const isLastInGroup = computed(() => {
  const g = groups.value[currentGroup.value]
  return g && currentIdx.value >= g.length - 1
})

const isLastWord = computed(() => {
  return currentGroup.value >= groups.value.length - 1 && isLastInGroup.value
})

onMounted(() => {
  loadTodayWords()
})

function loadTodayWords() {
  const bank = (window as any).__currentWordBank
  if (bank && Array.isArray(bank)) {
    todayWords.value = getWordsForDay(bank, data.value.currentDay, WORDS_PER_DAY)
  } else {
    todayWords.value = []
  }
}

function birthdayText(): string {
  // Get user's first character for personalization
  const nameChar = user.name.charAt(0)
  return `🎂 祝 ${nameChar}同学生日快乐！今天是 Day ${data.value.currentDay}`
}

function startSession() {
  phase.value = 'learning'
  sessionStarted.value = true
  startTime.value = Date.now()
  currentGroup.value = 0
  currentIdx.value = 0
  isFlipped.value = false
  
  // Start timer
  const timer = setInterval(() => {
    elapsedMinutes.value = Math.round((Date.now() - startTime.value) / 60000)
  }, 10000)
}

function flipCard() {
  isFlipped.value = true
}

function rateWord(rating: 'known' | 'fuzzy' | 'forgot') {
  if (!currentWord.value) return
  
  const timeMs = Date.now() - startTime.value
  sessionResults.value.push({
    word: currentWord.value,
    rating,
    timeMs
  })
  
  if (rating === 'forgot') {
    wrongWords.value.push(currentWord.value)
  } else if (rating === 'fuzzy') {
    wrongWords.value.push(currentWord.value)
  }
  
  // Check group completion
  if (isLastWord.value) {
    // All done
    phase.value = 'summarize'
    saveResults()
    return
  }
  
  // Next word
  if (isLastInGroup.value) {
    // Next group - show mini-summarize first
    // Actually just go to next group
    currentGroup.value++
    currentIdx.value = 0
  } else {
    currentIdx.value++
  }
  isFlipped.value = false
}

function completeSession() {
  phase.value = 'done'
  emit('update', data.value)
}

function saveResults() {
  const now = Date.now()
  const today = new Date().toISOString().split('T')[0]
  
  sessionResults.value.forEach(r => {
    const existing = data.value.records[r.word.word] || createWordRecord(r.word.word)
    const updated = applyRating(existing, r.rating)
    data.value.records[r.word.word] = updated
  })
  
  // Update stats
  data.value.totalLearned = Object.keys(data.value.records).length
  data.value.lastCheckin = today
  
  // Daily minutes
  const minutes = Math.round(elapsedMinutes.value || (Date.now() - startTime.value) / 60000)
  if (!data.value.dailyMinutes) data.value.dailyMinutes = {}
  data.value.dailyMinutes[today] = (data.value.dailyMinutes[today] || 0) + minutes
  
  // Wrong words
  if (!data.value.wrongWords) data.value.wrongWords = {}
  wrongWords.value.forEach(w => {
    data.value.wrongWords[w.word] = (data.value.wrongWords[w.word] || 0) + 1
  })
  
  saveData(data.value)
}

function getDistributionWidth(count: number, total: number): string {
  if (total === 0) return '0%'
  return Math.round((count / total) * 100) + '%'
}
</script>

<template>
  <div class="study-view">
    <!-- READY SCREEN -->
    <template v-if="phase === 'ready'">
      <div class="ready-screen">
        <div class="ready-icon">📚</div>
        <h2>第 {{ data.currentDay }} 天</h2>
        <p class="ready-subtitle">今天学习 {{ todayWords.length }} 个新词</p>
        <div class="ready-info">
          <div class="info-item">📖 共 {{ groups.length }} 组，每 {{ GROUP_SIZE }} 词一组</div>
          <div class="info-item">🔥 已连续 {{ data.streakDays }} 天打卡</div>
          <div class="info-item">🎯 累计掌握 {{ Object.values(data.records).filter(r => r.status === 'mastered').length }} 词</div>
        </div>
        <button class="btn-start" @click="startSession()">
          开始学习 🚀
        </button>
      </div>
    </template>

    <!-- LEARNING SCREEN -->
    <template v-if="phase === 'learning'">
      <div class="learning-screen">
        <!-- Progress bar -->
        <div class="progress-top">
          <div class="progress-bar-wrap">
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" :style="{ width: totalProgress + '%' }"></div>
            </div>
            <span class="progress-text">{{ sessionResults.length }}/{{ todayWords.length }}</span>
          </div>
          <div class="group-badge">第 {{ currentGroup + 1 }}/{{ groups.length }} 组</div>
        </div>

        <!-- Flashcard -->
        <div class="flashcard-wrapper" @click="!isFlipped && flipCard()">
          <div class="flashcard" :class="{ flipped: isFlipped }">
            <!-- Front: word only -->
            <div class="card-front" v-if="!isFlipped">
              <div class="word-display">{{ currentWord?.word }}</div>
              <div class="phonetic-display" v-if="currentWord?.phonetic">/{{ currentWord.phonetic }}/</div>
              <div class="tap-hint">点击卡片查看释义</div>
            </div>
            <!-- Back: full info -->
            <div class="card-back" v-else>
              <div class="card-word">{{ currentWord?.word }}</div>
              <div class="card-phonetic" v-if="currentWord?.phonetic">/{{ currentWord.phonetic }}/</div>
              <div class="card-pos" v-if="currentWord?.pos">{{ currentWord.pos }}</div>
              <div class="card-meaning">{{ currentWord?.meaning }}</div>
              
              <div class="card-extra" v-if="currentWord?.sentences?.length">
                <div class="extra-label">💬 例句</div>
                <div class="sentence">{{ currentWord.sentences[0].en }}</div>
                <div class="sentence-zh">{{ currentWord.sentences[0].zh }}</div>
              </div>
              
              <div class="card-extra" v-if="currentWord?.roots">
                <span class="extra-label">🌱 词根</span>
                <span class="extra-text">{{ currentWord.roots }}</span>
              </div>
              
              <div class="card-extra" v-if="currentWord?.mnemonics">
                <span class="extra-label">💡 助记</span>
                <span class="extra-text">{{ currentWord.mnemonics }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Rating buttons (shown after flip) -->
        <div class="rating-row" v-if="isFlipped">
          <button class="btn-rate btn-known" @click="rateWord('known')">
            <span class="rate-icon">😊</span>
            <span class="rate-label">认识</span>
          </button>
          <button class="btn-rate btn-fuzzy" @click="rateWord('fuzzy')">
            <span class="rate-icon">🤔</span>
            <span class="rate-label">模糊</span>
          </button>
          <button class="btn-rate btn-forgot" @click="rateWord('forgot')">
            <span class="rate-icon">😅</span>
            <span class="rate-label">忘记</span>
          </button>
        </div>
        
        <!-- Group transition hint -->
        <div v-if="isFlipped && isLastInGroup && !isLastWord" class="group-hint">
          即将进入第 {{ currentGroup + 2 }} 组
        </div>
      </div>
    </template>

    <!-- SUMMARY SCREEN -->
    <template v-if="phase === 'summarize'">
      <div class="summary-screen">
        <div class="summary-icon">🎉</div>
        <h2>今日学习完成！</h2>
        <p class="summary-subtitle">第 {{ data.currentDay }} 天 · {{ todayWords.length }} 词</p>
        
        <div class="summary-chart">
          <div class="chart-bar">
            <div class="chart-segment correct" :style="{ width: getDistributionWidth(correctCount, sessionResults.length) }"></div>
            <div class="chart-segment fuzzy" :style="{ width: getDistributionWidth(fuzzyCount, sessionResults.length) }"></div>
            <div class="chart-segment forgot" :style="{ width: getDistributionWidth(forgotCount, sessionResults.length) }"></div>
          </div>
          <div class="chart-legend">
            <span><span class="dot correct"></span> 认识 {{ correctCount }}</span>
            <span><span class="dot fuzzy"></span> 模糊 {{ fuzzyCount }}</span>
            <span><span class="dot forgot"></span> 忘记 {{ forgotCount }}</span>
          </div>
        </div>

        <div class="summary-stats">
          <div class="stat">
            <div class="stat-val correct">{{ Math.round(correctCount / sessionResults.length * 100) }}%</div>
            <div class="stat-lbl">正确率</div>
          </div>
          <div class="stat">
            <div class="stat-val">{{ elapsedMinutes }}分钟</div>
            <div class="stat-lbl">用时</div>
          </div>
          <div class="stat">
            <div class="stat-val">{{ wrongWords.length }}</div>
            <div class="stat-lbl">需复习</div>
          </div>
        </div>

        <div class="wrong-preview" v-if="wrongWords.length > 0">
          <h4>📝 需要复习的词 ({{ wrongWords.length }})</h4>
          <div class="wrong-list">
            <span v-for="w in wrongWords.slice(0, 10)" :key="w.word" class="wrong-chip">{{ w.word }}</span>
            <span v-if="wrongWords.length > 10" class="wrong-chip more">+{{ wrongWords.length - 10 }}</span>
          </div>
        </div>

        <button class="btn-start" @click="completeSession()">
          完成，明天继续 📅
        </button>
      </div>
    </template>

    <!-- DONE SCREEN -->
    <template v-if="phase === 'done'">
      <div class="ready-screen">
        <div class="ready-icon">🌟</div>
        <h2>太棒了！</h2>
        <p class="ready-subtitle">今日任务已完成，继续保持！</p>
        <div class="ready-info">
          <div class="info-item">🔥 连续打卡：<strong>{{ data.streakDays + 1 }} 天</strong></div>
          <div class="info-item">📊 累计掌握：<strong>{{ Object.values(data.records).filter(r => r.status === 'mastered').length }} 词</strong></div>
          <div class="info-item">📈 第 {{ data.currentDay + 1 }} 天将在明天解锁</div>
        </div>
        <div class="done-compliment" v-if="correctCount > sessionResults.length * 0.7">
          今天的表现非常棒！🌞
        </div>
        <div class="done-compliment" v-else>
          每天进步一点点，坚持下去！💪
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.study-view {
  max-width: 560px;
  margin: 0 auto;
}

/* ===== READY SCREEN ===== */
.ready-screen {
  text-align: center;
  padding: 40px 16px;
}
.ready-icon {
  font-size: 64px;
  margin-bottom: 12px;
}
.ready-screen h2 {
  font-size: 28px;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 4px;
}
.ready-subtitle {
  color: #888;
  font-size: 15px;
  margin-bottom: 24px;
}
.ready-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 32px;
}
.info-item {
  background: #f8f9fa;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  color: #555;
}
.btn-start {
  padding: 14px 48px;
  background: linear-gradient(135deg, #4a90d9, #357abd);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-start:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(74, 144, 217, 0.35);
}

/* ===== LEARNING SCREEN ===== */
.learning-screen {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 160px);
}
.progress-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.progress-bar-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}
.progress-bar-bg {
  flex: 1;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}
.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #4a90d9, #67b8f7);
  border-radius: 4px;
  transition: width 0.3s ease;
}
.progress-text {
  font-size: 12px;
  color: #999;
  min-width: 50px;
  text-align: right;
}
.group-badge {
  background: #f0f4f8;
  color: #4a90d9;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

/* Flashcard */
.flashcard-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 16px 0;
}
.flashcard {
  width: 100%;
  max-width: 440px;
  min-height: 320px;
  background: white;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 32px 24px;
  transition: all 0.2s;
  border: 1px solid #e8e8e8;
}
.flashcard:hover {
  border-color: #d0d0d0;
  box-shadow: 0 4px 24px rgba(0,0,0,0.06);
}

.card-front {
  text-align: center;
}
.word-display {
  font-size: 36px;
  font-weight: 700;
  color: #2c3e50;
  letter-spacing: 1px;
}
.phonetic-display {
  color: #999;
  font-size: 16px;
  margin-top: 8px;
  font-style: italic;
}
.tap-hint {
  margin-top: 40px;
  color: #bbb;
  font-size: 13px;
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.card-back {
  text-align: center;
  width: 100%;
}
.card-word {
  font-size: 28px;
  font-weight: 700;
  color: #2c3e50;
}
.card-phonetic {
  font-size: 14px;
  color: #999;
  font-style: italic;
  margin: 4px 0;
}
.card-pos {
  display: inline-block;
  margin: 4px 0;
  background: #fef3c7;
  color: #92400e;
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 12px;
}
.card-meaning {
  font-size: 20px;
  color: #378ADD;
  font-weight: 600;
  margin: 12px 0 16px;
  padding: 8px 16px;
  background: #f0f7ff;
  border-radius: 8px;
}
.card-extra {
  font-size: 13px;
  color: #666;
  margin-top: 8px;
  text-align: left;
  padding: 0 8px;
}
.extra-label {
  font-weight: 500;
  color: #888;
  margin-bottom: 2px;
}
.sentence {
  color: #555;
  font-style: italic;
  font-size: 13px;
}
.sentence-zh {
  color: #999;
  font-size: 12px;
  margin-top: 2px;
}
.extra-text {
  color: #666;
}

/* Rating buttons */
.rating-row {
  display: flex;
  gap: 10px;
  padding: 8px 0;
}
.btn-rate {
  flex: 1;
  border: none;
  padding: 14px 8px;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  transition: all 0.15s;
  font-size: 13px;
}
.btn-rate:hover {
  transform: translateY(-2px);
}
.rate-icon { font-size: 24px; }
.rate-label { font-weight: 500; }
.btn-known {
  background: #e8f5e9;
  color: #2e7d32;
}
.btn-known:hover { background: #c8e6c9; }
.btn-fuzzy {
  background: #fff3e0;
  color: #e65100;
}
.btn-fuzzy:hover { background: #ffe0b2; }
.btn-forgot {
  background: #fce4ec;
  color: #c62828;
}
.btn-forgot:hover { background: #f8bbd0; }

.group-hint {
  text-align: center;
  color: #bbb;
  font-size: 12px;
  margin-top: 4px;
}

/* ===== SUMMARY SCREEN ===== */
.summary-screen {
  text-align: center;
  padding: 24px 16px;
}
.summary-icon {
  font-size: 64px;
  margin-bottom: 8px;
}
.summary-screen h2 {
  font-size: 26px;
  font-weight: 700;
  color: #2c3e50;
}
.summary-subtitle {
  color: #888;
  font-size: 14px;
  margin-bottom: 20px;
}
.summary-chart {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  border: 1px solid #e8e8e8;
}
.chart-bar {
  display: flex;
  height: 16px;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 10px;
}
.chart-segment.correct { background: #52c41a; }
.chart-segment.fuzzy { background: #faad14; }
.chart-segment.forgot { background: #ff4d4f; }
.chart-legend {
  display: flex;
  justify-content: center;
  gap: 16px;
  font-size: 12px;
  color: #666;
}
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
}
.dot.correct { background: #52c41a; }
.dot.fuzzy { background: #faad14; }
.dot.forgot { background: #ff4d4f; }

.summary-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}
.stat {
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  padding: 12px;
}
.stat-val {
  font-size: 22px;
  font-weight: 700;
  color: #4a90d9;
}
.stat-val.correct { color: #52c41a; }
.stat-lbl {
  font-size: 11px;
  color: #888;
  margin-top: 2px;
}

.wrong-preview {
  text-align: left;
  margin-bottom: 24px;
}
.wrong-preview h4 {
  font-size: 14px;
  color: #555;
  margin-bottom: 8px;
}
.wrong-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.wrong-chip {
  background: #fce4ec;
  color: #c62828;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
}
.wrong-chip.more {
  background: #f0f0f0;
  color: #888;
}

.done-compliment {
  margin-top: 12px;
  font-size: 16px;
  color: #4a90d9;
  font-weight: 500;
}

/* Desktop adjustments */
@media (min-width: 769px) {
  .flashcard {
    min-height: 380px;
  }
  .word-display { font-size: 44px; }
  .card-word { font-size: 34px; }
  .card-meaning { font-size: 22px; }
}
</style>
