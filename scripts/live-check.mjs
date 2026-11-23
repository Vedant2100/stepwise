// Runs real objectives through the deployed /api/llm with the app's own prompts and validators.
// Usage: URL=https://... CODE=... node scripts/live-check.mjs
import { readFileSync } from 'node:fs'
import { loadPyodide } from 'pyodide'
import { parseJSON } from '../src/lib/llm.js'
import { validatePlan } from '../src/lib/plan.js'
import { envFor } from '../src/lib/planner.js'
import { VALID } from '../src/lib/exercise.js'
import { checkStepPrompt, exercisePrompt, gradeExplainPrompt, planPrompt, system } from '../src/lib/prompts.js'
import { normalizeRoute, routePrompt } from '../src/lib/router.js'

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
      const right = await step('check a correct first step', () => ask(system(track), checkStepPrompt(ex, 0, [], ex.steps[0].expected)))
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

console.log('\n## Chat router')
const tracks = [{ id: 't1', title: 'Attention', objective: 'Understand attention' }]
const current = { concept: { name: 'Softmax by hand' }, env: 'steps', exercise: { problem: 'softmax([0,0])' } }
for (const [text, want] of [
  ['next one please', 'next'], ['teach me how DPO works', 'learn'], ['can I do this one in code instead?', 'switch'],
  ['how am I doing so far?', 'progress'], ['why do we exponentiate first?', 'help'], ['skip this', 'skip'],
]) {
  await step(`"${text}" -> ${want}`, async () => {
    const r = normalizeRoute(await ask(system(), routePrompt(text, tracks, current)), tracks)
    console.log(`    got ${r.action}${r.env ? ` (${r.env})` : ''}${r.topic ? ` topic="${r.topic}"` : ''}`)
    if (r.action !== want) throw new Error(`routed to ${r.action}`)
  })
}

console.log(`\n${calls} model calls. ${issues.length ? `${issues.length} issue(s):\n- ${issues.join('\n- ')}` : 'No issues.'}`)
process.exitCode = issues.length ? 1 : 0
