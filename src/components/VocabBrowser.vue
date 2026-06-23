<script setup lang="ts">
import { ref, computed } from 'vue'
import { getWordBank, searchWords, TOTAL_WORDS } from '../utils/wordbank'
import type { VocabWord } from '../types/vocab'

const wordBank = getWordBank()
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = 50
const expandedWord = ref<string | null>(null)

const filteredWords = computed(() => {
  const q = searchQuery.value.trim()
  if (!q) return wordBank
  return searchWords(q)
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredWords.value.length / pageSize)))

const pagedWords = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredWords.value.slice(start, start + pageSize)
})

const startIndex = computed(() => (currentPage.value - 1) * pageSize + 1)

function goToPage(p: number) {
  if (p >= 1 && p <= totalPages.value) {
    currentPage.value = p
  }
}

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function jumpToLetter(letter: string) {
  const idx = wordBank.findIndex(w => w.word[0].toUpperCase() >= letter)
  if (idx >= 0) {
    currentPage.value = Math.floor(idx / pageSize) + 1
    searchQuery.value = ''
  }
}

function toggleExpand(word: string) {
  expandedWord.value = expandedWord.value === word ? null : word
}
</script>

<template>
  <div class="vocab-browser">
    <h2>词库浏览</h2>

    <!-- Search -->
    <div class="search-bar">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索单词或释义..."
        class="search-input"
      />
      <span class="search-count">{{ filteredWords.length }} / {{ TOTAL_WORDS }}</span>
    </div>

    <!-- Alphabet Index -->
    <div class="alpha-index">
      <button
        v-for="letter in alphabet"
        :key="letter"
        class="alpha-btn"
        @click="jumpToLetter(letter)"
      >
        {{ letter }}
      </button>
    </div>

    <!-- Word List -->
    <div class="word-list">
      <div
        v-for="(w, i) in pagedWords"
        :key="w.word"
        class="word-item"
        @click="toggleExpand(w.word)"
      >
        <div class="word-row">
          <span class="word-idx">{{ startIndex + i }}</span>
          <span class="word-text">{{ w.word }}</span>
          <span class="word-phonetic" v-if="w.phonetic">{{ w.phonetic }}</span>
          <span class="word-pos" v-if="w.pos">{{ w.pos }}</span>
          <span class="word-meaning">{{ w.meaning }}</span>
          <span class="expand-icon">{{ expandedWord === w.word ? '▲' : '▼' }}</span>
        </div>
        <div v-if="expandedWord === w.word && w.phrases?.length" class="word-detail">
          <div v-for="p in w.phrases" :key="p.phrase" class="phrase-item">
            <span class="phrase-text">{{ p.phrase }}</span>
            <span class="phrase-trans">{{ p.translation }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div class="pagination" v-if="totalPages > 1">
      <button
        class="page-btn"
        :disabled="currentPage === 1"
        @click="goToPage(currentPage - 1)"
      >
        ← 上一页
      </button>
      <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
      <button
        class="page-btn"
        :disabled="currentPage === totalPages"
        @click="goToPage(currentPage + 1)"
      >
        下一页 →
      </button>
    </div>
  </div>
</template>

<style scoped>
.vocab-browser {
  padding: 16px;
  background: white;
  border-radius: 12px;
  border: 0.5px solid #e8e8e8;
}
.vocab-browser h2 {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0 0 16px;
}
.search-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.search-input {
  flex: 1;
  padding: 8px 12px;
  border: 0.5px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}
.search-input:focus {
  border-color: #378ADD;
}
.search-count {
  font-size: 12px;
  color: #999;
  white-space: nowrap;
}
.alpha-index {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 8px 0;
  margin-bottom: 12px;
  border-top: 0.5px solid #eee;
  border-bottom: 0.5px solid #eee;
}
.alpha-btn {
  width: 28px;
  height: 24px;
  border: none;
  background: transparent;
  color: #378ADD;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 4px;
  padding: 0;
}
.alpha-btn:hover {
  background: #378ADD;
  color: white;
}
.word-list {
  margin-bottom: 12px;
}
.word-item {
  padding: 8px 10px;
  border-bottom: 0.5px solid #f0f0f0;
  cursor: pointer;
  transition: background 0.15s;
}
.word-item:hover {
  background: #f8faff;
}
.word-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.word-idx {
  font-size: 11px;
  color: #ccc;
  min-width: 30px;
}
.word-text {
  font-size: 14px;
  font-weight: 600;
  color: #185FA5;
  min-width: 100px;
}
.word-phonetic {
  font-size: 12px;
  color: #aaa;
  min-width: 80px;
}
.word-pos {
  font-size: 11px;
  color: #888;
  background: #f0f0f0;
  padding: 1px 5px;
  border-radius: 3px;
  min-width: 28px;
  text-align: center;
}
.word-meaning {
  flex: 1;
  font-size: 13px;
  color: #555;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.expand-icon {
  font-size: 10px;
  color: #bbb;
  margin-left: 4px;
}
.word-detail {
  margin-top: 6px;
  padding: 6px 10px;
  background: #f8faff;
  border-radius: 6px;
}
.phrase-item {
  display: flex;
  gap: 8px;
  font-size: 13px;
  padding: 2px 0;
}
.phrase-text {
  font-weight: 600;
  color: #185FA5;
}
.phrase-trans {
  color: #666;
}
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding-top: 12px;
}
.page-btn {
  padding: 6px 16px;
  border: 0.5px solid #ddd;
  background: white;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  color: #333;
}
.page-btn:hover:not(:disabled) {
  border-color: #378ADD;
  color: #378ADD;
}
.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.page-info {
  font-size: 13px;
  color: #888;
}
</style>
