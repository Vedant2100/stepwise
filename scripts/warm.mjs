// Pre-generates the starter climbs (src/lib/starters.js) into production's shared cache, using the
// app's own prompts, validators and Python checks, so visitors can start them without an access code.
// Usage: URL=https://... CODE=... node scripts/warm.mjs
import { readFileSync } from 'node:fs'
import { loadPyodide } from 'pyodide'
import { parseJSON } from '../src/lib/llm.js'
import { validatePlan } from '../src/lib/plan.js'
import { envFor } from '../src/lib/planner.js'
import { VALID, VARIANTS } from '../src/lib/exercise.js'
import { exercisePrompt, planPrompt, system } from '../src/lib/prompts.js'
import { STARTERS, WARM_LEVELS } from '../src/lib/starters.js'
import { verifyNotebook, verifyReadCode, verifyTrace } from '../src/lib/verify.js'

const { URL, CODE = '' } = process.env
const read = (f) => readFileSync(new globalThis.URL(`../src/lib/${f}`, import.meta.url), 'utf8')
const [TESTS, RUN, CELL] = ['harness.py', 'harness_run.py', 'harness_cell.py'].map(read)
const py = await loadPyodide()
let calls = 0, stored = 0, cached = 0, failed = 0

async function pyRun(harness, vars, code) {
  await py.loadPackagesFromImports(code)
  for (const [k, v] of Object.entries(vars)) py.globals.set(k, v)
  return JSON.parse(py.runPython(harness))
}
const node = {
  runTests: (code, tests) => pyRun(TESTS, { USER: code, TESTS_JSON: JSON.stringify(tests) }, code),
  runCode: (code) => pyRun(RUN, { CODE: code }, code),
  runCell: (nb, code) => pyRun(CELL, { CODE: code, NB: nb, MODE: 'run' }, code),
  checkCell: (nb, code) => pyRun(CELL, { CODE: code, NB: nb, MODE: 'check' }, code),
  resetNotebook: (nb) => pyRun(CELL, { CODE: '', NB: nb, MODE: 'reset' }, ''),
}
async function verifyCode(x) {
  const r = await node.runTests(x.reference, x.tests)
  if (r.setup || r.tests.filter((t) => t.ok).length < 2) throw new Error('reference fails its tests')
}
const VERIFY = { code: verifyCode, readcode: (x) => verifyReadCode(x, node), trace: (x) => verifyTrace(x, node), notebook: (x) => verifyNotebook(x, node) }

async function ask(sys, prompt, share) {
  calls++
  const res = await fetch(`${URL}/api/llm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-access-code': CODE },
    body: JSON.stringify({ system: sys, prompt, cache: share }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${data.error}`)
  data.cached ? cached++ : stored++
  return parseJSON(data.text)
}

// Same as the app's makeExercise: one retry that replaces a bad cached entry.
async function warmExercise(env, concept, track) {
  for (const fresh of [false, true]) {
    try {
      const x = await ask(system(track), exercisePrompt(env, concept, track, 'learn'), { variant: concept.attempts % VARIANTS, fresh })
      if (!VALID[env](x)) throw new Error('incomplete')
      await VERIFY[env]?.(x)
      return
    } catch (e) {
      if (fresh || e.message.startsWith('HTTP')) { failed++; console.log(`  ! ${concept.name} [${env}]: ${e.message}`); return }
    }
  }
}

for (const raw of STARTERS) {
  const objective = raw.replace(/\s+/g, ' ').trim()
  const plan = validatePlan(await ask(system({ source: '' }), planPrompt(objective, ''), { variant: 0 }), '')
  const track = { objective, source: '', ...plan }
  console.log(`${plan.title}: ${plan.concepts.length} concepts`)
  const jobs = plan.concepts.flatMap((c) => WARM_LEVELS.flatMap(({ pL, attempts }) => attempts.map((a) => () => warmExercise(envFor(c.type), { ...c, pL, attempts: a }, track))))
  // Four at a time: Python checks run one after another anyway, and this keeps the API rate low.
  for (let i = 0; i < jobs.length; i += 4) await Promise.all(jobs.slice(i, i + 4).map((j) => j()))
}
console.log(`\n${calls} requests: ${stored} newly stored, ${cached} already cached, ${failed} failed`)
if (failed > calls * 0.2) process.exit(1)
