// Public, read-only snapshots of a climb: its title, objective, concepts and progress. Never the
// learner's notes (source), answers or log. Anyone with the link can view one and start a copy.
import { randomBytes } from 'node:crypto'
import { TASK_TYPES } from '../src/lib/planner.js'

const TTL = 60 * 60 * 24 * 365
const LIMIT = 20 // new links per IP per hour
const ID = /^[A-Za-z0-9]{10}$/
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

const str = (v, max) => typeof v === 'string' && v.trim() && v.length <= max
const newId = () => [...randomBytes(10)].map((b) => ALPHABET[b % ALPHABET.length]).join('')

// Rebuilds the snapshot from whitelisted fields only, so nothing else a client sends gets published.
export function cleanShare(body) {
  const { title, objective, concepts, startedAt } = body ?? {}
  if (!str(title, 200) || !str(objective, 500) || !Array.isArray(concepts) || !concepts.length || concepts.length > 40) return null
  const ids = new Set(concepts.map((c) => c?.id))
  const out = []
  for (const c of concepts) {
    if (!str(c?.id, 80) || !str(c.name, 200) || !TASK_TYPES.includes(c.type) || (c.summary != null && typeof c.summary !== 'string')) return null
    if (!Array.isArray(c.prereqs) || !c.prereqs.every((p) => ids.has(p)) || !(c.pL >= 0 && c.pL <= 1)) return null
    out.push({ id: c.id, name: c.name, type: c.type, summary: (c.summary ?? '').slice(0, 1000), prereqs: c.prereqs, pL: Math.round(c.pL * 100) / 100 })
  }
  return { title, objective, concepts: out, startedAt: Number.isFinite(startedAt) ? startedAt : null, sharedAt: Date.now() }
}

export async function handleShare({ method, body, query, ip }, store) {
  if (method === 'GET') {
    const id = query?.id
    if (!ID.test(id ?? '')) return { status: 400, data: { error: 'Bad link.' } }
    const snap = await store.get(`share:${id}`)
    return snap ? { status: 200, data: snap } : { status: 404, data: { error: 'This climb isn’t available. The link may be wrong or it may have expired.' } }
  }
  if (method !== 'POST') return { status: 405, data: { error: 'GET or POST only.' } }
  const snap = cleanShare(body)
  if (!snap) return { status: 400, data: { error: 'That climb can’t be shared.' } }
  if (JSON.stringify(snap).length > 60_000) return { status: 413, data: { error: 'That climb is too large to share.' } }
  if ((await store.incr(`sharerl:${ip || 'unknown'}`, 3600)) > LIMIT) return { status: 429, data: { error: 'Too many links in the last hour. Try again later.' } }
  for (let i = 0; i < 3; i++) {
    const id = newId()
    if (await store.set(`share:${id}`, snap, { ttl: TTL, nx: true })) return { status: 200, data: { id } }
  }
  return { status: 500, data: { error: 'Couldn’t create a link. Try again.' } }
}
