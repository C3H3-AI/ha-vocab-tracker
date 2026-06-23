/**
 * Generate word bank JSON files + copy additional banks from vocab-wordbank
 * 
 * Two sources:
 *   1. src/wordbank/json/ — git submodule from KyleBing/english-vocabulary
 *   2. D:/ai-hub/vocab-wordbank/wordbanks/ — additional banks (primary, gaokao-*, etc.)
 * 
 * Output: dist/wordbank/
 */
const fs = require('fs')
const path = require('path')

const SUBMODULE_SRC = path.join(__dirname, '..', 'src', 'wordbank', 'json')
const EXTERNAL_SRC = 'D:/ai-hub/vocab-wordbank/wordbanks'
const DST = path.join(__dirname, '..', 'dist', 'wordbank')

/** Maps submodule source files → output filenames (without .json) */
const BOOK_MAP = {
  '1-初中-顺序.json': 'junior',
  '2-高中-顺序.json': 'senior',
  '3-CET4-顺序.json': 'cet4',
  '4-CET6-顺序.json': 'cet6',
  '5-考研-顺序.json': 'kaoyan',
  '6-托福-顺序.json': 'toefl',
  '7-SAT-顺序.json': 'sat',
}

/** Additional banks to copy from vocab-wordbank repo */
const EXTRA_BANKS = [
  'primary.json',
  'gaokao-3500.json',
  'gaokao-24days.json',
  'gaokao-core-20days.json',
  'gaokao-michael.json',
  'postgraduate.json',
]

function extractWord(raw) {
  const translations = raw.translations || []
  const meaning = translations
    .map(t => (t.type || '') + '. ' + (t.translation || ''))
    .join('；')
  const phonetic = raw.phonetic || ''
  const sentences = []
  if (raw.examples && raw.examples.length > 0) {
    sentences.push({ en: raw.examples[0].en || '', zh: raw.examples[0].zh || '' })
  }
  return {
    word: raw.word || '',
    phonetic,
    pos: translations[0] ? (translations[0].type || '') : '',
    meaning: meaning || raw.translation || '',
    sentences: sentences.length > 0 ? sentences : undefined,
  }
}

function main() {
  console.log('Generating word banks...')

  if (!fs.existsSync(DST)) {
    fs.mkdirSync(DST, { recursive: true })
  }

  let total = 0

  // === Source 1: git submodule ===
  if (fs.existsSync(SUBMODULE_SRC)) {
    const files = fs.readdirSync(SUBMODULE_SRC)
    for (const file of files) {
      const bookId = BOOK_MAP[file]
      if (!bookId) {
        console.log(`  ⏭  Skipping ${file} (unknown mapping)`)
        continue
      }
      const srcPath = path.join(SUBMODULE_SRC, file)
      console.log(`  Processing ${file} -> ${bookId}.json`)
      const raw = JSON.parse(fs.readFileSync(srcPath, 'utf-8'))
      const words = raw.filter(w => w.word).map(extractWord)
      fs.writeFileSync(path.join(DST, `${bookId}.json`), JSON.stringify(words), 'utf-8')
      console.log(`    ${words.length} words extracted`)
      total += words.length
    }
  } else {
    console.log(`  ⚠️  Submodule source not found: ${SUBMODULE_SRC}`)
  }

  // === Source 2: extra banks from vocab-wordbank ===
  if (fs.existsSync(EXTERNAL_SRC)) {
    console.log(`\n  Copying extra banks from vocab-wordbank...`)
    for (const fname of EXTRA_BANKS) {
      const srcPath = path.join(EXTERNAL_SRC, fname)
      if (!fs.existsSync(srcPath)) {
        console.log(`  ⚠️  Skipping ${fname} (not found)`)
        continue
      }
      const raw = JSON.parse(fs.readFileSync(srcPath, 'utf-8'))
      // Normalize: unwrap { meta, words } → flat array
      const srcWords = Array.isArray(raw) ? raw : (raw.words || [])
      // Handle both array-format [word, phonetic, pos, meaning] and object-format {word, meaning}
      const words = srcWords
        .filter(function(w) { return w })
        .map(function(w) {
          if (Array.isArray(w)) {
            return { word: w[0] || '', phonetic: w[1] || '', pos: w[2] || '', meaning: w[3] || '' }
          }
          return w
        })
        .filter(function(w) { return w.word })
      const dstPath = path.join(DST, fname)
      fs.writeFileSync(dstPath, JSON.stringify(words), 'utf-8')
      console.log(`  ✅ ${fname} (${words.length} words)`)
      total += words.length
    }
  } else {
    console.log(`  ⚠️  vocab-wordbank repo not found: ${EXTERNAL_SRC}`)
    console.log(`  Run: git clone https://github.com/C3H3-AI/vocab-wordbank.git ${EXTERNAL_SRC}`)
  }

  // === Write index.json for metadata ===
  const index = {}
  for (const fname of fs.readdirSync(DST).filter(f => f.endsWith('.json') && f !== 'index.json')) {
    const data = JSON.parse(fs.readFileSync(path.join(DST, fname), 'utf-8'))
    index[fname.replace('.json', '')] = data.length
  }
  // Also add wordCount from wordbank.ts AVAILABLE_BOOKS if available
  try {
    const appContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', 'wordbank.ts'), 'utf-8')
    const countMatch = appContent.match(/wordCount:\s*(\d+)/g)
    if (countMatch) {
      // Add metadata comment to index
      index._note = 'word counts from data files'
    }
  } catch (_) {}

  console.log(`\n✅ Done! ${total} total words across all word banks`)
  console.log(`   Output: ${DST}`)
}

main()
