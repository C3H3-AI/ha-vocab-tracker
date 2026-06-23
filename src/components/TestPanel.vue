<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getWordsForDay } from '../utils/wordbank'
import { getDueReviews } from '../utils/ebbinghaus'
import { loadData, saveData } from '../utils/storage'
import type { VocabWord } from '../types/vocab'

const props = defineProps<{ appData: any; bookId?: string }>()
const emit = defineEmits<{ update: [data: any] }>()

const WORDS_PER_DAY = 50

// Test modes
type TestMode = 'today' | 'review' | 'wrong' | 'range'
const testMode = ref<TestMode>('today')
const rangeStart = ref(1)
const rangeEnd = ref(5)

// State
type Phase = 'setup' | 'testing' | 'result'
const phase = ref<Phase>('setup')
const testWords = ref<VocabWord[]>([])
const currentIdx = ref(0)
const userInput = ref('')
const showAnswer = ref(false)
const isCorrect = ref(false)
const isChecked = ref(false)
const correctCount = ref(0)
const wrongCount = ref(0)
const wrongList = ref<VocabWord[]>([])
const startTime = ref(0)
const elapsed = ref(0)
const hintLetter = ref('')
const hintMode = ref<'typing' | 'choice'>('typing')
const options = ref<string[]>([])
const selectedOption = ref('')

const currentWord = computed(() => testWords.value[currentIdx.value] || null)
const progress = computed(() => testWords.value.length > 0 
  ? Math.round((currentIdx.value / testWords.value.length) * 100) : 0)

function prepareTest() {
  phase.value = 'setup'
}

function startTest() {
  const bank = (window as any).__currentWordBank
  if (!bank || !Array.isArray(bank)) {
    wrongList.value = [null as any]
    return
  }

  let words: VocabWord[] = []
  const data = loadData()
  const progress = data.bookId ? (data.bookProgress?.[data.bookId] || data.bookProgress?.[Object.keys(data.bookProgress || {})[0]]) : null
  const currentDay = progress?.currentDay || 1

  switch (testMode.value) {
    case 'today':
      words = getWordsForDay(bank, currentDay, WORDS_PER_DAY)
      break
    case 'review': {
      const records = progress?.records || {}
      const due = getDueReviews(records)
      const wordMap = new Map(bank.map((w: VocabWord) => [w.word, w]))
      words = due.map(r => wordMap.get(r.word)).filter(Boolean)
      break
    }
    case 'wrong':
      words = getWrongWords(bank)
      break
    case 'range': {
      const start = Math.max(1, rangeStart.value)
      const end = Math.min(Math.ceil(bank.length / WORDS_PER_DAY), rangeEnd.value)
      words = []
      for (let d = start; d <= end; d++) {
        words.push(...getWordsForDay(bank, d, WORDS_PER_DAY))
      }
      break
    }
  }

  // Shuffle
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]]
  }

  testWords.value = words.length > 0 ? words : bank.slice(0, 50)
  phase.value = 'testing'
  currentIdx.value = 0
  correctCount.value = 0
  wrongCount.value = 0
  wrongList.value = []
  startTime.value = Date.now()
  elapsed.value = 0
  showNext()
}

function getWrongWords(bank: VocabWord[]): VocabWord[] {
  const data = loadData()
  const wrongMap = data.wrongWords || {}
  const wordSet = new Set(Object.keys(wrongMap))
  return bank.filter(w => wordSet.has(w.word))
}

function showNext() {
  userInput.value = ''
  showAnswer.value = false
  isChecked.value = false
  hintLetter.value = ''
  selectedOption.value = ''

  if (!currentWord.value) return

  // Generate hint: first letter
  hintLetter.value = currentWord.value.word.charAt(0).toLowerCase()

  // Generate 4 options for choice mode
  const wrong = testWords.value
    .filter(w => w.word !== currentWord.value?.word)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
  options.value = [currentWord.value.word, ...wrong.map(w => w.word)].sort(() => Math.random() - 0.5)
}

