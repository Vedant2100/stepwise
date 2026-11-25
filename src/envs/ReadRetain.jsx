import { useState } from 'react'
import Md from '../components/Md.jsx'

const RATINGS = [['Missed it', 0], ['Partly', 0.5], ['Got it', 1]]
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

function Rate({ onRate }) {
  return (
    <div className="row">
      <span className="why">How close were you?</span>
      {RATINGS.map(([label, v]) => <button key={label} className={`btn sm${v === 1 ? '' : ' ghost'}`} onClick={() => onRate(v)}>{label}</button>)}
    </div>
  )
}

export default function ReadRetain({ exercise, onDone }) {
  const chunks = exercise.chunks
  const [phase, setPhase] = useState('read')
  const [i, setI] = useState(0)
  const [answer, setAnswer] = useState('')
  const [shown, setShown] = useState(false)
  const [read, setRead] = useState([])
  const [recall, setRecall] = useState([])
  const [connect, setConnect] = useState('')
  const c = chunks[i]
  const score = Math.round(100 * (0.4 * avg(read) + 0.6 * avg(recall)))

  function rate(v) {
    const last = i === chunks.length - 1
    if (phase === 'read') setRead((r) => [...r, v])
    else setRecall((r) => [...r, v])
    setAnswer('')
    setShown(false)
    if (!last) return setI(i + 1)
    setI(0)
    setPhase(phase === 'read' ? 'recall' : exercise.connect ? 'connect' : 'done')
  }

  const steps = [['read', 'Read'], ['recall', 'Recall'], ['connect', 'Connect']]
  return (
    <div className="panes center">
      <section className="pane retain">
        <ol className="retain-steps">
          {steps.map(([k, label]) => <li key={k} className={k === phase ? 'on' : ''}>{label}</li>)}
        </ol>

        {phase === 'read' && (
          <>
            <p className="label">Part {i + 1} of {chunks.length}: read it, then put it in your own words</p>
            <blockquote className="retain-excerpt"><Md>{c.excerpt}</Md></blockquote>
            <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={shown} placeholder="The takeaway, in one sentence of your own" aria-label="Your takeaway" style={{ minHeight: 90 }} />
            {!shown ? (
              <div className="row"><button className="btn" disabled={answer.trim().split(/\s+/).length < 3} onClick={() => setShown(true)}>Compare</button></div>
            ) : (
              <>
                <div className="res"><p className="label" style={{ marginTop: 0 }}>The key point</p><Md>{c.key}</Md></div>
                <Rate onRate={rate} />
              </>
            )}
          </>
        )}

        {phase === 'recall' && (
          <>
            <p className="label">From memory, {i + 1} of {chunks.length}</p>
            <p className="retain-cue">{c.cue}</p>
            <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={shown} placeholder="Answer without looking back" aria-label="Your answer" style={{ minHeight: 90 }} />
            {!shown ? (
              <div className="row"><button className="btn" disabled={!answer.trim()} onClick={() => setShown(true)}>Check</button></div>
            ) : (
              <>
                <div className="res"><p className="label" style={{ marginTop: 0 }}>What it said</p><Md>{c.key}</Md><details><summary>The passage</summary><Md>{c.excerpt}</Md></details></div>
                <Rate onRate={rate} />
              </>
            )}
          </>
        )}

        {phase === 'connect' && (
          <>
            <p className="label">Connect it</p>
            <p className="retain-cue">{exercise.connect}</p>
            <textarea value={connect} onChange={(e) => setConnect(e.target.value)} placeholder="Linking ideas is what makes them stick. A few sentences is plenty." aria-label="Your connection" style={{ minHeight: 110 }} />
            <div className="row"><button className="btn" onClick={() => setPhase('done')}>{connect.trim() ? 'Done' : 'Skip'}</button></div>
          </>
        )}

        {phase === 'done' && (
          <div className="res">
            <div className="score">{score}<small> /100</small></div>
            <p className="why">Recall counts more than reading: {Math.round(avg(recall) * 100)}% recalled, {Math.round(avg(read) * 100)}% understood on first read.</p>
            <button className="btn" onClick={() => onDone(score)}>Record it</button>
          </div>
        )}
      </section>
    </div>
  )
}
