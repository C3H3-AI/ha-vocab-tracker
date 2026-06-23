import type { VocabWord } from '../types/vocab'

export interface WordBookMeta {
  id: string
  name: string
  description: string
  wordCount: number
  wordsPerDay: number
  totalDays: number
  color: string
  /** 实际文件名（不含.json），默认等于 id */
  fileName?: string
}

export const AVAILABLE_BOOKS: WordBookMeta[] = [
  { id: 'primary', name: '小学词汇', description: '人教版同步', wordCount: 1334, wordsPerDay: 50, totalDays: 27, color: '#ff85c0' },
  { id: 'junior', name: '初中词汇', description: '中考必背', wordCount: 1600, wordsPerDay: 50, totalDays: 32, color: '#52c41a', fileName: 'junior' },
  { id: 'gaokao-3500', name: '高考核心3500', description: '100句记完3500词', wordCount: 3866, wordsPerDay: 50, totalDays: 78, color: '#1890ff' },
  { id: 'gaokao-24days', name: '24天突破高考', description: '高考大纲3500', wordCount: 2528, wordsPerDay: 50, totalDays: 51, color: '#13c2c2' },
  { id: 'gaokao-core-20days', name: '20天背完高考核心', description: '高考核心词汇', wordCount: 2411, wordsPerDay: 50, totalDays: 49, color: '#722ed1' },
  { id: 'gaokao-michael', name: '高考词群速记', description: 'Michael词群记词', wordCount: 4378, wordsPerDay: 50, totalDays: 88, color: '#eb2f96' },
  { id: 'senior', name: '高中词汇', description: '高考必背', wordCount: 2400, wordsPerDay: 50, totalDays: 48, color: '#4a90d9', fileName: 'senior' },
  { id: 'cet4', name: 'CET-4', description: '大学英语四级', wordCount: 2800, wordsPerDay: 50, totalDays: 56, color: '#faad14' },
  { id: 'cet6', name: 'CET-6', description: '大学英语六级', wordCount: 3500, wordsPerDay: 50, totalDays: 70, color: '#e67e22' },
  { id: 'kaoyan', name: '考研英语', description: '研究生入学考试', wordCount: 2800, wordsPerDay: 50, totalDays: 56, color: '#e74c3c' },
  { id: 'toefl', name: 'TOEFL', description: '托福考试', wordCount: 4000, wordsPerDay: 50, totalDays: 80, color: '#9b59b6' },
  { id: 'sat', name: 'SAT', description: '美国高考', wordCount: 3000, wordsPerDay: 50, totalDays: 60, color: '#1abc9c' },
  { id: 'postgraduate', name: '研究生英语', description: '硕博入学考试', wordCount: 3000, wordsPerDay: 50, totalDays: 60, color: '#fa541c' },
]

export const BOOK_MAP = new Map(AVAILABLE_BOOKS.map(b => [b.id, b]))

const bankCache = new Map<string, VocabWord[]>()
const WORD_BANK_BASE = '/local/vocab/wordbank'

export function getDefaultBook(): string {
  return 'senior'
}

export function getBookById(id: string): WordBookMeta | undefined {
  return BOOK_MAP.get(id)
}

export async function loadWordBank(bookId: string): Promise<VocabWord[]> {
  const cached = bankCache.get(bookId)
  if (cached) return cached

  // 使用 fileName 映射（默认等于 id）
  const meta = BOOK_MAP.get(bookId)
  const fileName = meta?.fileName || bookId

  try {
    const url = `${WORD_BANK_BASE}/${fileName}.json`
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data: VocabWord[] = await resp.json()
    bankCache.set(bookId, data)
    return data
  } catch (e) {
    console.warn(`Failed to load word bank "${bookId}" (${fileName}.json), using fallback`, e)
    const fallback = getFallbackBank()
    bankCache.set(bookId, fallback)
    return fallback
  }
}

