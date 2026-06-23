<script setup lang="ts">
import { ref } from 'vue'
import { printWords } from '../utils/printer'
import { getWordsForDay } from '../utils/wordbank'
import { getDueReviews } from '../utils/ebbinghaus'
import { loadData } from '../utils/storage'
import type { VocabWord } from '../types/vocab'

const printFormat = ref<'simple' | 'detailed'>('detailed')
const message = ref('')

function getCurrentBank(): VocabWord[] {
  const bank = (window as any).__currentWordBank
  if (bank && Array.isArray(bank)) return bank
  return []
}

function handlePrintToday() {
  const data = loadData()
  const bank = getCurrentBank()
  const words = getWordsForDay(bank, data.currentWordBook ? getBookData(data, data.currentWordBook).currentDay : 1, 50)
  if (words.length === 0) {
    message.value = '今日没有要学习的单词。'
    return
  }
  const day = data.currentWordBook ? getBookData(data, data.currentWordBook).currentDay : 1
  printWords(words, `第 ${day} 天 - 新学词汇`)
  message.value = '正在打开打印窗口...'
}

function handlePrintReview() {
  const data = loadData()
  const progress = data.currentWordBook ? getBookData(data, data.currentWordBook) : null
  if (!progress) { message.value = '请先选择词库。'; return }
  const due = getDueReviews(progress.records)
  const bank = getCurrentBank()
  const wordMap = new Map(bank.map((w) => [w.word, w]))
  const reviewVocab = due
    .map((r) => wordMap.get(r.word))
    .filter((w): w is NonNullable<typeof w> => !!w)
  if (reviewVocab.length === 0) {
    message.value = '没有需要复习的单词。'
    return
  }
  printWords(reviewVocab, `第 ${progress.currentDay} 天 - 复习词汇`)
  message.value = '正在打开打印窗口...'
}

function handlePrintDayPlan() {
  const data = loadData()
  const progress = data.currentWordBook ? getBookData(data, data.currentWordBook) : null
  if (!progress) { message.value = '请先选择词库。'; return }
  const bank = getCurrentBank()
  const todayWords = getWordsForDay(bank, progress.currentDay, 50)
  const due = getDueReviews(progress.records)
  const wordMap = new Map(bank.map((w) => [w.word, w]))
  const reviewVocab = due
    .map((r) => wordMap.get(r.word))
    .filter((w): w is NonNullable<typeof w> => !!w)
  printWords([...todayWords, ...reviewVocab], `Day ${progress.currentDay} - 每日计划`)
  message.value = '正在打开打印窗口...'
}

function getBookData(data: any, bookId: string) {
  return (data.bookProgress && data.bookProgress[bookId]) || { currentDay: 1, records: {} }
}

function closeMessage() {
  message.value = ''
}
</script>

<template>
  <div class="print-panel">
    <h2>🖨️ 打印功能</h2>
    <p class="subtitle">生成可打印的词汇表</p>

    <div class="print-actions">
      <button class="print-btn" @click="handlePrintToday()">
        <span class="btn-icon">📄</span>
        <span class="btn-text">打印今日新词</span>
      </button>

      <button class="print-btn" @click="handlePrintReview()">
        <span class="btn-icon">🔄</span>
        <span class="btn-text">打印复习词汇</span>
      </button>

      <button class="print-btn" @click="handlePrintDayPlan()">
        <span class="btn-icon">📋</span>
        <span class="btn-text">打印每日计划</span>
      </button>
    </div>

    <div v-if="message" class="print-message" @click="closeMessage()">
      {{ message }}
    </div>
  </div>
</template>

<style scoped>
.print-panel {
  max-width: 500px;
  margin: 0 auto;
}
.print-panel h2 {
  font-size: 20px;
  color: #2c3e50;
  margin-bottom: 4px;
}
.subtitle {
  color: #888;
  font-size: 13px;
  margin-bottom: 20px;
}
.print-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.print-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 15px;
  text-align: left;
}
.print-btn:hover {
  border-color: #4a90d9;
  box-shadow: 0 2px 8px rgba(74,144,217,0.1);
}
.btn-icon { font-size: 24px; }
.btn-text { font-weight: 500; color: #333; }
.print-message {
  margin-top: 16px;
  padding: 12px 16px;
  background: #f0f7ff;
  border-radius: 8px;
  color: #378ADD;
  font-size: 14px;
  cursor: pointer;
}
</style>
