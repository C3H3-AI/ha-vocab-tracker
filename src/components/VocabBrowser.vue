<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { loadWordBank, getBookById, AVAILABLE_BOOKS } from '../utils/wordbank'
import type { VocabWord } from '../types/vocab'

const PAGE_SIZE = 50
const tabs = ['全部', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']

const activeTab = ref('全部')
const searchKeyword = ref('')
const currentPage = ref(1)
const expandedWords = ref<Set<string>>(new Set())
const wordBank = ref<VocabWord[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  await loadCurrentBookFromCache()
})

// Watch for window.__currentWordBank changes
watch(
  () => (window as any).__currentWordBank,
  async () => {
    await loadCurrentBookFromCache()
  }
)

async function loadCurrentBookFromCache() {
  loading.value = true
  error.value = ''
  
  // Try cache first
  const cached = (window as any).__currentWordBank
  if (cached && Array.isArray(cached) && cached.length > 0) {
    wordBank.value = cached
    loading.value = false
    return
  }
  
  // Try loading from book list - default to gaozhong
  for (const book of AVAILABLE_BOOKS) {
    try {
      const words = await loadWordBank(book.id)
      if (words && words.length > 50) {
        wordBank.value = words
        ;(window as any).__currentWordBank = words
        break
      }
    } catch {}
  }
  
  loading.value = false
  if (wordBank.value.length === 0) {
    error.value = '无法加载词库，请确保词库文件已部署'
  }
}

const filteredWords = computed(() => {
  let words = wordBank.value

  if (activeTab.value !== '全部') {
    const letter = activeTab.value.toLowerCase()
    words = words.filter((w) => w.word.toLowerCase().startsWith(letter))
  }

  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.trim().toLowerCase()
    words = words.filter(w =>
      w.word.toLowerCase().includes(kw) ||
      w.meaning.toLowerCase().includes(kw)
    )
    if (activeTab.value !== '全部') {
      const letter = activeTab.value.toLowerCase()
      words = words.filter((w) => w.word.toLowerCase().startsWith(letter))
    }
  }

  return words
})

const totalPages = computed(() => {
  return Math.ceil(filteredWords.value.length / PAGE_SIZE)
})

const pagedWords = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredWords.value.slice(start, start + PAGE_SIZE)
})

const totalCount = computed(() => wordBank.value.length)

function switchTab(tab: string) {
  activeTab.value = tab
  currentPage.value = 1
  expandedWords.value.clear()
}

function toggleWord(word: string) {
  if (expandedWords.value.has(word)) {
    expandedWords.value.delete(word)
  } else {
    expandedWords.value.add(word)
  }
}

function prevPage() {
  if (currentPage.value > 1) currentPage.value--
}

function nextPage() {
  if (currentPage.value < totalPages.value) currentPage.value++
}

function onSearch() {
  currentPage.value = 1
}
</script>

<template>
  <div class="vocab-browser">
    <div class="browser-header">
      <h2>📚 单词浏览</h2>
      <span class="count-badge">{{ totalCount }} 词</span>
    </div>

    <!-- Search -->
    <div class="search-bar">
      <input
        v-model="searchKeyword"
        placeholder="搜索单词或释义..."
        @input="onSearch"
        class="search-input"
      />
    </div>

    <!-- Letter Tabs -->
    <div class="letter-tabs">
      <button
        v-for="tab in tabs"
        :key="tab"
        :class="['letter-btn', { active: activeTab === tab }]"
        @click="switchTab(tab)"
      >
        {{ tab }}
      </button>
    </div>

    <!-- Loading / Error -->
    <div v-if="loading" class="browser-loading">加载中...</div>
    <div v-else-if="error" class="browser-error">{{ error }}</div>

    <!-- Word List -->
    <div v-else class="word-list">
      <div
        v-for="w in pagedWords"
        :key="w.word"
        :class="['word-card', { expanded: expandedWords.has(w.word) }]"
        @click="toggleWord(w.word)"
      >
        <div class="word-main">
          <span class="word-text">{{ w.word }}</span>
          <span v-if="w.phonetic" class="phonetic">{{ w.phonetic }}</span>
          <span v-if="w.pos" class="pos">{{ w.pos }}</span>
          <span class="meaning">{{ expandedWords.has(w.word) ? w.meaning : w.meaning.slice(0, 20) + (w.meaning.length > 20 ? '...' : '') }}</span>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div class="pagination" v-if="totalPages > 1">
      <button class="page-btn" :disabled="currentPage <= 1" @click="prevPage">‹</button>
      <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
      <button class="page-btn" :disabled="currentPage >= totalPages" @click="nextPage">›</button>
    </div>
  </div>
</template>

<style scoped>
.vocab-browser {
  max-width: 600px;
  margin: 0 auto;
}
.browser-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.browser-header h2 {
  margin: 0;
  font-size: 20px;
  color: #2c3e50;
}
.count-badge {
  background: #4a90d9;
  color: white;
  padding: 4px 14px;
  border-radius: 16px;
  font-size: 13px;
}

.search-bar {
  margin-bottom: 12px;
}
.search-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}
.search-input:focus {
  border-color: #4a90d9;
}

.letter-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 14px;
}
.letter-btn {
  padding: 4px 10px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.letter-btn.active {
  background: #4a90d9;
  color: white;
  border-color: #4a90d9;
}

.browser-loading,
.browser-error {
  text-align: center;
  padding: 40px;
  color: #999;
}

.word-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.word-card {
  padding: 10px 14px;
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.word-card:hover {
  border-color: #d0d0d0;
}
.word-card.expanded {
  border-color: #4a90d9;
  background: #f8faff;
}
.word-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.word-text {
  font-weight: 600;
  color: #2c3e50;
  min-width: 80px;
  font-size: 14px;
}
.phonetic {
  color: #999;
  font-size: 12px;
  font-style: italic;
}
.pos {
  color: #e67e22;
  font-size: 12px;
}
.meaning {
  color: #555;
  font-size: 13px;
  flex: 1;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 20px 0;
}
.page-btn {
  padding: 8px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  font-size: 18px;
  cursor: pointer;
}
.page-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
.page-info {
  font-size: 14px;
  color: #666;
}
</style>
