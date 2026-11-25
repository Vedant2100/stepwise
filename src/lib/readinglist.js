import { ask } from './llm.js'
import { readLink } from './ingest.js'
import { digestPrompt, mapPrompt, system } from './prompts.js'

export const MAX_LINKS = 10
const PAGE_CHARS = 12_000
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ')

export const findUrls = (text) => [...new Set(text.match(/https?:\/\/[^\s<>"')\]]+/g) ?? [])].map((u) => u.replace(/[.,;:]+$/, ''))

const NOT_ARTICLES = /(colab\.research\.google\.com|(\/\/|\.)x\.com\b|twitter\.com|\/\/t\.co\/|youtube\.com|youtu\.be|linkedin\.com|ashbyhq\.com|greenhouse\.io|lever\.co|google\.com\/about\/careers|vscode\.dev|docs\.craft\.do|drawboard\.com|\/login\b)/i

export function isReadingList(text) {
  const urls = findUrls(text).length
  const lines = text.split('\n').filter((l) => l.trim()).length
  return urls >= 5 || (urls >= 2 && urls >= lines * 0.3)
}

export function pickArticles(urls) {
  const seen = new Set()
  const unique = urls.filter((u) => {
    const url = new URL(u)
    url.hash = ''
    for (const k of [...url.searchParams.keys()]) if (k.startsWith('utm_')) url.searchParams.delete(k)
    const key = url.href.replace(/\/$/, '')
    return !seen.has(key) && seen.add(key)
  })
  const articles = unique.filter((u) => !NOT_ARTICLES.test(u))
  return { articles, skipped: unique.length - articles.length }
}

async function digest(page) {
  const text = page.text.slice(0, PAGE_CHARS)
  const d = await ask(system({ source: text }), `SOURCE:\n<<<\n${text}\n>>>\n\n${digestPrompt(page.title)}`, { variant: 0 })
  const points = (Array.isArray(d.points) ? d.points : [])
    .filter((p) => typeof p?.point === 'string' && typeof p.quote === 'string' && norm(text).includes(norm(p.quote)))
  return { title: page.title, url: page.url, summary: typeof d.summary === 'string' ? d.summary : '', points }
}

function cleanMap(raw, n) {
  const seen = new Set()
  const steps = (Array.isArray(raw?.steps) ? raw.steps : [])
    .filter((s) => Number.isInteger(s?.doc) && s.doc >= 0 && s.doc < n && !seen.has(s.doc) && seen.add(s.doc))
    .map((s) => ({ doc: s.doc, ideas: (Array.isArray(s.ideas) ? s.ideas : []).filter((x) => typeof x === 'string').slice(0, 3) }))
  for (let i = 0; i < n; i++) if (!seen.has(i)) steps.push({ doc: i, ideas: [] })
  const links = (Array.isArray(raw?.links) ? raw.links : []).filter((l) => Number.isInteger(l?.from) && Number.isInteger(l?.to) && l.from !== l.to && l.from < n && l.to < n && l.from >= 0 && l.to >= 0)
  const themes = (Array.isArray(raw?.themes) ? raw.themes : []).filter((t) => typeof t === 'string').slice(0, 4)
  return { steps, links, themes }
}

export async function readList(all) {
  const { articles: urls, skipped: notArticles } = pickArticles(all)
  if (!urls.length) throw new Error('None of those links look like articles (they’re notebooks, social posts, videos, job listings or logins), so there’s nothing to read.')
  const tried = urls.slice(0, MAX_LINKS)
  const results = await Promise.allSettled(tried.map((u) => readLink(u).then((p) => ({ ...p, url: u }))))
  const denied = results.find((r) => r.status === 'rejected' && r.reason?.status === 401)
  if (denied) throw denied.reason
  const pages = results.flatMap((r) => (r.status === 'fulfilled' && r.value.text?.trim() ? [r.value] : []))
  const failed = tried.filter((u, i) => results[i].status === 'rejected' || !results[i].value.text?.trim())
  if (!pages.length) throw new Error('None of those links could be opened. They may need a login or block automated access.')
  const digests = await Promise.all(pages.map(digest))
  const map = cleanMap(await ask(system(), mapPrompt(digests), { variant: 0 }), digests.length)
  const text = digests.map((d) => `## ${d.title}\n${d.url}\n${d.summary}\n${d.points.map((p) => `- ${p.point} "${p.quote}"`).join('\n')}`).join('\n\n')
  return {
    name: `${pages.length} posts`,
    text,
    pages: pages.map((p) => ({ title: p.title, url: p.url, text: p.text.slice(0, PAGE_CHARS) })),
    map: { ...map, docs: digests.map(({ title, url, summary }) => ({ title, url, summary })) },
    skipped: urls.length - tried.length,
    notArticles,
    failed,
  }
}
