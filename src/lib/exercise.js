import { ask } from './llm.js'
import { exercisePrompt, system } from './prompts.js'
import { verifyCode } from './runner.js'

const nonEmpty = (a) => Array.isArray(a) && a.length > 0

// Checks the shape of each environment's exercise, since it comes from the model.
const VALID = {
  explain: (x) => typeof x.question === 'string' && nonEmpty(x.rubric),
  steps: (x) => typeof x.problem === 'string' && nonEmpty(x.steps) && x.steps.every((s) => typeof s.expected === 'string'),
  code: (x) => typeof x.reference === 'string' && nonEmpty(x.tests) && x.tests.every((t) => typeof t.code === 'string'),
  drill: (x) => nonEmpty(x.cards) && x.cards.every((c) => typeof c.front === 'string' && typeof c.back === 'string'),
}

export async function makeExercise(env, concept, track, mode) {
  const exercise = await ask(system(track), exercisePrompt(env, concept, track, mode))
  if (!VALID[env](exercise)) throw new Error('The generated exercise was incomplete. Try again.')
  return env === 'code' ? verifyCode(exercise) : exercise
}
