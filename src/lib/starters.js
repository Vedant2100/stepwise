// Ready-made climbs. Their plans and first exercises are generated ahead of time into the shared cache
// (scripts/warm.mjs), so a first-time visitor can start one instantly, without an access code.
export const STARTERS = [
  'Understand and implement scaled dot-product attention',
  'Binary search, well enough for interviews',
  'Order food in Spanish',
  'Get a feel for how learning rate affects training',
  'Big-O notation for coding interviews',
]

// The mastery levels a learner passes through on their first tries at a concept (see exercisePrompt):
// untouched (introductory), and after a first pass (intermediate). Each gets every shared variant.
export const WARM_LEVELS = [
  { pL: 0.1, attempts: [0, 1, 2] },
  { pL: 0.47, attempts: [1, 2, 3] },
]
