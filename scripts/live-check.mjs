// Usage: URL=https://... CODE=... node scripts/live-check.mjs
import { readFileSync } from 'node:fs'
import { loadPyodide } from 'pyodide'
import { parseJSON } from '../src/lib/llm.js'
import { validatePlan } from '../src/lib/plan.js'
import { envFor } from '../src/lib/planner.js'
import { VALID } from '../src/lib/exercise.js'
import { checkStepPrompt, exercisePrompt, gradeExplainPrompt, planPrompt, system } from '../src/lib/prompts.js'
import { normalizeRoute, routePrompt, routeSystem } from '../src/lib/router.js'
import { sameStep } from '../src/lib/stepcheck.js'
import { verifyNotebook, verifyReadCode, verifyTrace } from '../src/lib/verify.js'

const { URL, CODE = '' } = process.env
const HARNESS = readFileSync(new globalThis.URL('../src/lib/harness.py', import.meta.url), 'utf8')
const py = await loadPyodide()
const issues = []
let calls = 0

async function ask(sys, prompt) {
  calls++
  const t0 = Date.now()
  const res = await fetch(`${URL}/api/llm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-access-code': CODE },
    body: JSON.stringify({ system: sys, prompt }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${data.error}`)
  const out = parseJSON(data.text)
  console.log(`    (${Date.now() - t0} ms)`)
  return out
}

const RUN = readFileSync(new globalThis.URL('../src/lib/harness_run.py', import.meta.url), 'utf8')
const CELL = readFileSync(new globalThis.URL('../src/lib/harness_cell.py', import.meta.url), 'utf8')
async function pyRun(harness, vars, code) {
  await py.loadPackagesFromImports(code)
  for (const [k, v] of Object.entries(vars)) py.globals.set(k, v)
  return JSON.parse(py.runPython(harness))
}
const node = {
  runTests: async (code, tests) => runTests(code, tests),
  runCode: (code) => pyRun(RUN, { CODE: code }, code),
  runCell: (nb, code) => pyRun(CELL, { CODE: code, NB: nb, MODE: 'run' }, code),
  checkCell: (nb, code) => pyRun(CELL, { CODE: code, NB: nb, MODE: 'check' }, code),
  resetNotebook: (nb) => pyRun(CELL, { CODE: '', NB: nb, MODE: 'reset' }, ''),
}

function runTests(code, tests) {
  py.globals.set('USER', code)
  py.globals.set('TESTS_JSON', JSON.stringify(tests))
  return JSON.parse(py.runPython(HARNESS))
}

const SOURCE = `Scaled dot-product attention takes queries, keys and values. The attention weights are computed by taking the dot product of each query with every key, dividing by the square root of the key dimension d_k, and applying a softmax so the weights for each query sum to one. The output is the weighted sum of the value vectors. Dividing by sqrt(d_k) keeps the dot products from growing large, which would push the softmax into regions with tiny gradients. Multi-head attention runs several attention functions in parallel on different learned projections and concatenates the results.`

const OBJECTIVES = [
  { objective: 'Build intuition for how softmax temperature changes attention weights', source: '' },
  { objective: 'Understand and implement scaled dot-product attention', source: SOURCE },
  { objective: 'Learn binary search well enough to code it in an interview', source: '' },
  { objective: 'Learn 10 essential Spanish phrases for ordering food', source: '' },
]

async function step(label, fn) {
  process.stdout.write(`  - ${label}\n`)
  try {
    return await fn()
  } catch (e) {
    issues.push(`${label}: ${e.message}`)
    console.log(`    FAILED: ${e.message}`)
    return null
  }
}

