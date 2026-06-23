<script setup lang="ts">
import { ref, computed } from 'vue'
import { loadData, saveData } from '../utils/storage'
import { applyRating } from '../utils/ebbinghaus'
import { getWordsForDay } from '../utils/wordbank'
import type { VocabWord } from '../types/vocab'

const data = ref(loadData())

// Get current book's wrong words
const bookId = computed(() => data.value.currentWordBook || 'gaozhong')
const progress = computed(() => data.value.bookProgress?.[bookId.value])
const wrongWordsList = computed(() => {
  const wrong = data.value.wrongWords || {}
  return Object.entries(wrong)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
})

// Load word data for display
const wordMap = computed(() => {
  const map = new Map<string, VocabWord>()
  const bank = (window as any).__currentWordBank
  if (bank && Array.isArray(bank)) {
    bank.forEach((w: VocabWord) => map.set(w.word, w))
  }
  return map
})

// Wrong word details with VocabWord data
const wrongWordDetails = computed(() => {
  return wrongWordsList.value.map(([word, count]) => ({
    word,
    count,
    vocab: wordMap.value.get(word)
  }))
})

const selectedWord = ref('')
const practicing = ref(false)
const showMeaning = ref(false)
const userInput = ref('')
const feedback = ref<'correct' | 'wrong' | null>(null)

