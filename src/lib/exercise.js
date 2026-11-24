import { ask } from './llm.js'
import { exercisePrompt, system } from './prompts.js'
import { verifyCode } from './runner.js'
import { verifyNotebook, verifyReadCode, verifyTrace } from './verify.js'

const nonEmpty = (a) => Array.isArray(a) && a.length > 0

// Checks the shape of each environment's exercise, since it comes from the model.
export const VALID = {
  explain: (x) => typeof x.question === 'string' && nonEmpty(x.rubric),
  steps: (x) => typeof x.problem === 'string' && nonEmpty(x.steps) && x.steps.every((s) => typeof s.expected === 'string'),
  code: (x) => typeof x.reference === 'string' && nonEmpty(x.tests) && x.tests.every((t) => typeof t.code === 'string'),
  drill: (x) => nonEmpty(x.cards) && x.cards.every((c) => typeof c.front === 'string' && typeof c.back === 'string'),
  readcode: (x) => nonEmpty(x.snippets) && x.snippets.every((s) => typeof s.code === 'string'),
  sort: (x) =>
    (x.mode === 'order' && nonEmpty(x.items) && x.items.length >= 3 && new Set(x.items).size === x.items.length && x.items.every((i) => typeof i === 'string')) ||
    (x.mode === 'buckets' && nonEmpty(x.buckets) && x.buckets.length >= 2 && x.buckets.every((b) => typeof b.name === 'string' && nonEmpty(b.items))),
  notebook: (x) => typeof x.setup === 'string' && nonEmpty(x.tasks) && x.tasks.every((t) => typeof t.check === 'string' && typeof t.solution === 'string'),
  trace: (x) =>
    typeof x.code === 'string' && Array.isArray(x.questions) &&
    x.questions.every((q) => nonEmpty(q.choices) && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length),
  sim: (x) =>
    typeof x.compute === 'string' && nonEmpty(x.questions) && nonEmpty(x.params) &&
    x.params.every((q) => /^[A-Za-z_]\w*$/.test(q.name) && [q.min, q.max, q.step, q.value].every(Number.isFinite) && q.min < q.max),
}

export async function makeExercise(env, concept, track, mode) {
  const exercise = await ask(system(track), exercisePrompt(env, concept, track, mode))
  if (!VALID[env](exercise)) throw new Error('The generated exercise was incomplete. Try again.')
  const verify = { code: verifyCode, readcode: verifyReadCode, trace: verifyTrace, notebook: verifyNotebook }[env]
  return verify ? verify(exercise) : exercise
}
