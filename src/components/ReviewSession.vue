<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getDueReviews, applyRating, generateDistractors } from '../utils/ebbinghaus'
import { getWordsForDay } from '../utils/wordbank'
import { loadData, saveData } from '../utils/storage'
import type { VocabWord, WordRecord } from '../types/vocab'

const props = defineProps<{ appData: any; bookId?: string }>()
const emit = defineEmits<{ update: [data: any] }>()

const data = ref({ ...props.appData, records: { ...props.appData.records } })

// Review state
const phase = ref<'select' | 'playing' | 'done'>('select')
const mode = ref<'choice' | 'spell' | 'speed' | 'listen'>('choice')
const reviewWords = ref<WordRecord[]>([])
const reviewVocabWords = ref<VocabWord[]>([])
const currentIdx = ref(0)
const correctCount = ref(0)
const wrongCount = ref(0)
const userInput = ref('')
const showAnswer = ref(false)
const feedback = ref<'correct' | 'wrong' | null>(null)
const choices = ref<string[]>([])
const selectedChoice = ref('')
const saidCount = ref(0)

// Speech synthesis
function playCurrentWord() {
  if (!currentWord.value) return
  const utterance = new SpeechSynthesisUtterance(currentWord.value.word)
  utterance.lang = 'en-US'
  utterance.rate = 0.85
  utterance.pitch = 1
  speechSynthesis.cancel()
  speechSynthesis.speak(utterance)
  saidCount.value++
}

const totalCount = computed(() => reviewVocabWords.value.length)
const currentWord = computed(() => reviewVocabWords.value[currentIdx.value] || null)
const currentRecord = computed(() => {
  if (!currentWord.value) return null
  return data.value.records[currentWord.value.word] || null
})
const progress = computed(() => {
  if (totalCount.value === 0) return 0
  return Math.round((currentIdx.value / totalCount.value) * 100)
})

const ALL_WORDS = ref<Array<{ word: string; meaning: string }>>([])

onMounted(() => {
  loadReviews()
})

function loadReviews() {
  const due = getDueReviews(data.value.records)
  const wordMap = new Map<string, VocabWord>()
  
  const bank = (window as any).__currentWordBank
  if (bank && Array.isArray(bank)) {
    bank.forEach((w: VocabWord) => wordMap.set(w.word, w))
  } else {
    // Fallback: try loading from wordbank days
    for (let d = 1; d <= 48; d++) {
      getWordsForDay([], d, 50).forEach((w: VocabWord) => wordMap.set(w.word, w))
    }
  }
  
  reviewWords.value = due
  reviewVocabWords.value = due
    .map(r => wordMap.get(r.word))
    .filter((w): w is VocabWord => !!w)
  
  // Build all words list for distractors
  ALL_WORDS.value = Array.from(wordMap.values()).map(w => ({
    word: w.word,
    meaning: w.meaning
  }))
}

function setMode(m: 'choice' | 'spell' | 'speed' | 'listen') {
  mode.value = m
  phase.value = 'playing'
  currentIdx.value = 0
  correctCount.value = 0
  wrongCount.value = 0
  nextWord()
}

function nextWord() {
  if (currentIdx.value >= totalCount.value) {
    phase.value = 'done'
    saveData(data.value)
    emit('update', data.value)
    return
  }
  showAnswer.value = false
  feedback.value = null
  userInput.value = ''
  selectedChoice.value = ''
  saidCount.value = 0
  
  if (mode.value === 'choice') {
    generateChoices()
  }
}

function generateChoices() {
  if (!currentWord.value) return
  const distractors = generateDistractors(currentWord.value.meaning, ALL_WORDS.value, 3)
  const all = [currentWord.value.meaning, ...distractors]
  choices.value = all.sort(() => Math.random() - 0.5)
}

function selectChoice(choice: string) {
  if (feedback.value) return
  selectedChoice.value = choice
  showAnswer.value = true
  
  if (choice === currentWord.value?.meaning) {
    feedback.value = 'correct'
    correctCount.value++
  } else {
    feedback.value = 'wrong'
    wrongCount.value++
  }
}

function checkSpelling() {
  if (!currentWord.value) return
  showAnswer.value = true
  const correct = userInput.value.trim().toLowerCase() === currentWord.value.word.toLowerCase()
  
  if (correct) {
    feedback.value = 'correct'
    correctCount.value++
  } else {
    feedback.value = 'wrong'
    wrongCount.value++
  }
}

function handleKnown() {
  feedback.value = 'correct'
  correctCount.value++
  showAnswer.value = true
}

function handleForgot() {
  feedback.value = 'wrong'
  wrongCount.value++
  showAnswer.value = true
}