export function getWordsForDay(
  words: VocabWord[],
  day: number,
  wordsPerDay: number = 50
): VocabWord[] {
  const start = (day - 1) * wordsPerDay
  const end = start + wordsPerDay
  return words.slice(start, end)
}

export function getTotalDays(words: VocabWord[], wordsPerDay: number = 50): number {
  return Math.ceil(words.length / wordsPerDay)
}

function getFallbackBank(): VocabWord[] {
  return [
    { word: "abandon", phonetic: "/əˈbændən/", pos: "v.", meaning: "放弃；遗弃" },
    { word: "ability", phonetic: "/əˈbɪlɪti/", pos: "n.", meaning: "能力；才能" },
    { word: "abroad", phonetic: "/əˈbrɔːd/", pos: "adv.", meaning: "在国外；到海外" },
    { word: "absent", phonetic: "/ˈæbsənt/", pos: "adj.", meaning: "缺席的；不在的" },
    { word: "absorb", phonetic: "/əbˈzɔːb/", pos: "v.", meaning: "吸收；吸引" },
    { word: "abstract", phonetic: "/ˈæbstrækt/", pos: "adj.", meaning: "抽象的；理论上的" },
    { word: "access", phonetic: "/ˈækses/", pos: "n.", meaning: "通道；入口；接近" },
    { word: "achieve", phonetic: "/əˈtʃiːv/", pos: "v.", meaning: "完成；达到；实现" },
    { word: "acquire", phonetic: "/əˈkwaɪə/", pos: "v.", meaning: "获得；取得；学到" },
    { word: "adapt", phonetic: "/əˈdæpt/", pos: "v.", meaning: "适应；改编" },
    { word: "adequate", phonetic: "/ˈædɪkwɪt/", pos: "adj.", meaning: "足够的；充分的" },
    { word: "adjust", phonetic: "/əˈdʒʌst/", pos: "v.", meaning: "调整；适应" },
    { word: "admit", phonetic: "/ədˈmɪt/", pos: "v.", meaning: "承认；准许进入" },
    { word: "adopt", phonetic: "/əˈdɒpt/", pos: "v.", meaning: "采纳；收养" },
    { word: "advance", phonetic: "/ədˈvɑːns/", pos: "v.", meaning: "前进；进步" },
    { word: "advantage", phonetic: "/ədˈvɑːntɪdʒ/", pos: "n.", meaning: "优势；有利条件" },
    { word: "advertise", phonetic: "/ˈædvətaɪz/", pos: "v.", meaning: "做广告；宣传" },
    { word: "affair", phonetic: "/əˈfeə/", pos: "n.", meaning: "事务；事件" },
    { word: "affect", phonetic: "/əˈfekt/", pos: "v.", meaning: "影响；感动" },
    { word: "afford", phonetic: "/əˈfɔːd/", pos: "v.", meaning: "负担得起；提供" },
    { word: "aggressive", phonetic: "/əˈɡresɪv/", pos: "adj.", meaning: "侵略的；好斗的" },
    { word: "agree", phonetic: "/əˈɡriː/", pos: "v.", meaning: "同意；赞成" },
    { word: "agriculture", phonetic: "/ˈæɡrɪkʌltʃə/", pos: "n.", meaning: "农业；农学" },
    { word: "allocate", phonetic: "/ˈæləkeɪt/", pos: "v.", meaning: "分配；拨出" },
    { word: "allow", phonetic: "/əˈlaʊ/", pos: "v.", meaning: "允许；承认" },
    { word: "although", phonetic: "/ɔːlˈðəʊ/", pos: "conj.", meaning: "尽管；虽然" },
    { word: "amount", phonetic: "/əˈmaʊnt/", pos: "n.", meaning: "数量；总额" },
    { word: "analyze", phonetic: "/ˈænəlaɪz/", pos: "v.", meaning: "分析；分解" },
    { word: "announce", phonetic: "/əˈnaʊns/", pos: "v.", meaning: "宣布；通知" },
    { word: "annual", phonetic: "/ˈænjuəl/", pos: "adj.", meaning: "每年的；年度的" },
  ]
}
