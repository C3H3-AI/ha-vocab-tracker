import type { VocabWord } from '../types/vocab'
import type { AppData } from './storage'

export function printWordsHtml(words: VocabWord[], title: string): string {
  const rows = words.map((w, i) => `
    <tr${i % 2 === 1 ? ' style="background:#f8f8f8"' : ''}>
      <td style="padding:4px 8px;color:#999;font-size:11px;width:30px;">${i + 1}</td>
      <td style="padding:4px 8px;font-weight:600;color:#185FA5;font-size:14px;">${w.word}</td>
      <td style="padding:4px 8px;color:#888;font-size:12px;">${w.phonetic || ''}</td>
      <td style="padding:4px 8px;color:#666;font-size:11px;">${w.pos || ''}</td>
      <td style="padding:4px 8px;color:#333;font-size:13px;">${w.meaning}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>${title}</title>
<style>
  @page { margin: 15mm 10mm; }
  body { font-family: sans-serif; font-size: 13px; color: #333; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .sub { color: #888; font-size: 12px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #378ADD; color: white; padding: 6px 8px; font-size: 12px; text-align: left; }
  td { border-bottom: 0.5px solid #e0e0e0; }
  .footer { margin-top: 16px; font-size: 11px; color: #aaa; text-align: center; }
  @media print { .no-print { display: none; } }
</style></head>
<body>
  <h1>${title}</h1>
  <div class="sub">共 ${words.length} 词</div>
  <table>
    <tr><th>#</th><th>单词</th><th>音标</th><th>词性</th><th>释义</th></tr>
    ${rows}
  </table>
  <div class="footer">HA Vocab Tracker - 打印时间 ${new Date().toLocaleDateString('zh-CN')}</div>
  <script>window.print()</script>
</body></html>`
}

export function printWords(words: VocabWord[], title: string): void {
  const html = printWordsHtml(words, title)
  const win = window.open('', '_blank', 'width=800,height=600')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}

export function printDayPlan(
  day: number,
  newWords: VocabWord[],
  reviewWords: VocabWord[]
): void {
  const title = `Day ${day} 词汇学习`
  const all = [...newWords, ...reviewWords]
  printWords(all, title)
}

export function callHaService(service: string, data: Record<string, any>): Promise<void> {
  // Call HA API via fetch
  return fetch('/api/services/' + service.replace('.', '/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => {
    if (!r.ok) throw new Error(`HA service call failed: ${r.status}`)
  })
}
