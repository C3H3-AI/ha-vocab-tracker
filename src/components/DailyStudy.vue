<script setup lang="ts">
import { ref, computed } from 'vue'
import type { VocabWord, AppData, WordRecord } from '../types/vocab'
import { getWordsForDay, TOTAL_WORDS } from '../utils/wordbank'
import { getDueReviews, REVIEW_INTERVALS } from '../utils/ebbinghaus'

const props = defineProps<{ appData: AppData }>()
const emit = defineEmits<{ update: [data: AppData] }>()

const wordsPerDay = 50
const newWords = computed(() => getWordsForDay(props.appData.currentDay, wordsPerDay))
const dueReviews = computed(() => getDueReviews(props.appData.records, props.appData.currentDay))
const knownWords = ref<Set<string>>(new Set())
const showAnswer = ref<Set<string>>(new Set())
const morningDone = ref(false)
const eveningDone = ref(false)

const progress = computed(() => {
  const total = wordsPerDay
  const done = knownWords.value.size
  return Math.round(done / total * 100)
})

function markKnown(word: string) {
  knownWords.value.add(word)
  updateRecord(word, 'known')
}

function toggleAnswer(word: string) {
  if (showAnswer.value.has(word)) showAnswer.value.delete(word)
  else showAnswer.value.add(word)
}

function rateReview(word: string, rating: 'good' | 'hard' | 'again') {
  const record = props.appData.records[word]
  if (!record) return
  const newData = { ...props.appData }
  if (!newData.records[word]) return
  
  const r = newData.records[word]
  if (rating === 'again') {
    r.reviewCount = 0
    r.wrongCount += 1
    r.nextReview = Date.now() + 86400000 // 1 day
  } else if (rating === 'hard') {
    r.reviewCount += 1
    r.nextReview = Date.now() + 86400000 * 2 // 2 days
  } else {
    r.reviewCount += 1
    const round = Math.min(r.reviewCount - 1, REVIEW_INTERVALS.length - 1)
    r.nextReview = Date.now() + 86400000 * REVIEW_INTERVALS[round]
    if (r.reviewCount >= 6) {
      r.status = 'mastered'
      newData.totalLearned += 1
    }
  }
  r.lastReview = Date.now()
  emit('update', newData)
}

function updateRecord(word: string, status: string) {
  const newData = { ...props.appData }
  if (!newData.records[word]) {
    newData.records[word] = {
      word,
      status: 'learning',
      reviewCount: 0,
      nextReview: Date.now() + 86400000,
      lastReview: Date.now(),
      wrongCount: 0
    }
    newData.totalLearned += 1
  }
  emit('update', newData)
}

function completeTask() {
  const newData = { ...props.appData }
  newData.lastCheckin = new Date().toISOString()
  emit('update', newData)
}
</script>