for (const { objective, source } of OBJECTIVES) {
  console.log(`\n## ${objective}${source ? ' (with source)' : ''}`)
  const track = { objective, source }
  const plan = await step('plan', async () => {
    const raw = await ask(system(track), planPrompt(objective, source))
    const p = validatePlan(raw, source)
    const dropped = raw.concepts.length - p.concepts.length
    console.log(`    "${p.title}": ${p.concepts.length} concepts${dropped ? `, ${dropped} dropped` : ''}`)
    for (const c of p.concepts) console.log(`      [${c.type}] ${c.name}${c.prereqs.length ? ` <- ${c.prereqs.join(', ')}` : ''}${c.grounded === false ? '  (QUOTE NOT FOUND)' : ''}`)
    if (source && p.concepts.some((c) => c.grounded === false)) issues.push(`${objective}: some quotes not found in source`)
    return p
  })
  if (!plan) continue

  const seen = new Set()
  for (const concept of plan.concepts) {
    const env = envFor(concept.type)
    if (seen.has(env)) continue
    seen.add(env)
    const ex = await step(`${env} exercise for "${concept.name}"`, async () => {
      const x = await ask(system(track), exercisePrompt(env, concept, track, 'learn'))
      if (!VALID[env](x)) throw new Error(`invalid shape: ${JSON.stringify(x).slice(0, 200)}`)
      return x
    })
    if (!ex) continue

    if (env === 'code') {
      await step('reference passes its own tests', () => {
        const r = runTests(ex.reference, ex.tests)
        if (r.setup) throw new Error(`reference does not run: ${r.setup.split('\n').slice(-2).join(' ')}`)
        const ok = r.tests.filter((t) => t.ok).length
        console.log(`    ${ok}/${ex.tests.length} tests pass on the reference`)
        if (ok < 2) throw new Error('fewer than 2 usable tests')
        const starter = runTests(ex.starter || '', ex.tests)
        console.log(`    starter passes ${starter.tests.filter((t) => t.ok).length}/${ex.tests.length} (should be ~0)`)
      })
    }
    if (env === 'explain') {
      console.log(`    Q: ${ex.question}`)
      const weak = await step('grade a weak answer', () => ask(system(track), gradeExplainPrompt(ex, 'It is a thing that models use to pay attention to stuff.')))
      const strong = await step('grade the model answer', () => ask(system(track), gradeExplainPrompt(ex, ex.reference)))
      if (weak && strong) {
        const met = (r) => (r.points ?? []).filter((p) => p.met).length
        console.log(`    weak=${weak.score} (${met(weak)}/${ex.rubric.length} points), model answer=${strong.score} (${met(strong)}/${ex.rubric.length} points)`)
        if (!(strong.score >= 70 && weak.score < 50)) issues.push(`explain grading not discriminating: weak=${weak.score}, strong=${strong.score}`)
        if ((strong.points ?? []).length !== ex.rubric.length) issues.push(`grader returned ${(strong.points ?? []).length} point verdicts for ${ex.rubric.length} rubric points`)
      }
    }
    if (env === 'steps') {
      console.log(`    ${ex.steps.length} steps; first expects: ${ex.steps[0].expected}`)
      const reworded = `${ex.steps[0].expected}`.replace(/\s+/g, ' ').trim()
      const right = await step('check a correct first step', async () => (sameStep(reworded, ex.steps[0].expected) ? { ok: true, local: true } : ask(system(track), checkStepPrompt(ex, 0, [], reworded))))
      const wrong = await step('check a wrong first step', () => ask(system(track), checkStepPrompt(ex, 0, [], 'I am not sure, maybe 42?')))
      if (right && wrong) {
        console.log(`    correct -> ok=${right.ok}; wrong -> ok=${wrong.ok} ("${wrong.feedback}")`)
        if (right.ok !== true || wrong.ok !== false) issues.push('step checking gave the wrong verdict')
      }
    }
    if (env === 'sim') {
      await step('simulation code runs and returns numbers across the slider ranges', () => {
        const f = new Function('p', '"use strict";' + ex.compute)
        for (const at of ['min', 'value', 'max']) {
          const r = f(Object.fromEntries(ex.params.map((q) => [q.name, q[at]])))
          if (!Array.isArray(r?.values) || !r.values.length || !r.values.every(Number.isFinite)) throw new Error(`bad output at ${at}: ${JSON.stringify(r).slice(0, 120)}`)
        }
        console.log(`    ${ex.params.map((q) => q.label || q.name).join(', ')} -> ${ex.chart}; ${ex.questions.length} questions`)
      })
    }
    if (env === 'drill') console.log(`    ${ex.cards.length} cards, e.g. "${ex.cards[0].front}" -> "${ex.cards[0].back}"`)
  }
}

