/**
 * Generate word bank JSON files from git submodule data
 * Reads from src/wordbank/json/ and outputs to dist/wordbank/
 */

const fs = require('fs')
const path = require('path')

const SRC = path.join(__dirname, '..', 'src', 'wordbank', 'json')
const DST = path.join(__dirname, '..', 'dist', 'wordbank')

const BOOK_MAP = {
  '1-初中-顺序.json': 'chuzhong',
  '2-高中-顺序.json': 'gaozhong',
  '3-CET4-顺序.json': 'cet4',
  '4-CET6-顺序.json': 'cet6',
  '5-考研-顺序.json': 'kaoyan',
  '6-托福-顺序.json': 'toefl',
  '7-SAT-顺序.json': 'sat',
}

function extractWord(raw) {
  // Build meaning from translations
  const translations = raw.translations || []
  const meaning = translations
    .map(function(t) { return (t.type || '') + '. ' + (t.translation || '') })
    .join('；')

  // Extract phonetic from first translation text if available
  const phonetic = raw.phonetic || ''

  // Extract first sentence if available
  var sentences = []
  if (raw.examples && raw.examples.length > 0) {
    sentences.push({
      en: raw.examples[0].en || '',
      zh: raw.examples[0].zh || ''
    })
  }

  return {
    word: raw.word || '',
    phonetic: phonetic,
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
  const files = fs.readdirSync(SRC)
  
  for (const file of files) {
    const bookId = BOOK_MAP[file]
    if (!bookId) {
      console.log(`  ⏭  Skipping ${file} (unknown mapping)`)
      continue
    }

    const srcPath = path.join(SRC, file)
    console.log(`  Processing ${file} -> ${bookId}.json`)
    
    const raw = JSON.parse(fs.readFileSync(srcPath, 'utf-8'))
    const words = raw.filter(function(w) { return w.word }).map(extractWord)
    
    const dstPath = path.join(DST, `${bookId}.json`)
    fs.writeFileSync(dstPath, JSON.stringify(words), 'utf-8')
    
    console.log(`    ${words.length} words extracted`)
    total += words.length
  }

  console.log(`\n✅ Done! ${total} total words across ${Object.keys(BOOK_MAP).length} word banks`)
  console.log(`   Output: ${DST}`)
}

main()
