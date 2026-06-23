<script setup lang="ts">
import { ref, computed } from 'vue'
import type { AppData, VocabWord, WordRecord } from '../types/vocab'
import { getDueReviews, REVIEW_INTERVALS } from '../utils/ebbinghaus'
import { getWordBank } from '../utils/wordbank'

const props = defineProps<{ appData: AppData }>()
const emit = defineEmits<{ update: [data: AppData] }>()

const wordBank = getWordBank()
const reviews = computed(() => getDueReviews(props.appData.records, props.appData.currentDay))
const currentIndex = ref(0)
const showMeaning = ref(false)
const finished = ref(false)

interface DisplayWord {
  record: WordRecord
  info: VocabWord | undefined
}

const currentWord = computed<DisplayWord | null>(() => {
  if (currentIndex.value >= reviews.value.length) return null
  const record = reviews.value[currentIndex.value]
  const info = wordBank.find(w => w.word === record.word)
  return { record, info }
})

function revealMeaning() {
  showMeaning.value = true
}

function rate(rating: 'good' | 'hard' | 'again') {
  const record = reviews.value[currentIndex.value]
  if (!record) return

  const newData = { ...props.appData }
  const r = newData.records[record.word]
  if (!r) return

  if (rating === 'again') {
    r.reviewCount = 0
    r.wrongCount += 1
    r.nextReview = Date.now() + 86400000
  } else if (rating === 'hard') {
    r.reviewCount += 1
    r.nextReview = Date.now() + 86400000 * 2
  } else {
    r.reviewCount += 1
    const round = Math.min(r.reviewCount - 1, REVIEW_INTERVALS.length - 1)
    r.nextReview = Date.now() + 86400000 * REVIEW_INTERVALS[round]
    if (r.reviewCount >= 6) r.status = 'mastered'
  }
  r.lastReview = Date.now()
  emit('update', newData)

  showMeaning.value = false
  if (currentIndex.value + 1 >= reviews.value.length) {
    finished.value = true
  } else {
    currentIndex.value++
  }
}
</script>

<template>
  <div class="review-session">
    <h2>复习模式</h2>

    <!-- Progress -->
    <div class="progress-bar">
      <div class="prog-fill" :style="{ width: (currentIndex / reviews.length * 100) + '%' }"></div>
    </div>
    <div class="progress-text" v-if="!finished">
      {{ currentIndex + 1 }} / {{ reviews.length }}
    </div>

    <!-- Completed -->
    <div v-if="finished" class="completed">
      <div class="completed-icon">🎉</div>
      <div class="completed-text">今日复习完成！</div>
    </div>

    <!-- Review Card -->
    <div v-else-if="currentWord" class="review-card">
      <div class="word-display">{{ currentWord.record.word }}</div>

      <div v-if="currentWord.info?.phonetic" class="phonetic">{{ currentWord.info.phonetic }}</div>

      <button v-if="!showMeaning" class="btn-reveal" @click="revealMeaning">
        点击显示释义
      </button>

      <div v-else class="meaning-section">
        <div class="meaning">
          <span v-if="currentWord.info?.pos" class="pos">{{ currentWord.info.pos }}</span>
          {{ currentWord.info?.meaning || '未找到释义' }}
        </div>
        <div class="phrases" v-if="currentWord.info?.phrases?.length">
          <div v-for="p in currentWord.info.phrases" :key="p.phrase" class="phrase">
            <em>{{ p.phrase }}</em> — {{ p.translation }}
          </div>
        </div>
        <div class="rating-buttons">
          <button class="rate again" @click="rate('again')">🔴 忘了</button>
          <button class="rate hard" @click="rate('hard')">🟡 模糊</button>
          <button class="rate good" @click="rate('good')">🟢 认识</button>
        </div>
      </div>
    </div>

    <div v-else class="empty">
      <p>暂时没有需要复习的单词</p>
    </div>
  </div>
</template>

<style scoped>
.review-session {
  padding: 16px;
  background: white;
  border-radius: 12px;
  border: 0.5px solid #e8e8e8;
}
.review-session h2 {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0 0 16px;
}
.progress-bar {
  height: 8px;
  background: #e8e8e8;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 6px;
}
.prog-fill {
  height: 100%;
  background: linear-gradient(90deg, #378ADD, #1D9E75);
  border-radius: 4px;
  transition: width 0.3s;
}
.progress-text {
  text-align: center;
  font-size: 13px;
  color: #888;
  margin-bottom: 20px;
}
.completed {
  text-align: center;
  padding: 40px 0;
}
.completed-icon {
  font-size: 48px;
  margin-bottom: 12px;
}
.completed-text {
  font-size: 20px;
  font-weight: 600;
  color: #1D9E75;
}
.review-card {
  text-align: center;
  padding: 24px 16px;
}
.word-display {
  font-size: 28px;
  font-weight: 700;
  color: #185FA5;
  margin-bottom: 8px;
}
.phonetic {
  font-size: 14px;
  color: #999;
  margin-bottom: 20px;
}
.btn-reveal {
  display: inline-block;
  padding: 10px 32px;
  border: 0.5px solid #378ADD;
  background: white;
  color: #378ADD;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-reveal:hover {
  background: #378ADD;
  color: white;
}
.meaning-section {
  margin-top: 16px;
}
.meaning {
  font-size: 16px;
  color: #333;
  margin-bottom: 8px;
  line-height: 1.6;
}
.pos {
  font-size: 12px;
  color: #888;
  background: #f0f0f0;
  padding: 1px 6px;
  border-radius: 4px;
  margin-right: 4px;
}
.phrases {
  margin: 12px 0;
  font-size: 13px;
  color: #666;
}
.phrase {
  margin-bottom: 4px;
}
.phrase em {
  color: #185FA5;
}
.rating-buttons {
  display: flex;
  gap: 10px;
  margin-top: 24px;
}
.rate {
  flex: 1;
  padding: 10px 0;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  background: white;
  transition: all 0.2s;
}
.rate.again {
  border: 0.5px solid #E24B4A;
  color: #E24B4A;
}
.rate.again:hover {
  background: #E24B4A;
  color: white;
}
.rate.hard {
  border: 0.5px solid #BA7517;
  color: #BA7517;
}
.rate.hard:hover {
  background: #BA7517;
  color: white;
}
.rate.good {
  border: 0.5px solid #1D9E75;
  color: #1D9E75;
}
.rate.good:hover {
  background: #1D9E75;
  color: white;
}
.empty {
  text-align: center;
  padding: 40px 0;
  color: #999;
}
</style>