function formatDate(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function startPractice(word: string) {
  selectedWord.value = word
  practicing.value = true
  showMeaning.value = false
  userInput.value = ''
  feedback.value = null
}

function toggleMeaning() {
  showMeaning.value = !showMeaning.value
}

function checkSpelling() {
  if (!selectedWord.value) return
  const correct = userInput.value.trim().toLowerCase() === selectedWord.value.toLowerCase()
  feedback.value = correct ? 'correct' : 'wrong'
  
  if (correct) {
    // Reduce wrong count
    if (data.value.wrongWords) {
      data.value.wrongWords[selectedWord.value] = Math.max(0, (data.value.wrongWords[selectedWord.value] || 1) - 1)
      if (data.value.wrongWords[selectedWord.value] <= 0) {
        delete data.value.wrongWords[selectedWord.value]
      }
    }
    saveData(data.value)
  }
}

function stopPractice() {
  practicing.value = false
  selectedWord.value = ''
  showMeaning.value = false
}

function clearAll() {
  if (confirm('确定要清空所有错词记录吗？')) {
    data.value.wrongWords = {}
    saveData(data.value)
  }
}

const selectedVocab = computed(() => {
  if (!selectedWord.value) return null
  return wordMap.value.get(selectedWord.value)
})

const totalWrong = computed(() => wrongWordsList.value.length)
</script>

<template>
  <div class="wrong-words">
    <!-- Header -->
    <div class="wrong-header">
      <h2>📕 错词本</h2>
      <span class="wrong-count" v-if="totalWrong > 0">{{ totalWrong }} 个待攻克</span>
    </div>

    <!-- Empty state -->
    <div v-if="totalWrong === 0 && !practicing" class="empty-state">
      <div class="empty-icon">🎉</div>
      <p>暂无错词，继续保持！</p>
    </div>

    <!-- Practice mode (single word) -->
    <div v-if="practicing" class="practice-section">
      <div class="practice-header">
        <button class="btn-back" @click="stopPractice()">← 返回列表</button>
        <span class="practice-word-label">集中攻克</span>
      </div>

      <div class="practice-card">
        <div class="practice-word">{{ selectedWord }}</div>
        <div class="practice-phonetic" v-if="selectedVocab?.phonetic">/{{ selectedVocab.phonetic }}/</div>

        <div v-if="!showMeaning" class="practice-hint">
          <button class="btn-peek" @click="toggleMeaning()">👀 偷看释义</button>
        </div>
        <div v-else class="practice-meaning">
          <div class="meaning-text">{{ selectedVocab?.meaning }}</div>
          <div class="meaning-sentence" v-if="selectedVocab?.sentences?.length">
            {{ selectedVocab.sentences[0].en }}
          </div>
        </div>

        <div class="practice-input-wrap">
          <input
            v-model="userInput"
            class="practice-input"
            :class="{ correct: feedback === 'correct', wrong: feedback === 'wrong' }"
            placeholder="输入单词拼写..."
            @keyup.enter="!feedback && checkSpelling()"
            :disabled="!!feedback"
            autofocus
          />
        </div>

        <div class="practice-actions" v-if="!feedback">
          <button class="btn-check" @click="checkSpelling()">确认</button>
        </div>

        <div class="practice-feedback" v-if="feedback">
          <div v-if="feedback === 'correct'" class="fb-correct">
            ✅ 正确！错词 -1
          </div>
          <div v-else class="fb-wrong">
            ❌ 再接再厉！
          </div>
          <button class="btn-next" @click="stopPractice()">完成</button>
        </div>
      </div>
    </div>

    <!-- Wrong Words List -->
    <div v-else class="wrong-list">
      <div
        v-for="w in wrongWordDetails"
        :key="w.word"
        class="wrong-item"
        :class="{ 'has-vocab': !!w.vocab }"
      >
        <div class="wrong-item-main" @click="startPractice(w.word)">
          <div class="wrong-word-col">
            <span class="wrong-word-text">{{ w.word }}</span>
            <span class="wrong-phonetic" v-if="w.vocab?.phonetic">{{ w.vocab.phonetic }}</span>
          </div>
          <span class="wrong-meaning" v-if="w.vocab">{{ w.vocab.meaning.slice(0, 30) }}{{ w.vocab.meaning.length > 30 ? '...' : '' }}</span>
          <div class="wrong-count-badge">
            <span class="badge" :class="{ severe: w.count >= 3, medium: w.count >= 2 }">
              ✗ {{ w.count }}
            </span>
          </div>
        </div>
        <div class="wrong-item-actions">
          <button class="btn-practice" @click="startPractice(w.word)">练习</button>
        </div>
      </div>

      <div v-if="totalWrong > 0" class="wrong-footer-actions">
        <button class="btn-clear" @click="clearAll()">清空错词本</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrong-words {
  max-width: 600px;
  margin: 0 auto;
}
.wrong-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.wrong-header h2 {
  font-size: 20px;
  color: #2c3e50;
}
.wrong-count {
  background: #fce4ec;
  color: #c62828;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 500;
}

/* Empty */
.empty-state { text-align: center; padding: 60px 0; }
.empty-icon { font-size: 64px; margin-bottom: 8px; }
.empty-state p { color: #999; font-size: 15px; }

/* Wrong list */
.wrong-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  margin-bottom: 6px;
  transition: all 0.15s;
}
.wrong-item:hover {
  border-color: #d0d0d0;
}
.wrong-item-main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  min-width: 0;
}
.wrong-word-col {
  min-width: 90px;
}
.wrong-word-text {
  font-weight: 600;
  color: #c62828;
  font-size: 14px;
}
.wrong-phonetic {
  display: block;
  color: #bbb;
  font-size: 11px;
}
.wrong-meaning {
  color: #888;
  font-size: 12px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wrong-count-badge {
  flex-shrink: 0;
}
.badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  background: #fce4ec;
  color: #c62828;
}
.badge.medium { background: #fff3e0; color: #e65100; }
.badge.severe { background: #ffebee; color: #b71c1c; font-size: 12px; }

.wrong-item-actions {
  flex-shrink: 0;
}
.btn-practice {
  padding: 4px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: white;
  color: #666;
  cursor: pointer;
  font-size: 12px;
}
.btn-practice:hover {
  border-color: #4a90d9;
  color: #4a90d9;
}

.wrong-footer-actions {
  text-align: center;
  margin-top: 16px;
}
.btn-clear {
  padding: 8px 20px;
  border: 1px solid #ff4d4f;
  border-radius: 8px;
  background: white;
  color: #ff4d4f;
  font-size: 13px;
  cursor: pointer;
}
.btn-clear:hover { background: #fff0f0; }

/* Practice mode */
.practice-section {
  padding: 8px 0;
}
.practice-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.btn-back {
  padding: 6px 14px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 13px;
  color: #666;
}
.btn-back:hover { border-color: #999; }
.practice-word-label {
  font-size: 14px;
  color: #888;
}

.practice-card {
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 14px;
  padding: 28px 20px;
  text-align: center;
}
.practice-word {
  font-size: 32px;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 4px;
}
.practice-phonetic {
  color: #999;
  font-size: 14px;
  font-style: italic;
  margin-bottom: 16px;
}
.practice-hint { margin-bottom: 16px; }
.btn-peek {
  padding: 8px 20px;
  border: 1px dashed #e0e0e0;
  border-radius: 8px;
  background: #fafafa;
  color: #999;
  cursor: pointer;
  font-size: 13px;
}
.btn-peek:hover { border-color: #4a90d9; color: #4a90d9; }
.practice-meaning {
  margin-bottom: 20px;
  padding: 12px;
  background: #f0f7ff;
  border-radius: 8px;
}
.meaning-text { font-size: 18px; color: #378ADD; font-weight: 600; }
.meaning-sentence { font-size: 12px; color: #888; font-style: italic; margin-top: 6px; }

.practice-input-wrap { margin-bottom: 12px; }
.practice-input {
  width: 100%;
  max-width: 300px;
  padding: 14px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  font-size: 18px;
  text-align: center;
  outline: none;
}
.practice-input:focus { border-color: #4a90d9; }
.practice-input.correct { border-color: #52c41a; background: #f0faf0; }
.practice-input.wrong { border-color: #ff4d4f; background: #fff0f0; }

.practice-actions { margin-bottom: 12px; }
.btn-check {
  padding: 10px 32px;
  background: #4a90d9;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
}

.practice-feedback {
  padding: 12px;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.fb-correct { color: #52c41a; font-size: 15px; font-weight: 500; }
.fb-wrong { color: #ff4d4f; font-size: 15px; }
.btn-next {
  padding: 8px 20px;
  background: #4a90d9;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}
</style>
