import { STUCK, isMastered } from './learner.js'

export const TASK_TYPES = ['concept', 'procedure', 'skill', 'recall', 'intuition', 'reading', 'ordering', 'data', 'algorithm', 'interview']

export const ENVIRONMENTS = {
  explain: { label: 'Explain it back', for: 'concept' },
  steps: { label: 'Step workspace', for: 'procedure' },
  code: { label: 'Code sandbox', for: 'skill' },
  drill: { label: 'Retrieval drill', for: 'recall' },
  sim: { label: 'Simulation', for: 'intuition' },
  readcode: { label: 'Read & debug', for: 'reading' },
  sort: { label: 'Sort & sequence', for: 'ordering' },
  notebook: { label: 'Data notebook', for: 'data' },
  trace: { label: 'Algorithm tracer', for: 'algorithm' },
  interview: { label: 'Interview room', for: 'interview' },
}

// Other workspaces that suit the same material, offered so the learner can try a different angle.
const ALTERNATIVES = {
  explain: ['drill', 'interview'], steps: ['explain', 'sort'], code: ['readcode', 'trace'], drill: ['explain', 'sort'],
  sim: ['explain', 'drill'], readcode: ['code', 'trace'], sort: ['drill', 'explain'], notebook: ['code', 'sim'],
  trace: ['code', 'readcode'], interview: ['explain', 'drill'],
}
// Workspaces the learner hasn't used yet come first.
export function alternativesFor(env, tracks) {
  const used = new Set(tracks.flatMap((t) => t.log.map((l) => l.env)))
  return [...ALTERNATIVES[env]].sort((a, b) => used.has(a) - used.has(b))
}

export const envFor = (type) => Object.keys(ENVIRONMENTS).find((k) => ENVIRONMENTS[k].for === type)

// Due reviews first (oldest first). Otherwise, among concepts whose prerequisites are mastered:
// 1. one you just missed comes straight back, 2. then new concepts in climb order,
// 3. then ones you've passed but not yet mastered, 4. after STUCK misses in a row a concept waits until last.
const priority = (c) => {
  const misses = c.misses ?? 0
  if (misses >= STUCK) return 3
  if (misses > 0) return 0
  return c.attempts === 0 ? 1 : 2
}
export function nextStep(concepts, now) {
  const byId = Object.fromEntries(concepts.map((c) => [c.id, c]))
  const due = concepts.filter((c) => c.review && c.review.due <= now).sort((a, b) => a.review.due - b.review.due)
  if (due.length) return { concept: due[0], mode: 'review' }

  const ready = concepts
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !isMastered(c) && c.prereqs.every((id) => isMastered(byId[id])))
    .sort((a, b) => priority(a.c) - priority(b.c) || a.i - b.i)
  if (ready.length) return { concept: ready[0].c, mode: 'learn' }
  return null
}

export function nextReviewAt(concepts) {
  const times = concepts.filter((c) => c.review).map((c) => c.review.due)
  return times.length ? Math.min(...times) : null
}
