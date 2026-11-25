import { useMemo, useState } from 'react'
import Md from '../components/Md.jsx'
import { simPage } from '../lib/simframe.js'

const isDark = () => {
  const t = document.documentElement.dataset.theme
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
}

export default function SimWorkspace({ exercise, onDone }) {
  const page = useMemo(() => simPage(exercise, isDark()), [exercise])
  const [k, setK] = useState(0)
  const [guess, setGuess] = useState('')
  const [shown, setShown] = useState(false)
  const [marks, setMarks] = useState([])
  const qs = exercise.questions
  const finished = k === qs.length
  const right = marks.filter(Boolean).length

  function mark(correct) {
    setMarks([...marks, correct])
    setK(k + 1)
    setGuess('')
    setShown(false)
  }

  return (
    <div className="panes two">
      <section className="pane">
        <p className="label">Explore</p>
        <Md>{exercise.intro}</Md>
        {exercise.chart && <p className="why">Bars show: {exercise.chart}</p>}
        <iframe className="grow sim" title="Simulation" sandbox="allow-scripts" srcDoc={page} />
      </section>
      <section className="pane">
        <p className="label">Predict, then check ({Math.min(k + 1, qs.length)} of {qs.length})</p>
        {finished ? (
          <div className="res" style={{ marginTop: 0 }}>
            <div className="score">{right}/{qs.length}</div>
            <button className="btn" onClick={() => onDone(Math.round((right / qs.length) * 100))}>Record it</button>
          </div>
        ) : (
          <>
            <Md>{qs[k].ask}</Md>
            <textarea rows={3} value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Your prediction, before you move the slider" disabled={shown} aria-label="Your prediction" />
            {!shown ? (
              <div className="row" style={{ margin: 0 }}>
                <button className="btn" onClick={() => setShown(true)} disabled={!guess.trim()}>Check</button>
                <span className="why">Try it on the sliders, then check.</span>
              </div>
            ) : (
              <>
                <div className="nudge"><Md>{qs[k].answer}</Md></div>
                <div className="row" style={{ margin: 0 }}>
                  <button className="btn" onClick={() => mark(true)}>I predicted that</button>
                  <button className="btn ghost" onClick={() => mark(false)}>I didn’t</button>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  )
}