function checkAnswer() {
  if (!currentWord.value || isChecked.value) return
  isChecked.value = true
  showAnswer.value = true

  if (hintMode.value === 'typing') {
    const answer = userInput.value.trim().toLowerCase()
    const expected = currentWord.value.word.toLowerCase()
    isCorrect.value = answer === expected
  } else {
    isCorrect.value = selectedOption.value === currentWord.value.word
  }

  if (isCorrect.value) {
    correctCount.value++
  } else {
    wrongCount.value++
    wrongList.value.push(currentWord.value)
  }
}

function nextWord() {
  if (currentIdx.value < testWords.value.length - 1) {
    currentIdx.value++
    showNext()
  } else {
    finishTest()
  }
}

function skipWord() {
  if (!currentWord.value) return
  wrongCount.value++
  wrongList.value.push(currentWord.value)
  nextWord()
}

function finishTest() {
  phase.value = 'result'
  elapsed.value = Math.round((Date.now() - startTime.value) / 1000)

  // Save wrong words
  const data = loadData()
  if (!data.wrongWords) data.wrongWords = {}
  wrongList.value.forEach(w => {
    data.wrongWords[w.word] = (data.wrongWords[w.word] || 0) + 1
  })

  // Save test history
  if (!data.testHistory) data.testHistory = []
  data.testHistory.push({
    date: new Date().toISOString(),
    mode: testMode.value,
    correct: correctCount.value,
    wrong: wrongCount.value,
    total: testWords.value.length,
    elapsed: elapsed.value,
    wrongWords: wrongList.value.map(w => w.word),
    bookId: (window as any).__currentWordBank?.bookId || 'unknown'
  })
  // Keep only last 100 tests
  if (data.testHistory.length > 100) {
    data.testHistory = data.testHistory.slice(-100)
  }

  saveData(data)
  emit('update', data)
}

