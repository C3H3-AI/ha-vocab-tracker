<script setup lang="ts">
import { computed } from 'vue'
import { AVAILABLE_BOOKS, getBookById } from '../utils/wordbank'
import type { AppData } from '../types/vocab'

const props = defineProps<{
  appData: AppData
}>()

const emit = defineEmits<{
  switchBook: [bookId: string]
}>()

const currentBook = computed(() => getBookById(props.appData.currentWordBook))
</script>

<template>
  <div class="book-picker">
    <h3 class="picker-title">📖 选择词库</h3>
    <div class="book-grid">
      <div
        v-for="book in AVAILABLE_BOOKS"
        :key="book.id"
        :class="['book-card', { active: appData.currentWordBook === book.id }]"
        :style="{
          '--accent': book.color,
          borderLeftColor: appData.currentWordBook === book.id ? book.color : 'transparent'
        }"
        @click="emit('switchBook', book.id)"
      >
        <div class="book-name">{{ book.name }}</div>
        <div class="book-desc">{{ book.description }}</div>
        <div class="book-meta">
          <span class="book-count">{{ book.wordCount }} 词</span>
          <span class="book-days">{{ book.totalDays }} 天</span>
        </div>
        <div v-if="appData.currentWordBook === book.id" class="book-check">✓ 使用中</div>
        <div v-else class="book-check inactive">点击切换</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.book-picker {
  padding: 8px 0;
}
.picker-title {
  font-size: 18px;
  color: #2c3e50;
  margin-bottom: 14px;
}
.book-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
@media (max-width: 480px) {
  .book-grid {
    grid-template-columns: 1fr;
  }
}
.book-card {
  border: 1px solid #e8e8e8;
  border-left: 3px solid transparent;
  border-radius: 10px;
  padding: 14px;
  cursor: pointer;
  transition: all 0.15s;
  background: white;
}
.book-card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.book-card.active {
  background: #f8faff;
}
.book-name {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
}
.book-desc {
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
}
.book-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: #888;
}
.book-check {
  margin-top: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--accent, #4a90d9);
}
.book-check.inactive {
  color: #bbb;
  font-weight: 400;
}
</style>