<template>
  <div class="daily-study">
    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-num">{{ newWords.length }}</div>
        <div class="stat-label">今日新词</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ dueReviews.length }}</div>
        <div class="stat-label">待复习</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ progress }}%</div>
        <div class="stat-label">完成率</div>
      </div>
    </div>

    <!-- Progress bar -->
    <div class="progress-section">
      <div class="prog-bar">
        <div class="prog-fill" :style="{ width: progress + '%' }"></div>
      </div>
    </div>

    <!-- New Words -->
    <section class="word-section">
      <h2>📖 今日新词 ({{ newWords.length }})</h2>
      <div v-for="(w, i) in newWords" :key="w.word" class="word-card">
        <div class="word-main">
          <span class="word-idx">{{ i + 1 }}</span>
          <span class="word-text">{{ w.word }}</span>
          <span class="word-pos" v-if="w.pos">{{ w.pos }}</span>
          <span class="word-meaning">{{ w.meaning }}</span>
        </div>
        <button v-if="!knownWords.has(w.word)" class="btn-known" @click="markKnown(w.word)">✓ 已掌握</button>
        <span v-else class="tag-done">✅ 已掌握</span>
      </div>
    </section>

    <!-- Reviews -->
    <section class="word-section" v-if="dueReviews.length > 0">
      <h2>🔄 今日需复习 ({{ dueReviews.length }})</h2>
      <div v-for="r in dueReviews" :key="r.word" class="word-card review-card">
        <div class="word-main">
          <span class="word-text">{{ r.word }}</span>
          <button class="btn-answer" @click="toggleAnswer(r.word)">
            {{ showAnswer.has(r.word) ? '隐藏' : '显示释义' }}
          </button>
        </div>
        <div v-if="showAnswer.has(r.word)" class="review-answer">
          <p class="answer-meaning">{{ r.word }}</p>
          <div class="rating-btns">
            <button class="rate again" @click="rateReview(r.word, 'again')">🔴 忘了</button>
            <button class="rate hard" @click="rateReview(r.word, 'hard')">🟡 模糊</button>
            <button class="rate good" @click="rateReview(r.word, 'good')">🟢 认识</button>
          </div>
        </div>
      </div>
    </section>

    <!-- Complete Button -->
    <button class="btn-complete" @click="completeTask">
      ✅ 完成今日任务
    </button>
  </div>
</template>

<style scoped>
.daily-study { padding-bottom: 16px; }
.stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
.stat-card { background: white; border-radius: 10px; padding: 12px; text-align: center; border: 0.5px solid #e8e8e8; }
.stat-num { font-size: 24px; font-weight: 600; color: #378ADD; }
.stat-label { font-size: 12px; color: #888; margin-top: 2px; }
.progress-section { margin-bottom: 16px; }
.prog-bar { height: 8px; background: #e8e8e8; border-radius: 4px; overflow: hidden; }
.prog-fill { height: 100%; background: linear-gradient(90deg, #1D9E75, #378ADD); border-radius: 4px; transition: width 0.3s; }
.word-section { margin-bottom: 16px; }
.word-section h2 { font-size: 15px; font-weight: 600; margin-bottom: 8px; color: #333; }
.word-card { 
  background: white; border-radius: 8px; padding: 10px 12px; 
  margin-bottom: 4px; border: 0.5px solid #e8e8e8;
  display: flex; justify-content: space-between; align-items: center;
}
.word-main { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex: 1; }
.word-idx { font-size: 11px; color: #bbb; min-width: 20px; }
.word-text { font-size: 15px; font-weight: 600; color: #185FA5; }
.word-pos { font-size: 11px; color: #888; background: #f0f0f0; padding: 1px 6px; border-radius: 4px; }
.word-meaning { font-size: 13px; color: #555; }
.btn-known { 
  border: 0.5px solid #1D9E75; background: white; color: #1D9E75;
  padding: 4px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; white-space: nowrap;
}
.btn-known:hover { background: #1D9E75; color: white; }
.tag-done { font-size: 12px; color: #1D9E75; white-space: nowrap; }
.review-card { flex-direction: column; align-items: stretch; }
.review-answer { margin-top: 8px; padding-top: 8px; border-top: 0.5px solid #e8e8e8; }
.answer-meaning { font-size: 14px; color: #333; margin-bottom: 8px; }
.rating-btns { display: flex; gap: 8px; }
.rate { flex: 1; border: 0.5px solid #ddd; background: white; padding: 6px; border-radius: 6px; font-size: 12px; cursor: pointer; }
.rate.again { color: #E24B4A; border-color: #E24B4A; }
.rate.hard { color: #BA7517; border-color: #BA7517; }
.rate.good { color: #1D9E75; border-color: #1D9E75; }
.btn-answer { border: 0.5px solid #378ADD; background: white; color: #378ADD; padding: 2px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; }
.btn-complete {
  display: block; width: 100%; padding: 12px; border: none;
  background: linear-gradient(135deg, #378ADD, #1D9E75); color: white;
  border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer;
  margin-top: 16px;
}
</style>
