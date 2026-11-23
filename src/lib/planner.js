import { isMastered } from './learner.js'

export const TASK_TYPES = ['concept', 'procedure', 'skill', 'recall', 'intuition']

export const ENVIRONMENTS = {
  explain: { label: 'Explain it back', for: 'concept' },
  steps: { label: 'Step workspace', for: 'procedure' },
  code: { label: 'Code sandbox', for: 'skill' },
  drill: { label: 'Retrieval drill', for: 'recall' },
  sim: { label: 'Simulation', for: 'intuition' },
}

export const envFor = (type) => Object.keys(ENVIRONMENTS).find((k) => ENVIRONMENTS[k].for === type)

// Due reviews first (oldest first), then the weakest concept whose prerequisites are all mastered.
export function nextStep(concepts, now) {
  const byId = Object.fromEntries(concepts.map((c) => [c.id, c]))
  const due = concepts.filter((c) => c.review && c.review.due <= now).sort((a, b) => a.review.due - b.review.due)
  if (due.length) return { concept: due[0], mode: 'review' }

  const ready = concepts
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !isMastered(c) && c.prereqs.every((id) => isMastered(byId[id])))
    .sort((a, b) => a.c.pL - b.c.pL || a.i - b.i)
  if (ready.length) return { concept: ready[0].c, mode: 'learn' }
  return null
}

export function nextReviewAt(concepts) {
  const times = concepts.filter((c) => c.review).map((c) => c.review.due)
  return times.length ? Math.min(...times) : null
}
