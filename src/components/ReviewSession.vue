<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getDueReviews, applyRating, createWordRecord, getQualityFromRating } from '../utils/ebbinghaus'
import { loadData, saveData } from '../utils/storage'
import { speakWordFire, initSpeech, isSpeechSupported } from '../utils/speech'
import type { VocabWord, WordRecord } from '../types/vocab'

const props = defineProps<{ appData: any; bookId?: string }>()
const emit = defineEmits<{ update: [data: any] }>()

const data = ref({ ...props.appData, records: { ...props.appData.records } })
const speechSupported = ref(false)

// State
const phase = ref<'ready' | 'review' | 'done'>('ready')
const reviewQueue = ref<VocabWord[]>([])
const currentIdx = ref(0)
const isFlipped = ref(false)
const showAnswer = ref(false)

const results = ref<Array<{ word: VocabWord; quality: number }>>([])
const startTime = ref(0)

const currentWord = computed(() => reviewQueue.value[currentIdx.value] || null)
const isLast = computed(() => currentIdx.value >= reviewQueue.value.length - 1)
const dueCount = computed(() => getDueReviews(data.value.records).length)

onMounted(() => {
  initSpeech()
  speechSupported.value = isSpeechSupported()
  loadReviews()
})

function loadReviews() {
  const bank = (window as any).__currentWordBank as VocabWord[] | undefined
  if (!bank) return
  const wordMap = new Map(bank.map(w => [w.word, w]))
  const due = getDueReviews(data.value.records)
  reviewQueue.value = due
    .map(r => wordMap.get(r.word))
    .filter((w): w is VocabWord => !!w)
}

function startReview() {
  phase.value = 'review'
  currentIdx.value = 0
  results.value = []
  startTime.value = Date.now()
  isFlipped.value = false
}

function flipCard() { isFlipped.value = true; speakCurrent() }
function speakCurrent() {
  if (currentWord.value && speechSupported.value) {
    speakWordFire(currentWord.value.word, { rate: 0.7 })
  }
}

function rateWord(rating: 'known' | 'fuzzy' | 'forgot') {
  if (!currentWord.value) return

  const quality = getQualityFromRating(rating)
  results.value.push({ word: currentWord.value, quality })

  if (isLast.value) {
    finishReview()
    return
  }

  isFlipped.value = false
  currentIdx.value++
  setTimeout(speakCurrent, 200)
}

function skipWord() {
  if (!currentWord.value) return
  results.value.push({ word: currentWord.value, quality: 0 })
  if (isLast.value) { finishReview(); return }
  isFlipped.value = false
  currentIdx.value++
}

function finishReview() {
  phase.value = 'done'
  const now = Date.now()

  results.value.forEach(r => {
    const existing = data.value.records[r.word.word] || createWordRecord(r.word.word)
    const studySec = Math.round((now - startTime.value) / Math.max(1, results.value.length))
    const updated = applyRating(existing, r.quality, studySec)
    data.value.records[r.word.word] = updated
  })

  saveData(data.value)
  emit('update', data.value)
}

function getPassCount() {
  return results.value.filter(r => r.quality >= 3).length
}

function getFailCount() {
  return results.value.filter(r => r.quality < 3).length
}
</script>