console.log('\n## New workspaces')
const cs = { objective: 'Prepare for CS interviews and ML work', source: '' }
const NEW = [
  ['readcode', { name: 'Python list comprehensions and slicing', type: 'reading', summary: 'Predict output and fix bugs.', pL: 0.4 }],
  ['sort', { name: 'Phases of training a neural network', type: 'ordering', summary: 'Order the training loop.', pL: 0.4 }],
  ['notebook', { name: 'Exploring a dataset with pandas', type: 'data', summary: 'Group, aggregate and plot.', pL: 0.4 }],
  ['trace', { name: "Dijkstra's shortest paths", type: 'algorithm', summary: 'How distances settle.', pL: 0.4 }],
]
for (const [env, concept] of NEW) {
  const x = await step(`${env} exercise for "${concept.name}"`, async () => {
    const r = await ask(system(cs), exercisePrompt(env, concept, cs, 'learn'))
    if (!VALID[env](r)) throw new Error(`invalid shape: ${JSON.stringify(r).slice(0, 200)}`)
    return r
  })
  if (!x) continue
  await step(`${env} verified by running Python`, async () => {
    if (env === 'readcode') {
      const v = await verifyReadCode(x, node)
      console.log(`    ${v.snippets.length}/${x.snippets.length} snippets kept; bug-fix part ${v.debug ? `kept (${v.debug.tests.length} tests fail on the buggy code)` : 'dropped'}`)
      console.log(`    e.g. ${JSON.stringify(v.snippets[0].code.split('\n')[0])} prints ${JSON.stringify(v.snippets[0].output.trim().slice(0, 60))}`)
    }
    if (env === 'trace') {
      const v = await verifyTrace(x, node).catch((e) => { console.log(x.code); throw e })
      console.log(`    ${v.steps.length} real steps; first: ${JSON.stringify(v.steps[0]).slice(0, 100)}`)
    }
    if (env === 'notebook') {
      const v = await verifyNotebook(x, node)
      console.log(`    ${v.tasks.length}/${x.tasks.length} tasks pass their own hidden checks`)
      const plot = await node.runCell('plot-test', x.setup + '\nimport matplotlib.pyplot as plt\nplt.plot([1, 2, 3])')
      console.log(`    matplotlib renders: ${plot.images.length} image(s)${plot.error ? `; error ${plot.error}` : ''}`)
    }
    if (env === 'sort') console.log(`    ${x.mode}: ${JSON.stringify(x.items ?? x.buckets.map((b) => b.name))}`)
  })
}

console.log('\n## Chat router')
await step('a link is fetched through /api/ingest', async () => {
  calls++
  const res = await fetch(`${URL}/api/ingest`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-access-code': CODE }, body: JSON.stringify({ url: 'https://en.wikipedia.org/wiki/Softmax_function' }) })
  const page = await res.json()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${page.error}`)
  console.log(`    "${page.title}", ${page.text?.length ?? 0} characters${page.pdf ? ' (pdf)' : ''}`)
  if (!(page.text?.length > 500)) throw new Error('too little text came back')
})

const tracks = [{ id: 't1', title: 'Attention', objective: 'Understand attention', concepts: [{ pL: 0.97 }, { pL: 0.3 }] }]
const current = { concept: { name: 'Softmax by hand' }, env: 'steps', exercise: { problem: 'softmax([0,0])' } }
for (const [text, want] of [
  ['hi!', 'chat'], ['next one please', 'next'], ['teach me how DPO works', 'learn'], ['can I do this one in code instead?', 'switch'],
  ['how am I doing so far?', 'progress'], ['why do we exponentiate first?', 'help'], ['skip this', 'skip'],
]) {
  await step(`"${text}" -> ${want}`, async () => {
    const r = normalizeRoute(await ask(routeSystem(tracks, current), routePrompt(text)), tracks)
    console.log(`    got ${r.action}${r.env ? ` (${r.env})` : ''}${r.topic ? ` topic="${r.topic}"` : ''}`)
    if (r.action !== want) throw new Error(`routed to ${r.action}`)
  })
}

console.log(`\n${calls} model calls. ${issues.length ? `${issues.length} issue(s):\n- ${issues.join('\n- ')}` : 'No issues.'}`)
process.exitCode = issues.length ? 1 : 0
