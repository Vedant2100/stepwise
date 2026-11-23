// Learner model: Bayesian Knowledge Tracing per concept, plus SM-2 spacing once a concept is mastered.

export const BKT = { init: 0.1, learn: 0.2, slip: 0.1, guess: 0.2 }
export const MASTERED = 0.95
export const PASS = 70
const DAY = 86_400_000

export const isMastered = (c) => c.pL >= MASTERED

export function updateMastery(pL, correct) {
  const { learn, slip, guess } = BKT
  const posterior = correct
    ? (pL * (1 - slip)) / (pL * (1 - slip) + (1 - pL) * guess)
    : (pL * slip) / (pL * slip + (1 - pL) * (1 - guess))
  return posterior + (1 - posterior) * learn
}

// SM-2 with quality = score / 20 (0–5).
export function schedule(review, score, now) {
  const q = score / 20
  if (!review) return { ease: 2.5, reps: 1, interval: 1, due: now + DAY }
  const ease = Math.max(1.3, review.ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  if (q < 3) return { ease, reps: 0, interval: 1, due: now + DAY }
  const reps = review.reps + 1
  const interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(review.interval * ease)
  return { ease, reps, interval, due: now + interval * DAY }
}

export function recordAttempt(concept, score, now) {
  const pL = updateMastery(concept.pL, score >= PASS)
  const review = pL >= MASTERED ? schedule(concept.review, score, now) : null
  return { ...concept, pL, review, attempts: concept.attempts + 1 }
}