<template>
  <div class="review-view">
    <!-- READY -->
    <template v-if="phase === 'ready'">
      <div class="ready-section">
        <div class="ready-icon">🔄</div>
        <h2>到期复习</h2>
        <p class="ready-sub" v-if="dueCount > 0">有 {{ dueCount }} 个词需要复习</p>
        <p class="ready-sub" v-else>暂无到期复习词 🎉</p>
        <div class="ready-info" v-if="dueCount > 0">
          <div>📈 到期依据: SM-2 间隔重复算法</div>
          <div>⏱ 预计 {{ Math.ceil(dueCount / 10) }} 分钟</div>
        </div>
        <button v-if="dueCount > 0" class="btn-start" @click="startReview()">
          开始复习 🚀
        </button>
      </div>
    </template>

    <!-- REVIEW -->
    <template v-if="phase === 'review'">
      <div class="review-screen">
        <div class="review-progress">
          <div class="review-bar-bg">
            <div class="review-bar-fill" :style="{ width: (currentIdx / reviewQueue.length * 100) + '%' }"></div>
          </div>
          <span class="review-count">{{ currentIdx + 1 }}/{{ reviewQueue.length }}</span>
        </div>

        <div class="review-card-wrapper" @click="!isFlipped && flipCard()">
          <div class="review-card" :class="{ flipped: isFlipped }">
            <!-- Front -->
            <div class="rf" v-show="!isFlipped">
              <div class="rw">{{ currentWord?.word }}</div>
              <div class="rp" v-if="currentWord?.phonetic">/{{ currentWord.phonetic }}/</div>
              <div class="rhint">点击查看释义</div>
              <button v-if="speechSupported" class="rb-speak" @click.stop="speakCurrent()">🔊</button>
            </div>
            <!-- Back -->
            <div class="rb" v-show="isFlipped">
              <div class="rb-word">{{ currentWord?.word }}</div>
              <div class="rb-phonetic" v-if="currentWord?.phonetic">/{{ currentWord.phonetic }}/</div>
              <div class="rb-meaning">{{ currentWord?.meaning }}</div>
              <div v-if="currentWord?.sentences?.length" class="rb-sentence">
                {{ currentWord.sentences[0].en }}
                <div class="rb-sentence-zh">{{ currentWord.sentences[0].zh }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="review-actions" v-if="isFlipped">
          <button class="act act-known" @click="rateWord('known')">😊 认识</button>
          <button class="act act-fuzzy" @click="rateWord('fuzzy')">🤔 模糊</button>
          <button class="act act-forgot" @click="rateWord('forgot')">😅 忘记</button>
          <button class="act act-skip" @click="skipWord()">⏭</button>
        </div>
      </div>
    </template>

    <!-- DONE -->
    <template v-if="phase === 'done'">
      <div class="done-section">
        <div class="done-icon">{{ getPassCount() >= getFailCount() ? '🎉' : '💪' }}</div>
        <h2>复习完成！</h2>
        <p class="done-sub">{{ reviewQueue.length }} 个词 · 通过 {{ getPassCount() }} · 需重学 {{ getFailCount() }}</p>
        <div class="done-bar">
          <div class="done-pass" :style="{ width: (getPassCount() / Math.max(1, results.length) * 100) + '%' }"></div>
        </div>
        <button class="btn-start" @click="phase = 'ready'">返回</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.review-view { max-width: 520px; margin: 0 auto; }

.ready-section { text-align: center; padding: 40px 16px; }
.ready-icon { font-size: 64px; margin-bottom: 8px; }
.ready-section h2 { font-size: 24px; font-weight: 700; color: var(--text-primary, #2c3e50); }
.ready-sub { color: var(--text-muted, #888); font-size: 15px; margin-bottom: 24px; }
.ready-info { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; font-size: 14px; color: var(--text-secondary, #555); }

.btn-start { padding: 14px 48px; background: linear-gradient(135deg, var(--accent, #4a90d9), var(--accent-light, #357abd)); color: white; border: none; border-radius: 12px; font-size: 17px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
.btn-start:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(74,144,217,0.35); }

/* Review */
.review-screen { display: flex; flex-direction: column; min-height: calc(100vh - 160px); }
.review-progress { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
.review-bar-bg { flex: 1; height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden; }
.review-bar-fill { height: 100%; background: var(--accent, #4a90d9); border-radius: 3px; transition: width 0.3s; }
.review-count { font-size: 12px; color: var(--text-muted, #999); }

.review-card-wrapper { flex: 1; display: flex; align-items: center; justify-content: center; perspective: 1000px; padding: 16px 0; }
.review-card { width: 100%; max-width: 420px; min-height: 280px; position: relative; transition: transform 0.35s ease; transform-style: preserve-3d; }
.review-card.flipped { transform: rotateY(180deg); }
.rf, .rb { position: absolute; inset: 0; backface-visibility: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; border-radius: 18px; background: var(--bg-card, white); border: 1px solid var(--border-color, #e8e8e8); box-shadow: var(--shadow, 0 2px 8px rgba(0,0,0,0.06)); min-height: 280px; text-align: center; }
.rb { transform: rotateY(180deg); }
.rw { font-size: 32px; font-weight: 700; color: var(--text-primary, #2c3e50); }
.rp { color: var(--text-muted, #999); font-size: 14px; font-style: italic; margin-top: 6px; }
.rhint { margin-top: 32px; color: var(--text-muted, #bbb); font-size: 12px; animation: pulse 2s infinite; }
@keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
.rb-speak { margin-top: 16px; background: var(--accent-bg, #f0f7ff); border: 1px solid var(--accent, #4a90d9); color: var(--accent, #4a90d9); border-radius: 6px; padding: 4px 12px; cursor: pointer; font-size: 14px; }
.rb-word { font-size: 26px; font-weight: 700; color: var(--text-primary, #2c3e50); }
.rb-phonetic { font-size: 13px; color: var(--text-muted, #999); font-style: italic; margin: 4px 0; }
.rb-meaning { font-size: 18px; color: var(--accent, #378ADD); font-weight: 600; margin: 10px 0; }
.rb-sentence { font-size: 12px; color: var(--text-secondary, #555); font-style: italic; }
.rb-sentence-zh { color: var(--text-muted, #999); font-size: 11px; margin-top: 2px; }

.review-actions { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 8px; padding: 8px 0; }
.act { border: none; padding: 12px 8px; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.15s; }
.act:hover { transform: translateY(-2px); }
.act-known { background: #e8f5e9; color: #2e7d32; }
.act-fuzzy { background: #fff3e0; color: #e65100; }
.act-forgot { background: #fce4ec; color: #c62828; }
.act-skip { background: #f5f5f5; color: #888; font-size: 18px; }

/* Done */
.done-section { text-align: center; padding: 40px 16px; }
.done-icon { font-size: 64px; margin-bottom: 8px; }
.done-section h2 { font-size: 24px; font-weight: 700; color: var(--text-primary, #2c3e50); }
.done-sub { color: var(--text-muted, #888); font-size: 14px; margin-bottom: 20px; }
.done-bar { height: 10px; background: #f0f0f0; border-radius: 5px; overflow: hidden; margin-bottom: 24px; }
.done-pass { height: 100%; background: #52c41a; border-radius: 5px; transition: width 0.3s; }
</style>