function nextReview() {
  currentIdx.value++
  nextWord()
}

function restart() {
  phase.value = 'select'
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${h}:${m}`
}

function getAccuracy(): string {
  const total = correctCount.value + wrongCount.value
  if (total === 0) return '0%'
  return Math.round((correctCount.value / total) * 100) + '%'
}
</script>

<template>
  <div class="review-view">
    <!-- MODE SELECT -->
    <template v-if="phase === 'select'">
      <div class="select-screen">
        <div class="select-icon">🔄</div>
        <h2>选择复习模式</h2>
        <p class="select-subtitle">
          今日需复习 <strong>{{ totalCount }}</strong> 个词
        </p>

        <div class="mode-list">
          <div class="mode-card" @click="setMode('choice')">
            <div class="mode-icon">📝</div>
            <div class="mode-info">
              <div class="mode-name">选择题模式</div>
              <div class="mode-desc">从四个选项中选出正确释义</div>
            </div>
          </div>
          <div class="mode-card" @click="setMode('spell')">
            <div class="mode-icon">✏️</div>
            <div class="mode-info">
              <div class="mode-name">拼写模式</div>
              <div class="mode-desc">看中文释义，拼写出完整单词</div>
            </div>
          </div>
          <div class="mode-card" @click="setMode('speed')">
            <div class="mode-icon">⚡</div>
            <div class="mode-info">
              <div class="mode-name">快速刷词</div>
              <div class="mode-desc">快速过一遍，认识/不认识</div>
            </div>
          </div>
          <div class="mode-card" @click="setMode('listen')">
            <div class="mode-icon">🔊</div>
            <div class="mode-info">
              <div class="mode-name">听音拼写</div>
              <div class="mode-desc">听发音→拼写，锻炼听力+拼写</div>
            </div>
          </div>
        </div>
        
        <div class="review-count" v-if="totalCount === 0">
          🎉 今日没有需要复习的词！<br>
          <span class="hint">去学习新词吧</span>
        </div>
      </div>
    </template>

    <!-- PLAYING -->
    <template v-if="phase === 'playing'">
      <div class="play-screen">
        <!-- Progress -->
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" :style="{ width: progress + '%' }"></div>
        </div>
        <div class="play-header">
          <span class="score-correct">✓ {{ correctCount }}</span>
          <span class="score-wrong">✗ {{ wrongCount }}</span>
          <span class="play-count">{{ currentIdx + 1 }}/{{ totalCount }}</span>
        </div>

        <!-- CHOICE MODE -->
        <template v-if="mode === 'choice'">
          <div class="choice-word">{{ currentWord?.word }}</div>
          <div class="choice-phonetic" v-if="currentWord?.phonetic">/{{ currentWord.phonetic }}/</div>
          <div class="choices">
            <button
              v-for="(c, i) in choices" :key="i"
              :class="[
                'choice-btn',
                { selected: selectedChoice === c },
                { correct: showAnswer && c === currentWord?.meaning },
                { wrong: showAnswer && selectedChoice === c && c !== currentWord?.meaning }
              ]"
              @click="selectChoice(c)"
              :disabled="showAnswer"
            >
              {{ c }}
            </button>
          </div>
          <div class="feedback-row" v-if="showAnswer">
            <div class="feedback correct" v-if="feedback === 'correct'">✅ 正确！</div>
            <div class="feedback wrong" v-else>
              ❌ 正确释义：<strong>{{ currentWord?.meaning }}</strong>
            </div>
            <button class="btn-next" @click="nextReview()" v-if="showAnswer">继续 →</button>
          </div>
        </template>

        <!-- SPELL MODE -->
        <template v-if="mode === 'spell'">
          <div class="spell-hint">{{ currentWord?.meaning }}</div>
          <div class="spell-pos" v-if="currentWord?.pos">{{ currentWord.pos }}</div>
          <div class="spell-input-wrap">
            <input
              v-model="userInput"
              class="spell-input"
              :class="{ correct: feedback === 'correct', wrong: feedback === 'wrong' }"
              placeholder="输入英文单词..."
              @keyup.enter="!showAnswer && checkSpelling()"
              :disabled="showAnswer"
              autofocus
            />
          </div>
          <div class="spell-actions" v-if="!showAnswer">
            <button class="btn-check" @click="checkSpelling()">确认</button>
          </div>
          <div class="feedback-row" v-if="showAnswer">
            <div class="feedback correct" v-if="feedback === 'correct'">✅ {{ currentWord?.word }} 拼写正确！</div>
            <div class="feedback wrong" v-else>
              ❌ 正确拼写：<strong>{{ currentWord?.word }}</strong>
              <span v-if="currentWord?.phonetic" class="phonetic-hint"> /{{ currentWord.phonetic }}/</span>
            </div>
            <button class="btn-next" @click="nextReview()">继续 →</button>
          </div>
        </template>

        <!-- SPEED MODE -->
        <template v-if="mode === 'speed'">
          <div class="speed-card" v-if="!showAnswer">
            <div class="speed-word">{{ currentWord?.word }}</div>
            <div class="speed-phonetic" v-if="currentWord?.phonetic">/{{ currentWord.phonetic }}/</div>
            <div class="speed-actions">
              <button class="btn-known" @click="handleKnown()">😊 认识</button>
              <button class="btn-forgot" @click="handleForgot()">😅 不认识</button>
            </div>
          </div>
          <div class="speed-reveal" v-else>
            <div class="speed-word">{{ currentWord?.word }}</div>
            <div class="speed-meaning">{{ currentWord?.meaning }}</div>
            <div class="speed-sentence" v-if="currentWord?.sentences?.length">
              {{ currentWord.sentences[0].en }}
            </div>
            <button class="btn-next" @click="nextReview()">继续 →</button>
          </div>
        </template>

        <!-- LISTEN MODE -->
        <template v-if="mode === 'listen'">
          <div class="listen-section">
            <div class="listen-hint">听发音，拼写出单词</div>
            <div class="listen-play-section">
              <button class="btn-listen" @click="playCurrentWord()" :disabled="!currentWord">
                <span class="listen-icon">🔊</span>
                <span>播放读音</span>
              </button>
              <div class="listen-said" v-if="saidCount > 0">已播放 {{ saidCount }} 次</div>
            </div>
            <div class="spell-input-wrap">
              <input
                v-model="userInput"
                class="spell-input"
                :class="{ correct: feedback === 'correct', wrong: feedback === 'wrong' }"
                placeholder="输入听到的单词..."
                @keyup.enter="!showAnswer && checkSpelling()"
                :disabled="showAnswer"
                autofocus
              />
            </div>
            <div class="spell-actions" v-if="!showAnswer">
              <button class="btn-check" @click="checkSpelling()">确认</button>
            </div>
            <div class="feedback-row" v-if="showAnswer">
              <div class="feedback correct" v-if="feedback === 'correct'">✅ 听写正确！</div>
              <div class="feedback wrong" v-else>
                ❌ 正确拼写：<strong>{{ currentWord?.word }}</strong>
                <span v-if="currentWord?.phonetic" class="phonetic-hint"> /{{ currentWord.phonetic }}/</span>
              </div>
              <button class="btn-next" @click="nextReview()">继续 →</button>
            </div>
          </div>
        </template>
      </div>
    </template>

    <!-- DONE -->
    <template v-if="phase === 'done'">
      <div class="done-screen">
        <div class="done-icon">✅</div>
        <h2>复习完成！</h2>
        <div class="done-stats">
          <div class="done-stat">
            <div class="ds-val correct">{{ correctCount }}</div>
            <div class="ds-lbl">正确</div>
          </div>
          <div class="done-stat">
            <div class="ds-val wrong-num">{{ wrongCount }}</div>
            <div class="ds-lbl">错误</div>
          </div>
          <div class="done-stat">
            <div class="ds-val">{{ getAccuracy() }}</div>
            <div class="ds-lbl">准确率</div>
          </div>
        </div>
        <div class="done-actions">
          <button class="btn-start" @click="restart()">再来一轮</button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.review-view {
  max-width: 500px;
  margin: 0 auto;
}

/* Mode select */
.select-screen {
  text-align: center;
  padding: 20px 0;
}
.select-icon { font-size: 56px; margin-bottom: 8px; }
.select-screen h2 { font-size: 24px; color: #2c3e50; margin-bottom: 4px; }
.select-subtitle { color: #888; font-size: 14px; margin-bottom: 24px; }
.select-subtitle strong { color: #4a90d9; }

.mode-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mode-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.mode-card:hover {
  border-color: #4a90d9;
  box-shadow: 0 2px 8px rgba(74,144,217,0.12);
}
.mode-icon { font-size: 32px; }
.mode-name { font-weight: 600; color: #333; font-size: 15px; }
.mode-desc { color: #999; font-size: 12px; margin-top: 2px; }

.review-count { margin-top: 24px; color: #888; font-size: 15px; }
.hint { color: #bbb; font-size: 13px; }

/* Play screen */
.play-screen {
  padding: 8px 0;
}
.progress-bar-bg {
  height: 6px;
  background: #f0f0f0;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}
.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #4a90d9, #67b8f7);
  border-radius: 3px;
  transition: width 0.3s;
}
.play-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.score-correct { color: #52c41a; font-weight: 600; font-size: 15px; }
.score-wrong { color: #ff4d4f; font-weight: 600; font-size: 15px; }
.play-count { color: #999; font-size: 13px; }

/* Choice mode */
.choice-word {
  text-align: center;
  font-size: 32px;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 4px;
}
.choice-phonetic {
  text-align: center;
  color: #999;
  font-size: 14px;
  font-style: italic;
  margin-bottom: 24px;
}
.choices {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.choice-btn {
  padding: 14px 16px;
  border: 2px solid #e8e8e8;
  border-radius: 12px;
  background: white;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}
.choice-btn:hover:not(:disabled) {
  border-color: #4a90d9;
  background: #f8faff;
}
.choice-btn.selected { border-color: #4a90d9; }
.choice-btn.correct { border-color: #52c41a; background: #f0faf0; }
.choice-btn.wrong { border-color: #ff4d4f; background: #fff0f0; }
.choice-btn:disabled { cursor: default; }

/* Spell mode */
.spell-hint {
  text-align: center;
  font-size: 20px;
  font-weight: 600;
  color: #378ADD;
  margin-bottom: 4px;
}
.spell-pos {
  text-align: center;
  color: #e67e22;
  font-size: 13px;
  margin-bottom: 24px;
}
.spell-input-wrap { text-align: center; margin-bottom: 12px; }
.spell-input {
  width: 100%;
  max-width: 320px;
  padding: 14px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  font-size: 20px;
  text-align: center;
  outline: none;
  transition: border-color 0.2s;
}
.spell-input:focus { border-color: #4a90d9; }
.spell-input.correct { border-color: #52c41a; background: #f0faf0; }
.spell-input.wrong { border-color: #ff4d4f; background: #fff0f0; }
.spell-actions { text-align: center; }
.btn-check {
  padding: 10px 32px;
  background: #4a90d9;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
}

/* Speed mode */
.speed-card { text-align: center; padding: 40px 0; }
.speed-word { font-size: 32px; font-weight: 700; color: #2c3e50; margin-bottom: 4px; }
.speed-phonetic { color: #999; font-size: 14px; margin-bottom: 24px; }
.speed-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
}
.btn-known, .btn-forgot {
  padding: 12px 28px;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-known { background: #e8f5e9; color: #2e7d32; }
.btn-forgot { background: #fce4ec; color: #c62828; }
.btn-known:hover { background: #c8e6c9; }
.btn-forgot:hover { background: #f8bbd0; }

.speed-reveal { text-align: center; padding: 24px 0; }
.speed-meaning {
  font-size: 18px;
  color: #378ADD;
  margin: 8px 0;
  font-weight: 600;
}
.speed-sentence {
  font-style: italic;
  color: #666;
  font-size: 13px;
  margin-bottom: 16px;
}

/* Common */
.feedback-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding: 12px 16px;
  background: white;
  border-radius: 10px;
  border: 1px solid #e8e8e8;
}
.feedback { font-size: 15px; }
.feedback.correct { color: #52c41a; }
.feedback.wrong { color: #ff4d4f; font-size: 14px; }
.feedback.wrong strong { font-size: 16px; }
.phonetic-hint { color: #999; font-size: 13px; }

/* Listen mode */
.listen-section { text-align: center; padding: 20px 0; }
.listen-hint { font-size: 15px; color: #666; margin-bottom: 20px; }
.listen-play-section { margin-bottom: 20px; }
.btn-listen {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 16px 32px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 16px;
  font-size: 17px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-listen:hover { transform: scale(1.05); box-shadow: 0 4px 16px rgba(102,126,234,0.4); }
.listen-icon { font-size: 28px; }
.listen-said { margin-top: 8px; color: #999; font-size: 12px; }

.btn-next {
  padding: 8px 20px;
  background: #4a90d9;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

/* Done */
.done-screen { text-align: center; padding: 40px 16px; }
.done-icon { font-size: 64px; margin-bottom: 8px; }
.done-screen h2 { font-size: 26px; color: #2c3e50; margin-bottom: 20px; }
.done-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 24px;
}
.done-stat {
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  padding: 16px;
}
.ds-val { font-size: 28px; font-weight: 700; }
.ds-val.correct { color: #52c41a; }
.ds-val.wrong-num { color: #ff4d4f; }
.ds-lbl { font-size: 12px; color: #888; margin-top: 4px; }
.done-actions { margin-top: 8px; }
</style>
