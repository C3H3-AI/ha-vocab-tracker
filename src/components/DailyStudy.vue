<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getWordsForDay } from '../utils/wordbank'
import { applyRating, createWordRecord, getQualityFromRating } from '../utils/ebbinghaus'
import { loadData, saveData, getCurrentUser } from '../utils/storage'
import { speakWordFire, initSpeech, isSpeechSupported } from '../utils/speech'
import type { VocabWord, WordRecord } from '../types/vocab'

const props = defineProps<{ appData: any; bookId?: string }>()
const emit = defineEmits<{ update: [data: any] }>()

const WORDS_PER_DAY = 50
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
const speechSupported = ref(false)

// Session data
const todayWords = ref<VocabWord[]>([])
const sessionResults = ref<Array<{
  word: VocabWord
  quality: number
  rating: 'known' | 'fuzzy' | 'forgot'
  timeMs: number
}>>([])
const wrongWords = ref<VocabWord[]>([])
const groupRecords = ref<WordRecord[]>([])

// SM-2 Stats
const correctCount = computed(() => sessionResults.value.filter(r => r.rating === 'known').length)
const fuzzyCount = computed(() => sessionResults.value.filter(r => r.rating === 'fuzzy').length)
const forgotCount = computed(() => sessionResults.value.filter(r => r.rating === 'forgot').length)
const totalScore = computed(() => sessionResults.value.reduce((s, r) => s + r.quality, 0))
const avgQuality = computed(() => sessionResults.value.length > 0 ? (totalScore.value / sessionResults.value.length).toFixed(1) : '0')
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

const isLastInGroup = computed(() => {
  const g = groups.value[currentGroup.value]
  return g && currentIdx.value >= g.length - 1
})

const isLastWord = computed(() => {
  return currentGroup.value >= groups.value.length - 1 && isLastInGroup.value
})

// Word card flip animation
const cardAnimating = ref(false)

// Swipe + Keyboard support
let touchStartX = 0
let touchStartY = 0
let keyHandler: ((e: KeyboardEvent) => void) | null = null

onMounted(() => {
  // 自动推进：如果今天已打卡，直接进入下一天
  const today = new Date().toISOString().split('T')[0]
  if (data.value.lastCheckin === today) {
    data.value.currentDay = (data.value.currentDay || 1) + 1
    const bank = (window as any).__currentWordBank
    const maxDay = bank ? Math.ceil(bank.length / WORDS_PER_DAY) : 60
    if (data.value.currentDay > maxDay) data.value.currentDay = maxDay
  }
  loadTodayWords()
  initSpeech()
  speechSupported.value = isSpeechSupported()
  registerKeyboard()
})

onUnmounted(() => {
  if (keyHandler) {
    document.removeEventListener('keydown', keyHandler)
  }
})

function registerKeyboard() {
  keyHandler = (e: KeyboardEvent) => {
    if (phase.value === 'learning') {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (!isFlipped.value) {
          flipCard()
        }
      }
      if (isFlipped.value) {
        if (e.key === '1') rateWord('known')
        if (e.key === '2') rateWord('fuzzy')
        if (e.key === '3') rateWord('forgot')
      }
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        speakCurrentWord()
      }
    }
    if (phase.value === 'ready' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      startSession()
    }
  }
  document.addEventListener('keydown', keyHandler)
}

function loadTodayWords() {
  const bank = (window as any).__currentWordBank
  if (bank && Array.isArray(bank)) {
    todayWords.value = getWordsForDay(bank, data.value.currentDay, WORDS_PER_DAY)
  } else {
    todayWords.value = []
  }
}

function speakCurrentWord() {
  if (currentWord.value && speechSupported.value) {
    speakWordFire(currentWord.value.word, { rate: 0.7, accent: 'us' })
  }
}

function startSession() {
  phase.value = 'learning'
  sessionStarted.value = true
  startTime.value = Date.now()
  currentGroup.value = 0
  currentIdx.value = 0
  isFlipped.value = false

  const timer = setInterval(() => {
    elapsedMinutes.value = Math.round((Date.now() - startTime.value) / 60000)
  }, 10000)
  
  // Auto-speak first word
  setTimeout(speakCurrentWord, 500)
}

function flipCard() {
  if (isFlipped.value || cardAnimating.value) return
  cardAnimating.value = true
  isFlipped.value = true
  setTimeout(() => { cardAnimating.value = false }, 300)
  // Auto-speak when revealed
  speakCurrentWord()
}

