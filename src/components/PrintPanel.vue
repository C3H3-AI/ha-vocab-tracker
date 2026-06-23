<script setup lang="ts">
import { ref, computed } from 'vue'
import { printWords, printWordsHtml } from '../utils/printer'
import { getWordsForDay, loadWordBank, getBookById, AVAILABLE_BOOKS } from '../utils/wordbank'
import { getDueReviews } from '../utils/ebbinghaus'
import { loadData, getCurrentUser } from '../utils/storage'
import type { VocabWord } from '../types/vocab'

type PrintScope = 'today' | 'review' | 'plan' | 'wrong' | 'book' | 'range'

const printFormat = ref<'simple' | 'detailed'>('detailed')
const message = ref('')
const isPrinting = ref(false)
const printScope = ref<PrintScope>('plan')
const bookDayStart = ref(1)
const bookDayEnd = ref(10)

const data = loadData()
const user = getCurrentUser()
const currentBank = computed(() => (window as any).__currentWordBank as VocabWord[] | undefined)
const progress = computed(() => {
  const bookId = data.currentWordBook
  return (data.bookProgress && data.bookProgress[bookId]) || { currentDay: 1, records: {} }
})
const wrongWordsList = computed(() => Object.keys(data.wrongWords || {}))

function getBank(): VocabWord[] {
  return currentBank.value || []
}

function getWordsByDay(day: number): VocabWord[] {
  return getWordsForDay(getBank(), day, 50)
}

function getReviewWords(): VocabWord[] {
  const bank = getBank()
  const wordMap = new Map(bank.map(w => [w.word, w]))
  return getDueReviews(progress.value.records)
    .map(r => wordMap.get(r.word))
    .filter((w): w is VocabWord => !!w)
}

function getWrongWords(): VocabWord[] {
  const bank = getBank()
  const wordSet = new Set(Object.keys(data.wrongWords || {}))
  return bank.filter(w => wordSet.has(w.word))
}

async function doPrint() {
  isPrinting.value = true
  message.value = ''
  let words: VocabWord[] = []
  let title = ''

  try {
    switch (printScope.value) {
      case 'today': {
        const day = progress.value.currentDay
        words = getWordsByDay(day)
        title = `第 ${day} 天 - 今日新词`
        break
      }
      case 'review': {
        words = getReviewWords()
        title = `Day ${progress.value.currentDay} - 到期复习`
        break
      }
      case 'plan': {
        const day = progress.value.currentDay
        words = [...getWordsByDay(day), ...getReviewWords()]
        title = `Day ${day} - 每日计划 (新词+复习)`
        break
      }
      case 'wrong': {
        words = getWrongWords()
        title = '错词本'
        break
      }
      case 'book': {
        words = getBank()
        const meta = getBookById(data.currentWordBook)
        title = `${meta?.name || '词库'} - 全书`
        break
      }
      case 'range': {
        const bank = getBank()
        for (let d = bookDayStart.value; d <= bookDayEnd.value; d++) {
          words.push(...getWordsByDay(d))
        }
        title = `Day ${bookDayStart.value} ~ ${bookDayEnd.value}`
        break
      }
    }

    if (words.length === 0) {
      message.value = '没有词汇可打印。'
      isPrinting.value = false
      return
    }

    printWords(words, title)
    message.value = `✅ 正在打印 ${words.length} 个词...`
  } catch (e: any) {
    message.value = `❌ 打印失败: ${e.message}`
  }
  isPrinting.value = false
}

function downloadAsHtml() {
  let words: VocabWord[] = []
  let title = ''
  if (printScope.value === 'wrong') {
    words = getWrongWords()
    title = '错词本'
  } else if (printScope.value === 'book') {
    words = getBank()
    const meta = getBookById(data.currentWordBook)
    title = `${meta?.name || '词库'} - 全书`
  } else {
    const day = progress.value.currentDay
    words = getWordsByDay(day)
    title = `第 ${day} 天`
  }

  if (words.length === 0) {
    message.value = '没有词汇可导出。'
    return
  }

  const html = printWordsHtml(words, title)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `vocab-${title.replace(/[\/\\?*]/g, '_')}.html`
  a.click()
  URL.revokeObjectURL(url)
  message.value = `✅ 已导出 ${words.length} 个词`
}