function restart() {
  phase.value = 'setup'
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}分${s}秒`
}

function getAccuracy(): number {
  const total = correctCount.value + wrongCount.value
  return total > 0 ? Math.round((correctCount.value / total) * 100) : 0
}
</script>

<template>
  <div class="test-view">
    <!-- SETUP SCREEN -->
    <template v-if="phase === 'setup'">
      <div class="setup-screen">
        <h2 class="setup-title">📝 词汇测试</h2>
        <p class="setup-subtitle">打印后回到 HA 测试自己</p>

        <div class="mode-list">
          <label class="mode-item" :class="{ active: testMode === 'today' }">
            <input type="radio" v-model="testMode" value="today" />
            <div class="mode-content">
              <span class="mode-icon">📖</span>
              <div>
                <div class="mode-name">今日新词</div>
                <div class="mode-desc">测试今天刚学的 50 个词</div>
              </div>
            </div>
          </label>
          <label class="mode-item" :class="{ active: testMode === 'review' }">
            <input type="radio" v-model="testMode" value="review" />
            <div class="mode-content">
              <span class="mode-icon">🔄</span>
              <div>
                <div class="mode-name">到期复习词</div>
                <div class="mode-desc">按艾宾浩斯曲线到期的旧词</div>
              </div>
            </div>
          </label>
          <label class="mode-item" :class="{ active: testMode === 'wrong' }">
            <input type="radio" v-model="testMode" value="wrong" />
            <div class="mode-content">
              <span class="mode-icon">📕</span>
              <div>
                <div class="mode-name">错词本</div>
                <div class="mode-desc">之前记错的单词</div>
              </div>
            </div>
          </label>
          <label class="mode-item" :class="{ active: testMode === 'range' }">
            <input type="radio" v-model="testMode" value="range" />
            <div class="mode-content">
              <span class="mode-icon">📚</span>
              <div>
                <div class="mode-name">指定范围</div>
                <div class="mode-desc">选择 Day 范围批量测试</div>
              </div>
            </div>
          </label>
        </div>

        <div v-if="testMode === 'range'" class="range-inputs">
          <div class="range-group">
            <label>从 Day</label>
            <input type="number" v-model.number="rangeStart" min="1" class="range-num" />
          </div>
          <div class="range-group">
            <label>到 Day</label>
            <input type="number" v-model.number="rangeEnd" :min="rangeStart" class="range-num" />
          </div>
        </div>

        <!-- Hint mode selector -->
        <div class="hint-select">
          <label class="hint-item" :class="{ active: hintMode === 'typing' }">
            <input type="radio" v-model="hintMode" value="typing" />
            <span>✏️ 拼写模式</span>
            <span class="hint-desc">看释义拼出单词</span>
          </label>
          <label class="hint-item" :class="{ active: hintMode === 'choice' }">
            <input type="radio" v-model="hintMode" value="choice" />
            <span>🔘 选择模式</span>
            <span class="hint-desc">4选1选对单词</span>
          </label>
        </div>

        <button class="btn-start-test" @click="startTest()">
          开始测试 🚀
        </button>
      </div>
    </template>

    <!-- TESTING SCREEN -->
    <template v-if="phase === 'testing'">
      <div class="testing-screen">
        <!-- Progress -->
        <div class="test-progress">
          <div class="test-progress-bar">
            <div class="test-progress-fill" :style="{ width: progress + '%' }"></div>
          </div>
          <span class="test-progress-text">{{ currentIdx + 1 }}/{{ testWords.length }}</span>
        </div>

        <div class="test-stats-bar">
          <span class="stat-correct">✅ {{ correctCount }}</span>
          <span class="stat-wrong">❌ {{ wrongCount }}</span>
        </div>

        <!-- Question -->
        <div class="question-card" v-if="currentWord">
          <div class="question-label">请写出与释义对应的英文单词：</div>
          <div class="question-meaning">{{ currentWord.meaning }}</div>
          <div v-if="currentWord.phonetic" class="question-phonetic">{{ currentWord.phonetic }}</div>

          <!-- Typing input -->
          <div v-if="hintMode === 'typing'" class="input-area">
            <div class="hint-text">首字母提示：<strong>{{ hintLetter }}</strong></div>
            <input
              ref="inputRef"
              v-model="userInput"
              class="word-input"
              :class="{ correct: isChecked && isCorrect, wrong: isChecked && !isCorrect }"
              :disabled="isChecked"
              placeholder="输入英文单词..."
              @keyup.enter="isChecked ? nextWord() : checkAnswer()"
              autofocus
            />
          </div>

          <!-- Choice mode -->
          <div v-else class="choice-area">
            <div class="choice-hint">选择正确的单词：</div>
            <div class="choice-grid">
              <button
                v-for="opt in options"
                :key="opt"
                :class="[
                  'choice-btn',
                  { selected: selectedOption === opt },
                  { correct: isChecked && opt === currentWord.word },
                  { wrong: isChecked && selectedOption === opt && opt !== currentWord.word }
                ]"
                :disabled="isChecked"
                @click="selectedOption = opt"
              >
                {{ opt }}
              </button>
            </div>
          </div>

          <!-- Feedback -->
          <div v-if="isChecked" class="feedback" :class="{ correct: isCorrect, wrong: !isCorrect }">
            <div class="feedback-icon">{{ isCorrect ? '✅' : '❌' }}</div>
            <div class="feedback-text">
              <template v-if="isCorrect">正确！</template>
              <template v-else>
                错误！正确拼写：<strong>{{ currentWord.word }}</strong>
              </template>
            </div>
          </div>
        </div>

        <!-- Buttons -->
        <div class="action-row">
          <button v-if="!isChecked" class="btn-check" @click="checkAnswer()">
            ✅ 检查答案
          </button>
          <button v-if="!isChecked" class="btn-skip" @click="skipWord()">
            ⏭ 跳过
          </button>
          <button v-if="isChecked" class="btn-next" @click="nextWord()">
            {{ currentIdx < testWords.length - 1 ? '➡️ 下一题' : '🏁 查看结果' }}
          </button>
        </div>
      </div>
    </template>

    <!-- RESULT SCREEN -->
    <template v-if="phase === 'result'">
      <div class="result-screen">
        <div class="result-icon">{{ getAccuracy() >= 80 ? '🎉' : getAccuracy() >= 60 ? '💪' : '📚' }}</div>
        <h2>测试完成！</h2>

        <div class="result-stats">
          <div class="result-stat">
            <div class="result-stat-val correct">{{ correctCount }}</div>
            <div class="result-stat-lbl">正确</div>
          </div>
          <div class="result-stat">
            <div class="result-stat-val wrong">{{ wrongCount }}</div>
            <div class="result-stat-lbl">错误</div>
          </div>
          <div class="result-stat">
            <div class="result-stat-val accent">{{ testWords.length }}</div>
            <div class="result-stat-lbl">总题数</div>
          </div>
        </div>

        <div class="result-accuracy">
          <div class="accuracy-ring">
            <svg viewBox="0 0 120 120" class="accuracy-svg">
              <circle cx="60" cy="60" r="54" fill="none" stroke="#f0f0f0" stroke-width="10" />
              <circle cx="60" cy="60" r="54" fill="none"
                :stroke="getAccuracy() >= 80 ? '#52c41a' : getAccuracy() >= 60 ? '#faad14' : '#ff4d4f'"
                stroke-width="10"
                stroke-linecap="round"
                :stroke-dasharray="`${getAccuracy() * 3.39} 339`"
                transform="rotate(-90 60 60)"
              />
            </svg>
            <div class="accuracy-text">{{ getAccuracy() }}%</div>
          </div>
          <div class="accuracy-label">正确率</div>
        </div>

        <div class="result-time">⏱ 用时 {{ formatTime(elapsed) }}</div>

        <div v-if="wrongList.length > 0" class="wrong-summary">
          <h4>📕 错词列表（已自动记入错词本）</h4>
          <div class="wrong-summary-grid">
            <div v-for="w in wrongList" :key="w.word" class="wrong-summary-item">
              <div class="wrong-word">{{ w.word }}</div>
              <div class="wrong-meaning">{{ w.meaning }}</div>
            </div>
          </div>
        </div>

        <div class="result-actions">
          <button class="btn-restart" @click="restart()">🔄 再测一次</button>
          <button class="btn-practice" @click="testMode='wrong'; startTest()">📕 专测错词</button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.test-view {
  max-width: 560px;
  margin: 0 auto;
}

/* ===== SETUP ===== */
.setup-screen {
  padding: 16px 0;
}
.setup-title {
  font-size: 20px;
  color: #2c3e50;
  margin-bottom: 2px;
}
.setup-subtitle {
  font-size: 13px;
  color: #888;
  margin-bottom: 16px;
}
.mode-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}
.mode-item {
  display: block;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.15s;
  background: white;
}
.mode-item:hover { border-color: #4a90d9; }
.mode-item.active {
  border-color: #4a90d9;
  background: #f0f7ff;
}
.mode-item input { display: none; }
.mode-content {
  display: flex;
  align-items: center;
  gap: 12px;
}
.mode-icon { font-size: 24px; }
.mode-name {
  font-weight: 600;
  font-size: 14px;
  color: #333;
}
.mode-desc {
  font-size: 12px;
  color: #999;
}
.range-inputs {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  padding: 0 4px;
}
.range-group {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}
.range-group label {
  font-size: 13px;
  color: #666;
  white-space: nowrap;
}
.range-num {
  width: 60px;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  text-align: center;
}

/* Hint mode selector */
.hint-select {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}
.hint-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  cursor: pointer;
  background: white;
  font-size: 13px;
  transition: all 0.15s;
}
.hint-item.active {
  border-color: #4a90d9;
  background: #f0f7ff;
}
.hint-item input { display: none; }
.hint-desc {
  font-size: 11px;
  color: #999;
}

.btn-start-test {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #4a90d9, #357abd);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-start-test:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(74, 144, 217, 0.35);
}

/* ===== TESTING ===== */
.testing-screen {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 160px);
}
.test-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.test-progress-bar {
  flex: 1;
  height: 6px;
  background: #f0f0f0;
  border-radius: 3px;
  overflow: hidden;
}
.test-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4a90d9, #67b8f7);
  border-radius: 3px;
  transition: width 0.3s;
}
.test-progress-text {
  font-size: 12px;
  color: #999;
  min-width: 50px;
  text-align: right;
}
.test-stats-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 13px;
}
.stat-correct { color: #52c41a; font-weight: 600; }
.stat-wrong { color: #ff4d4f; font-weight: 600; }

.question-card {
  flex: 1;
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 16px;
  padding: 24px 20px;
  margin-bottom: 12px;
}
.question-label {
  font-size: 13px;
  color: #888;
  margin-bottom: 8px;
}
.question-meaning {
  font-size: 20px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 4px;
  line-height: 1.5;
}
.question-phonetic {
  font-size: 14px;
  color: #999;
  font-style: italic;
  margin-bottom: 16px;
}

.hint-text {
  font-size: 13px;
  color: #888;
  margin-bottom: 8px;
}
.word-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 18px;
  border: 2px solid #ddd;
  border-radius: 10px;
  outline: none;
  transition: all 0.15s;
  font-family: 'Courier New', monospace;
}
.word-input:focus { border-color: #4a90d9; }
.word-input.correct {
  border-color: #52c41a;
  background: #f6ffed;
}
.word-input.wrong {
  border-color: #ff4d4f;
  background: #fff2f0;
}

.choice-area {
  margin-top: 12px;
}
.choice-hint {
  font-size: 13px;
  color: #888;
  margin-bottom: 8px;
}
.choice-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.choice-btn {
  padding: 14px 10px;
  border: 2px solid #e8e8e8;
  border-radius: 10px;
  background: white;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  font-family: 'Courier New', monospace;
}
.choice-btn:hover:not(:disabled) { border-color: #4a90d9; }
.choice-btn.selected { border-color: #4a90d9; background: #f0f7ff; }
.choice-btn.correct {
  border-color: #52c41a;
  background: #f6ffed;
  color: #2e7d32;
}
.choice-btn.wrong {
  border-color: #ff4d4f;
  background: #fff2f0;
  color: #c62828;
}

.feedback {
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.feedback.correct { background: #f6ffed; color: #2e7d32; }
.feedback.wrong { background: #fff2f0; color: #c62828; }
.feedback-icon { font-size: 20px; }

.action-row {
  display: flex;
  gap: 8px;
  padding: 8px 0;
}
.btn-check {
  flex: 1;
  padding: 12px;
  background: #4a90d9;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.btn-check:hover { background: #357abd; }
.btn-skip {
  padding: 12px 20px;
  background: #f5f5f5;
  color: #888;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
}
.btn-next {
  flex: 1;
  padding: 12px;
  background: #52c41a;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.btn-next:hover { background: #389e0d; }

/* ===== RESULT ===== */
.result-screen {
  text-align: center;
  padding: 24px 0;
}
.result-icon {
  font-size: 64px;
  margin-bottom: 8px;
}
.result-screen h2 {
  font-size: 24px;
  color: #2c3e50;
  margin-bottom: 16px;
}
.result-stats {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 16px;
}
.result-stat {
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  padding: 12px 20px;
  min-width: 80px;
}
.result-stat-val {
  font-size: 28px;
  font-weight: 700;
}
.result-stat-val.correct { color: #52c41a; }
.result-stat-val.wrong { color: #ff4d4f; }
.result-stat-val.accent { color: #4a90d9; }
.result-stat-lbl {
  font-size: 12px;
  color: #888;
  margin-top: 2px;
}

.result-accuracy {
  margin-bottom: 12px;
}
.accuracy-ring {
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto;
}
.accuracy-svg {
  width: 120px;
  height: 120px;
}
.accuracy-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 28px;
  font-weight: 700;
  color: #333;
}
.accuracy-label {
  font-size: 13px;
  color: #888;
  margin-top: 4px;
}

.result-time {
  font-size: 14px;
  color: #888;
  margin-bottom: 20px;
}

.wrong-summary {
  text-align: left;
  margin-bottom: 20px;
}
.wrong-summary h4 {
  font-size: 14px;
  color: #555;
  margin-bottom: 8px;
}
.wrong-summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
}
.wrong-summary-item {
  background: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 8px;
  padding: 8px 10px;
}
.wrong-word {
  font-size: 14px;
  font-weight: 600;
  color: #c62828;
}
.wrong-meaning {
  font-size: 11px;
  color: #888;
  margin-top: 2px;
}

.result-actions {
  display: flex;
  gap: 10px;
}
.btn-restart {
  flex: 1;
  padding: 12px;
  background: #4a90d9;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.btn-practice {
  flex: 1;
  padding: 12px;
  background: #ff4d4f;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

@media (min-width: 769px) {
  .choice-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