function rateWord(rating: 'known' | 'fuzzy' | 'forgot') {
  if (!currentWord.value) return

  const elapsed = Date.now() - startTime.value
  const quality = getQualityFromRating(rating)

  sessionResults.value.push({
    word: currentWord.value,
    rating,
    quality,
    timeMs: elapsed
  })

  if (rating !== 'known') {
    wrongWords.value.push(currentWord.value)
  }

  if (isLastWord.value) {
    phase.value = 'summarize'
    saveResults()
    return
  }

  // Next word with animation
  cardAnimating.value = true
  isFlipped.value = false

  setTimeout(() => {
    if (isLastInGroup.value) {
      currentGroup.value++
      currentIdx.value = 0
    } else {
      currentIdx.value++
    }
    cardAnimating.value = false
    // Auto-speak next word
    setTimeout(speakCurrentWord, 300)
  }, 200)
}

// Swipe handlers
function onTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0].clientX
  touchStartY = e.touches[0].clientY
}

function onTouchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0].clientX - touchStartX
  const dy = e.changedTouches[0].clientY - touchStartY
  if (Math.abs(dx) < 50 && Math.abs(dy) < 50) return

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal swipe - not used for now
  } else if (dy > 0) {
    // Swipe down - flip card
    if (!isFlipped.value) flipCard()
  }
}

function completeSession() {
  // 自动推进到下一天
  data.value.currentDay = (data.value.currentDay || 1) + 1
  const maxDay = Math.ceil(todayWords.value.length > 0 
    ? ((window as any).__currentWordBank?.length || 3000) / WORDS_PER_DAY 
    : 60)
  if (data.value.currentDay > maxDay) {
    data.value.currentDay = maxDay // 不超过词库总天数
  }
  phase.value = 'done'
  emit('update', data.value)
}

