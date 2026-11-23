// Runs Python tests in a Pyodide web worker. A run that takes too long (an infinite loop)
// kills the worker; the next run starts a fresh one.
let worker = null
let warm = false
let seq = 0

export function runTests(code, tests) {
  worker ??= new Worker(new URL('./runner.worker.js', import.meta.url), { type: 'module' })
  const w = worker
  const id = ++seq
  const limit = warm ? 15_000 : 90_000
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      w.terminate()
      if (worker === w) worker = null
      warm = false
      reject(new Error(`Stopped after ${limit / 1000}s. Infinite loop or very slow code? The runner restarted.`))
    }, limit)
    const onMessage = ({ data }) => {
      if (data.id !== id) return
      clearTimeout(timer)
      w.removeEventListener('message', onMessage)
      if (data.error) return reject(new Error(data.error))
      warm = true
      resolve(data.result)
    }
    w.addEventListener('message', onMessage)
    w.postMessage({ id, code, tests: tests.map(({ name, code }) => ({ name, code })) })
  })
}

// Runs the tests against the hidden reference solution and keeps only the ones it passes.
export async function verifyCode(exercise) {
  const result = await runTests(exercise.reference, exercise.tests)
  if (result.setup) throw new Error('The reference solution does not run, so the tests could not be checked.')
  const tests = exercise.tests.filter((_, i) => result.tests[i].ok)
  if (tests.length < 2) throw new Error('Too few tests agreed with the reference solution.')
  return { ...exercise, tests, dropped: exercise.tests.length - tests.length }
}
