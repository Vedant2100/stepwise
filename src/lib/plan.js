import { BKT } from './learner.js'
import { TASK_TYPES } from './planner.js'

const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim()
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function validatePlan(raw, source) {
  if (!raw || !Array.isArray(raw.concepts) || !raw.concepts.length) throw new Error('The plan had no concepts.')
  const concepts = []
  for (const c of raw.concepts.slice(0, 30)) {
    if (typeof c.name !== 'string' || !c.name.trim() || !TASK_TYPES.includes(c.type)) continue
    let id = slug(c.id || c.name) || `c${concepts.length}`
    while (concepts.some((x) => x.id === id)) id += '-2'
    const earlier = new Set(concepts.map((x) => x.id))
    const quote = typeof c.quote === 'string' ? c.quote.trim() : ''
    concepts.push({
      id,
      name: c.name.trim(),
      type: c.type,
      summary: typeof c.summary === 'string' ? c.summary : '',
      quote,
      grounded: source ? Boolean(quote) && norm(source).includes(norm(quote)) : null,
      prereqs: (Array.isArray(c.prereqs) ? c.prereqs : []).map((p) => slug(String(p))).filter((p) => earlier.has(p)),
      pL: BKT.init,
      attempts: 0,
      review: null,
    })
  }
  if (!concepts.length) throw new Error('None of the planned concepts were usable.')
  return { title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'Untitled', concepts }
}

export function mergePlan(old, revised) {
  const byId = new Map(old.map((c) => [c.id, c]))
  return revised.map((c) => {
    const had = byId.get(c.id)
    return had ? { ...c, pL: had.pL, attempts: had.attempts, misses: had.misses ?? 0, review: had.review } : c
  })
}