const scopeIcons: Record<PrintScope, string> = {
  plan: '📋', today: '📄', review: '🔄', wrong: '📕', book: '📚', range: '🔢'
}
const scopeLabels: Record<PrintScope, string> = {
  plan: '每日计划', today: '今日新词', review: '到期复习', wrong: '错词本', book: '全书打印', range: '范围打印'
}
const scopeDescs: Record<PrintScope, string> = {
  plan: '今日新词 + 到期复习词', today: '当天学习的 50 个词', review: '按艾宾浩斯到期的旧词',
  wrong: '之前测试/学习中出错的词', book: '当前词库全部词汇', range: '指定 Day 区间词汇'
}
</script>

<template>
  <div class="print-panel">
    <h2>🖨️ 打印功能</h2>
    <p class="subtitle">打印词汇表，背完后到 HA 测试</p>

    <!-- Scope selector -->
    <div class="scope-list">
      <button v-for="scope in (['plan','today','review','wrong','book','range'] as PrintScope[])" :key="scope"
        :class="['scope-btn', { active: printScope === scope }]"
        @click="printScope = scope">
        <span class="scope-icon">{{ scopeIcons[scope] }}</span>
        <div class="scope-info">
          <div class="scope-name">{{ scopeLabels[scope] }}</div>
          <div class="scope-desc">{{ scopeDescs[scope] }}</div>
        </div>
      </button>
    </div>

    <!-- Range inputs for 'range' mode -->
    <div v-if="printScope === 'range'" class="range-row">
      <label>从 Day <input type="number" v-model.number="bookDayStart" min="1" class="num-input" /></label>
      <label>到 Day <input type="number" v-model.number="bookDayEnd" :min="bookDayStart" class="num-input" /></label>
    </div>

    <div class="action-row">
      <button class="btn-primary" :disabled="isPrinting" @click="doPrint()">
        {{ isPrinting ? '⏳ 处理中...' : '🖨️ 打印' }}
      </button>
      <button class="btn-secondary" @click="downloadAsHtml()">
        💾 导出 HTML
      </button>
    </div>

    <div v-if="message" class="print-message" :class="{ error: message.startsWith('❌') }" @click="message = ''">
      {{ message }}
    </div>
  </div>
</template>

<style scoped>
.print-panel {
  max-width: 520px;
  margin: 0 auto;
}
.print-panel h2 {
  font-size: 20px;
  color: #2c3e50;
  margin-bottom: 2px;
}
.subtitle {
  color: #888;
  font-size: 13px;
  margin-bottom: 16px;
}

.scope-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}
.scope-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  background: white;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
  font-size: 14px;
}
.scope-btn:hover { border-color: #4a90d9; }
.scope-btn.active {
  border-color: #4a90d9;
  background: #f0f7ff;
}
.scope-icon { font-size: 22px; }
.scope-info { flex: 1; }
.scope-name { font-weight: 600; color: #333; font-size: 14px; }
.scope-desc { font-size: 11px; color: #999; margin-top: 1px; }

.range-row {
  display: flex;
  gap: 20px;
  padding: 0 4px 14px;
}
.range-row label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #555;
}
.num-input {
  width: 60px;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  text-align: center;
}

.action-row {
  display: flex;
  gap: 10px;
}
.btn-primary {
  flex: 1;
  padding: 14px;
  background: linear-gradient(135deg, #4a90d9, #357abd);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(74,144,217,0.3); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary {
  padding: 14px 18px;
  background: white;
  color: #4a90d9;
  border: 1px solid #4a90d9;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-secondary:hover { background: #f0f7ff; }

.print-message {
  margin-top: 12px;
  padding: 10px 14px;
  background: #f0f7ff;
  border-radius: 8px;
  color: #378ADD;
  font-size: 13px;
  cursor: pointer;
}
.print-message.error {
  background: #fff2f0;
  color: #c62828;
}
</style>
