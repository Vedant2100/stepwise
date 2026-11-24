import { useEffect, useRef, useState } from 'react'
import Md from '../components/Md.jsx'
import { checkCell, resetNotebook, runCell } from '../lib/runner.js'
import CodeView from './CodeView.jsx'

let cellSeq = 0
const newCell = (code = '') => ({ id: ++cellSeq, code, out: null, busy: false })

function Output({ out }) {
  if (!out) return null
  return (
    <div className="cellout">
      {out.stdout && <pre>{out.stdout}</pre>}
      {out.value && <pre className="value">{out.value}</pre>}
      {out.error && <pre className="bad">{out.error}</pre>}
      {out.images?.map((b64, i) => <img key={i} src={`data:image/png;base64,${b64}`} alt="Plot output" />)}
    </div>
  )
}

// Cells share one Python namespace. Tasks are checked by hidden asserts that read your variables.
// Revealing a task's solution halves its credit.
export default function NotebookWorkspace({ exercise, onDone }) {
  const nb = useRef(`nb-${crypto.randomUUID()}`).current
  const [setupOut, setSetupOut] = useState(null)
  const [cells, setCells] = useState(() => [newCell('# Your code here. Shift+Enter runs a cell.\n')])
  const [status, setStatus] = useState({})
  const [revealed, setRevealed] = useState({})
  const [checking, setChecking] = useState(false)
  const tasks = exercise.tasks

  useEffect(() => {
    runCell(nb, exercise.setup).then(setSetupOut, (e) => setSetupOut({ error: e.message }))
    return () => { resetNotebook(nb).catch(() => {}) }
  }, [nb, exercise.setup])

  const patch = (id, changes) => setCells((cs) => cs.map((c) => (c.id === id ? { ...c, ...changes } : c)))

  async function run(cell) {
    patch(cell.id, { busy: true })
    try {
      patch(cell.id, { out: await runCell(nb, cell.code), busy: false })
    } catch (e) {
      patch(cell.id, { out: { error: e.message }, busy: false })
    }
  }

  async function checkAll() {
    setChecking(true)
    const next = {}
    for (const [i, t] of tasks.entries()) {
      try {
        const r = await checkCell(nb, t.check)
        next[i] = r.error ? { ok: false, err: r.error } : { ok: true }
      } catch (e) {
        next[i] = { ok: false, err: e.message }
      }
    }
    setStatus(next)
    setChecking(false)
  }

  const credit = tasks.reduce((s, _, i) => s + (status[i]?.ok ? (revealed[i] ? 0.5 : 1) : 0), 0)
  const score = Math.round((credit / tasks.length) * 100)

  return (
    <div className="panes two" style={{ gridTemplateColumns: 'minmax(260px, 0.8fr) minmax(0, 1.6fr)' }}>
      <section className="pane">
        <Md>{exercise.intro}</Md>
        <p className="label">Tasks</p>
        <ol className="steps">
          {tasks.map((t, i) => (
            <li key={i}>
              <b className={status[i] ? (status[i].ok ? 'good' : 'bad') : ''}>{status[i] ? (status[i].ok ? '✓' : '✗') : i + 1}</b>
              <div className="grow">
                <Md>{t.ask}</Md>
                {status[i] && !status[i].ok && <pre className="bad">{status[i].err}</pre>}
                {revealed[i] ? <CodeView value={t.solution} /> : (
                  <button className="btn ghost sm" onClick={() => setRevealed({ ...revealed, [i]: true })}>Show solution (half credit)</button>
                )}
              </div>
            </li>
          ))}
        </ol>
        <div className="row" style={{ margin: 0 }}>
          <button className="btn" onClick={checkAll} disabled={checking || !setupOut}>{checking ? 'Checking…' : 'Check my work'}</button>
          {Object.keys(status).length > 0 && <button className="btn ghost" onClick={() => onDone(score)}>Record {score}/100</button>}
        </div>
        {exercise.dropped > 0 && <p className="why">{exercise.dropped} task(s) whose checks didn’t pass on their own solution were removed.</p>}
      </section>

      <section className="pane">
        <div className="cell setup">
          <p className="label">Setup (already run)</p>
          <CodeView value={exercise.setup} />
          {setupOut ? <Output out={setupOut} /> : <p className="why dots">Starting Python and loading the data libraries. The first time can take a minute</p>}
        </div>
        {cells.map((c, i) => (
          <div key={c.id} className="cell">
            <div className="row" style={{ margin: 0 }}>
              <span className="label" style={{ margin: 0 }}>Cell {i + 1}</span>
              <button className="btn sm" onClick={() => run(c)} disabled={c.busy || !setupOut}>{c.busy ? 'Running…' : 'Run'}</button>
              <span className="kbd">Shift + Enter</span>
              {cells.length > 1 && <button className="btn ghost sm" onClick={() => setCells(cells.filter((x) => x.id !== c.id))}>Delete cell</button>}
            </div>
            <CodeView value={c.code} onChange={(code) => patch(c.id, { code })} onRun={() => setupOut && run(c)} />
            <Output out={c.out} />
          </div>
        ))}
        <button className="btn ghost sm" style={{ alignSelf: 'start' }} onClick={() => setCells([...cells, newCell()])}>Add a cell</button>
      </section>
    </div>
  )
}
