import { ACCESS_KEY } from './llm.js'

const MAX_FILE = 20_000_000
export const URL_RE = /https?:\/\/[^\s<>"')\]]+/

async function post(body) {
  const res = await fetch('/api/ingest', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-access-code': localStorage.getItem(ACCESS_KEY) ?? '' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || 'Couldn’t read that.'), { status: res.status })
  return data
}

async function pdfText(bytes) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  const doc = await pdfjs.getDocument({ data: bytes }).promise
  const pages = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    pages.push((await page.getTextContent()).items.map((x) => x.str + (x.hasEOL ? '\n' : ' ')).join(''))
  }
  const text = pages.join('\n\n').trim()
  if (!text) throw new Error('That PDF has no text layer (it may be scanned). Take a screenshot of the pages and attach that instead.')
  return text
}

async function shrink(file) {
  const img = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height))
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * scale), height: Math.round(img.height * scale) })
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
}

export async function readFile(file) {
  if (file.size > MAX_FILE) throw new Error('That file is over 20 MB.')
  const name = file.name || 'Pasted image'
  if (file.type.startsWith('image/')) return post({ image: { mediaType: 'image/jpeg', data: await shrink(file), name } })
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return { title: name, text: await pdfText(new Uint8Array(await file.arrayBuffer())) }
  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth')
    return { title: name, text: (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value.trim() }
  }
  if (file.type.startsWith('text/') || /\.(txt|md|markdown|csv|json)$/i.test(name)) return { title: name, text: await file.text() }
  throw new Error('Stepwise can read PDFs, Word (.docx), text and Markdown files, and images.')
}

export async function readLink(url) {
  const page = await post({ url })
  if (page.pdf) return { title: page.title, text: await pdfText(Uint8Array.from(atob(page.pdf), (c) => c.charCodeAt(0))) }
  return page
}
