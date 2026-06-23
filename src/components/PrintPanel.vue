<script setup lang="ts">
import type { AppData, VocabWord } from '../types/vocab'
import { getWordsForDay, getWordBank } from '../utils/wordbank'
import { getDueReviews } from '../utils/ebbinghaus'
import { printWordsHtml } from '../utils/printer'

const props = defineProps<{ appData: AppData }>()
const wordBank = getWordBank()

function openPrintWindow(html: string) {
  const win = window.open('', '_blank', 'width=800,height=600')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}

function printTodayWords() {
  const words = getWordsForDay(props.appData.currentDay, 50)
  const html = printWordsHtml(words, `Day ${props.appData.currentDay} 今日词汇`)
  openPrintWindow(html)
}

function printReviewWords() {
  const dueReviews = getDueReviews(props.appData.records, props.appData.currentDay)
  const words: VocabWord[] = dueReviews
    .map(r => wordBank.find(w => w.word === r.word))
    .filter((w): w is VocabWord => w !== undefined)
  const html = printWordsHtml(words, '复习词汇')
  openPrintWindow(html)
}

function printAllWords() {
  const html = printWordsHtml(wordBank, '全部词库')
  openPrintWindow(html)
}
</script>

<template>
  <div class="print-panel">
    <h2>打印面板</h2>
    <p class="print-desc">选择要打印的内容，将打开新窗口并自动弹出打印对话框。</p>

    <div class="print-buttons">
      <button class="print-btn" @click="printTodayWords">
        <span class="btn-icon">🖨️</span>
        <span class="btn-text">
          <span class="btn-title">打印今日词汇</span>
          <span class="btn-sub">Day {{ props.appData.currentDay }} 的 50 个新词</span>
        </span>
      </button>

      <button class="print-btn" @click="printReviewWords">
        <span class="btn-icon">🖨️</span>
        <span class="btn-text">
          <span class="btn-title">打印复习词汇</span>
          <span class="btn-sub">今日需要复习的词汇</span>
        </span>
      </button>

      <button class="print-btn" @click="printAllWords">
        <span class="btn-icon">🖨️</span>
        <span class="btn-text">
          <span class="btn-title">打印全部词库</span>
          <span class="btn-sub">共 {{ wordBank.length }} 词，内容较多将自动分页</span>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.print-panel {
  padding: 16px;
  background: white;
  border-radius: 12px;
  border: 0.5px solid #e8e8e8;
}
.print-panel h2 {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0 0 4px;
}
.print-desc {
  font-size: 12px;
  color: #999;
  margin: 0 0 16px;
}
.print-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.print-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  border: 0.5px solid #e0e0e0;
  border-radius: 10px;
  background: #fafafa;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}
.print-btn:hover {
  border-color: #378ADD;
  background: #f0f6ff;
}
.btn-icon {
  font-size: 24px;
  flex-shrink: 0;
}
.btn-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.btn-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}
.btn-sub {
  font-size: 12px;
  color: #999;
}
</style>