function saveResults() {
  const now = Date.now()
  const today = new Date().toISOString().split('T')[0]

  sessionResults.value.forEach(r => {
    const existing = data.value.records[r.word.word] || createWordRecord(r.word.word)
    const studySec = Math.round(r.timeMs / 1000)
    const updated = applyRating(existing, r.quality, studySec)
    data.value.records[r.word.word] = updated
  })

  data.value.totalLearned = Object.keys(data.value.records).length
  data.value.lastCheckin = today

  const minutes = Math.round(elapsedMinutes.value || (Date.now() - startTime.value) / 60000)
  if (!data.value.dailyMinutes) data.value.dailyMinutes = {}
  data.value.dailyMinutes[today] = (data.value.dailyMinutes[today] || 0) + minutes

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

function getGradeLabel(quality: number): string {
  if (quality >= 4) return '优秀'
  if (quality >= 3) return '良好'
  if (quality >= 2) return '凑合'
  return '需重学'
}

function getGradeColor(quality: number): string {
  if (quality >= 4) return '#52c41a'
  if (quality >= 3) return '#4a90d9'
  if (quality >= 2) return '#faad14'
  return '#ff4d4f'
}
</script>

<template>
  <div class="study-view" @touchstart="onTouchStart" @touchend="onTouchEnd">
    <!-- READY SCREEN -->
    <template v-if="phase === 'ready'">
      <div class="ready-screen">
        <div class="ready-icon">📚</div>
        <h2>第 {{ data.currentDay }} 天</h2>
        <p class="ready-subtitle">今天学习 {{ todayWords.length }} 个新词</p>
        <div class="ready-stats">
          <div class="ready-stat-item">📖 {{ groups.length }} 组</div>
          <div class="ready-stat-item">🔥 {{ data.streakDays }} 天连续</div>
          <div class="ready-stat-item">🎯 {{ Object.values(data.records).filter((r: any) => r.status === 'mastered').length }} 掌握</div>
        </div>
        <div class="ready-tip" v-if="speechSupported">
          🔈 支持语音朗读，学习时自动发音
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
              <div class="progress-bar-fill" :style="{ width: progress + '%' }"></div>
            </div>
            <span class="progress-text">{{ sessionResults.length }}/{{ todayWords.length }}</span>
          </div>
          <div class="group-badge">第{{ currentGroup + 1 }}/{{ groups.length }}组</div>
        </div>

        <!-- Flashcard with 3D flip -->
        <div class="flashcard-wrapper" @click="!isFlipped && flipCard()">
          <div class="flashcard" :class="{ flipped: isFlipped, animating: cardAnimating }">
            <div class="card-face card-front">
              <div class="word-display">{{ currentWord?.word }}</div>
              <div class="phonetic-display" v-if="currentWord?.phonetic">/{{ currentWord.phonetic }}/</div>
              <div class="tap-hint">
                <span>点击翻转</span>
                <button v-if="speechSupported" class="btn-speak" @click.stop="speakCurrentWord()">🔊 发音</button>
              </div>
            </div>
            <div class="card-face card-back">
              <div class="back-word">{{ currentWord?.word }}</div>
              <div class="back-phonetic" v-if="currentWord?.phonetic">/{{ currentWord.phonetic }}/</div>
              <div class="back-pos" v-if="currentWord?.pos">{{ currentWord.pos }}</div>
              <div class="back-meaning">{{ currentWord?.meaning }}</div>
              
              <div v-if="currentWord?.sentences?.length" class="back-sentence">
                <div class="sentence-en">{{ currentWord.sentences[0].en }}</div>
                <div class="sentence-zh">{{ currentWord.sentences[0].zh }}</div>
              </div>

              <div v-if="currentWord?.roots" class="back-extra">
                <span class="extra-label">🌱 词根:</span> {{ currentWord.roots }}
              </div>
              <div v-if="currentWord?.mnemonics" class="back-extra">
                <span class="extra-label">💡 助记:</span> {{ currentWord.mnemonics }}
              </div>
            </div>
          </div>
        </div>

        <!-- Rating: SM-2 quality-based 5-level -->
        <div class="rating-row" v-if="isFlipped">
          <button class="btn-rate rate-5" @click="rateWord('known')" title="完美回忆">
            <span class="rate-icon">😊</span>
            <span class="rate-label">认识</span>
            <span class="rate-sub">完美</span>
          </button>
          <button class="btn-rate rate-3" @click="rateWord('fuzzy')" title="回忆困难">
            <span class="rate-icon">🤔</span>
            <span class="rate-label">模糊</span>
            <span class="rate-sub">困难</span>
          </button>
          <button class="btn-rate rate-1" @click="rateWord('forgot')" title="完全忘记">
            <span class="rate-icon">😅</span>
            <span class="rate-label">忘记</span>
            <span class="rate-sub">重学</span>
          </button>
        </div>
      </div>
    </template>

    <!-- SUMMARY SCREEN -->
    <template v-if="phase === 'summarize'">
      <div class="summary-screen">
        <div class="summary-icon">🎉</div>
        <h2>今日完成！</h2>
        <p class="summary-subtitle">第 {{ data.currentDay }} 天 · SM-2 质量均分 {{ avgQuality }}</p>

        <div class="summary-chart">
          <div class="chart-bar">
            <div class="chart-segment correct" :style="{ width: getDistributionWidth(correctCount, sessionResults.length) }"></div>
            <div class="chart-segment fuzzy" :style="{ width: getDistributionWidth(fuzzyCount, sessionResults.length) }"></div>
            <div class="chart-segment forgot" :style="{ width: getDistributionWidth(forgotCount, sessionResults.length) }"></div>
          </div>
          <div class="chart-legend">
            <span><span class="dot correct"></span> {{ correctCount }} 认识</span>
            <span><span class="dot fuzzy"></span> {{ fuzzyCount }} 模糊</span>
            <span><span class="dot forgot"></span> {{ forgotCount }} 忘记</span>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-val" style="color:#52c41a">{{ Math.round(correctCount / Math.max(1, sessionResults.length) * 100) }}%</div>
            <div class="summary-lbl">正确率</div>
          </div>
          <div class="summary-card">
            <div class="summary-val" style="color:#4a90d9">{{ elapsedMinutes }}分钟</div>
            <div class="summary-lbl">用时</div>
          </div>
          <div class="summary-card">
            <div class="summary-val" style="color:#faad14">{{ avgQuality }}</div>
            <div class="summary-lbl">SM-2 均分</div>
          </div>
        </div>

        <div v-if="wrongWords.length > 0" class="wrong-preview">
          <h4>📝 需复习 ({{ wrongWords.length }})</h4>
          <div class="wrong-tags">
            <span v-for="w in wrongWords.slice(0, 8)" :key="w.word" class="wrong-tag">{{ w.word }}</span>
            <span v-if="wrongWords.length > 8" class="wrong-tag more">+{{ wrongWords.length - 8 }}</span>
          </div>
        </div>

        <button class="btn-start" @click="completeSession()">
          完成 ✅
        </button>
      </div>
    </template>

    <!-- DONE SCREEN -->
    <template v-if="phase === 'done'">
      <div class="ready-screen">
        <div class="ready-icon">🌟</div>
        <h2>太棒了！</h2>
        <p class="ready-subtitle">今日任务已完成</p>
        <div class="ready-stats">
          <div class="ready-stat-item">🔥 连续 <strong>{{ data.streakDays + 1 }}</strong> 天</div>
          <div class="ready-stat-item">📊 掌握 <strong>{{ Object.values(data.records).filter((r: any) => r.status === 'mastered').length }}</strong> 词</div>
          <div class="ready-stat-item">📈 Day {{ data.currentDay + 1 }} 明天解锁</div>
        </div>
        <div class="done-msg" v-if="correctCount > sessionResults.length * 0.7">
          今天表现非常棒！🎉
        </div>
        <div class="done-msg" v-else>
          每天进步一点点 💪
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

/* READY */
.ready-screen { text-align: center; padding: 40px 16px; }
.ready-icon { font-size: 64px; margin-bottom: 12px; }
.ready-screen h2 { font-size: 28px; font-weight: 700; color: var(--text-primary, #2c3e50); margin-bottom: 4px; }
.ready-subtitle { color: var(--text-muted, #888); font-size: 15px; margin-bottom: 20px; }
.ready-stats { display: flex; justify-content: center; gap: 8px; margin-bottom: 16px; }
.ready-stat-item {
  background: var(--bg-card, white);
  border: 1px solid var(--border-color, #e8e8e8);
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-secondary, #555);
}
.ready-tip {
  color: var(--text-muted, #888);
  font-size: 12px;
  margin-bottom: 24px;
}
.btn-start {
  padding: 14px 48px;
  background: linear-gradient(135deg, var(--accent, #4a90d9), var(--accent-light, #357abd));
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-start:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(74,144,217,0.35); }

/* LEARNING */
.learning-screen { display: flex; flex-direction: column; min-height: calc(100vh - 160px); }
.progress-top { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.progress-bar-wrap { flex: 1; display: flex; align-items: center; gap: 8px; }
.progress-bar-bg { flex: 1; height: 8px; background: #f0f0f0; border-radius: 4px; overflow: hidden; }
.progress-bar-fill { height: 100%; background: linear-gradient(90deg, var(--accent, #4a90d9), #67b8f7); border-radius: 4px; transition: width 0.3s ease; }
.progress-text { font-size: 12px; color: var(--text-muted, #999); min-width: 50px; text-align: right; }
.group-badge { background: var(--accent-bg, #f0f4f8); color: var(--accent, #4a90d9); padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 500; white-space: nowrap; }

/* 3D Flip Card */
.flashcard-wrapper { flex: 1; display: flex; align-items: center; justify-content: center; perspective: 1200px; padding: 16px 0; }
.flashcard {
  width: 100%; max-width: 440px; min-height: 340px;
  position: relative;
  transition: transform 0.4s ease;
  transform-style: preserve-3d;
}
.flashcard.flipped { transform: rotateY(180deg); }
.card-face {
  position: absolute; inset: 0;
  backface-visibility: hidden;
  display: flex; align-items: center; justify-content: center; flex-direction: column;
  padding: 32px 24px;
  border-radius: 20px;
  background: var(--bg-card, white);
  border: 1px solid var(--border-color, #e8e8e8);
  box-shadow: var(--shadow, 0 2px 8px rgba(0,0,0,0.06));
  min-height: 340px;
}
.card-back { transform: rotateY(180deg); }
.word-display { font-size: 36px; font-weight: 700; color: var(--text-primary, #2c3e50); letter-spacing: 1px; }
.phonetic-display { color: var(--text-muted, #999); font-size: 16px; margin-top: 8px; font-style: italic; }
.tap-hint { margin-top: 40px; display: flex; align-items: center; gap: 8px; color: var(--text-muted, #bbb); font-size: 13px; animation: pulse 2s infinite; }
@keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
.btn-speak {
  background: var(--accent-bg, #f0f7ff); border: 1px solid var(--accent, #4a90d9);
  color: var(--accent, #4a90d9); border-radius: 6px; padding: 4px 10px; font-size: 12px;
  cursor: pointer; transition: all 0.15s;
}
.btn-speak:hover { background: var(--accent, #4a90d9); color: white; }

.back-word { font-size: 28px; font-weight: 700; color: var(--text-primary, #2c3e50); }
.back-phonetic { font-size: 14px; color: var(--text-muted, #999); font-style: italic; margin: 4px 0; }
.back-pos { display: inline-block; background: #fef3c7; color: #92400e; padding: 2px 10px; border-radius: 6px; font-size: 12px; }
.back-meaning { font-size: 20px; color: var(--accent, #378ADD); font-weight: 600; margin: 12px 0 16px; padding: 8px 16px; background: var(--accent-bg, #f0f7ff); border-radius: 8px; }
.back-sentence { margin-top: 8px; padding: 0 8px; text-align: left; width: 100%; }
.sentence-en { color: var(--text-secondary, #555); font-style: italic; font-size: 13px; }
.sentence-zh { color: var(--text-muted, #999); font-size: 12px; margin-top: 2px; }
.back-extra { font-size: 13px; color: var(--text-secondary, #666); margin-top: 6px; padding: 0 8px; }
.extra-label { font-weight: 500; color: var(--text-muted, #888); }

/* Rating */
.rating-row { display: flex; gap: 10px; padding: 8px 0; }
.btn-rate {
  flex: 1; border: none; padding: 14px 4px; border-radius: 12px; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  transition: all 0.15s; font-size: 13px;
}
.btn-rate:hover { transform: translateY(-2px); }
.rate-icon { font-size: 24px; }
.rate-label { font-weight: 600; font-size: 14px; }
.rate-sub { font-size: 10px; opacity: 0.7; }
.rate-5 { background: #e8f5e9; color: #2e7d32; }
.rate-5:hover { background: #c8e6c9; }
.rate-3 { background: #fff3e0; color: #e65100; }
.rate-3:hover { background: #ffe0b2; }
.rate-1 { background: #fce4ec; color: #c62828; }
.rate-1:hover { background: #f8bbd0; }

/* SUMMARY */
.summary-screen { text-align: center; padding: 24px 16px; }
.summary-icon { font-size: 64px; margin-bottom: 8px; }
.summary-screen h2 { font-size: 26px; font-weight: 700; color: var(--text-primary, #2c3e50); }
.summary-subtitle { color: var(--text-muted, #888); font-size: 13px; margin-bottom: 20px; }

.summary-chart { background: var(--bg-card, white); border-radius: 12px; padding: 16px; margin-bottom: 16px; border: 1px solid var(--border-color, #e8e8e8); }
.chart-bar { display: flex; height: 16px; border-radius: 8px; overflow: hidden; margin-bottom: 10px; }
.chart-segment.correct { background: #52c41a; }
.chart-segment.fuzzy { background: #faad14; }
.chart-segment.forgot { background: #ff4d4f; }
.chart-legend { display: flex; justify-content: center; gap: 16px; font-size: 12px; color: var(--text-secondary, #666); }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
.dot.correct { background: #52c41a; }
.dot.fuzzy { background: #faad14; }
.dot.forgot { background: #ff4d4f; }

.summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
.summary-card { background: var(--bg-card, white); border: 1px solid var(--border-color, #e8e8e8); border-radius: 10px; padding: 12px; }
.summary-val { font-size: 22px; font-weight: 700; }
.summary-lbl { font-size: 11px; color: var(--text-muted, #888); margin-top: 2px; }

.wrong-preview { text-align: left; margin-bottom: 24px; }
.wrong-preview h4 { font-size: 14px; color: var(--text-secondary, #555); margin-bottom: 8px; }
.wrong-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.wrong-tag { background: #fce4ec; color: #c62828; padding: 4px 12px; border-radius: 16px; font-size: 12px; }
.wrong-tag.more { background: var(--border-color, #e8e8e8); color: var(--text-muted, #888); }

.done-msg { margin-top: 12px; font-size: 16px; color: var(--accent, #4a90d9); font-weight: 500; }

@media (min-width: 769px) {
  .card-face { min-height: 380px; }
  .word-display { font-size: 44px; }
}
</style>
