import { BKT } from './learner.js'

export const PENDING_KEY = 'stepwise.pendingClimb'
export const shareUrl = (id) => `${location.origin}/c/${id}`
export const shareId = (path = location.pathname) => path.match(/^\/c\/([A-Za-z0-9]{10})\/?$/)?.[1] ?? null

async function api(method, body, query = '') {
  const res = await fetch(`/api/share${query}`, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body && JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.')
  return data
}

// What a link publishes: the plan and progress per concept. Not the notes, answers or history.
export async function createLink(track) {
  const { id } = await api('POST', {
    title: track.title,
    objective: track.objective,
    startedAt: track.createdAt,
    concepts: track.concepts.map(({ id, name, type, summary, prereqs, pL }) => ({ id, name, type, summary, prereqs, pL })),
  })
  return shareUrl(id)
}

export const fetchClimb = (id) => api('GET', null, `?id=${id}`)

// A copy starts from the bottom: same plan, fresh progress.
export const copyClimb = (snap) => ({
  id: crypto.randomUUID(),
  objective: snap.objective,
  title: snap.title,
  source: '',
  concepts: snap.concepts.map(({ id, name, type, summary, prereqs }) => ({ id, name, type, summary, quote: '', grounded: null, prereqs, pL: BKT.init, attempts: 0, misses: 0, review: null })),
  log: [],
  createdAt: Date.now(),
  copiedFrom: snap.title,
})
