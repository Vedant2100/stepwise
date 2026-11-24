import { checkCell, resetNotebook, runCell, runCode, runTests } from './runner.js'

// Every exercise that involves code is run for real before the learner sees it, so the ground truth
// (printed output, traced state, passing checks) comes from Python, not from the model.

export async function verifyReadCode(x) {
  const snippets = []
  for (const s of x.snippets) {
    const r = await runCode(s.code)
    if (!r.error && r.stdout.trim()) snippets.push({ ...s, output: r.stdout })
  }
  if (snippets.length < 2) throw new Error('Too few of the generated snippets ran cleanly. Try again.')
  let debug = null
  const d = x.debug
  if (d && typeof d.buggy === 'string' && typeof d.reference === 'string' && Array.isArray(d.tests) && d.tests.length) {
    const fixed = await runTests(d.reference, d.tests)
    const tests = fixed.setup ? [] : d.tests.filter((_, i) => fixed.tests[i].ok)
    const buggy = tests.length ? await runTests(d.buggy, tests) : null
    if (buggy && !buggy.setup && buggy.tests.some((t) => !t.ok)) debug = { ...d, tests }
  }
  return { snippets, debug }
}

export async function verifyTrace(x) {
  const r = await runCode(x.code)
  if (r.error) throw new Error('The generated algorithm did not run. Try again.')
  if (r.trace.length < 2) throw new Error('The generated algorithm recorded too few steps. Try again.')
  return { ...x, steps: r.trace.slice(0, 30), output: r.stdout }
}

export async function verifyNotebook(x) {
  const nb = `verify-${crypto.randomUUID()}`
  try {
    const setup = await runCell(nb, x.setup)
    if (setup.error) throw new Error('The notebook’s setup code failed. Try again.')
    const tasks = []
    for (const t of x.tasks) {
      const sol = await runCell(nb, t.solution)
      if (sol.error) continue
      const check = await checkCell(nb, t.check)
      if (!check.error) tasks.push(t)
    }
    if (!tasks.length) throw new Error('None of the notebook’s checks passed on its own solution. Try again.')
    return { ...x, tasks, dropped: x.tasks.length - tasks.length }
  } finally {
    await resetNotebook(nb)
  }
}
