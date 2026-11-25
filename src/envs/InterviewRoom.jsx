import { useEffect, useRef, useState } from 'react'
import { ask } from '../lib/llm.js'
import { gradeInterviewPrompt, system } from '../lib/prompts.js'
import { PASS } from '../lib/learner.js'
import { SpeakerIcon } from '../components/Icons.jsx'

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
const VOICE_KEY = 'stepwise.interviewVoice'
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function speak(text, on) {
  if (!on || !window.speechSynthesis) return
  speechSynthesis.cancel()
  speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(text), { rate: 1.02 }))
}

// A follow-up is only asked if it reads as a real question, not a template with [placeholders].
const spoken = (t) => (typeof t === 'string' && t.trim() && !/\[[^\]]*\]|\{[^}]*\}/.test(t) ? t.trim() : '')

// "Hiring manager, Robotics Field Engineering (warehouse fleets)" → "Hiring manager"
const shortRole = (role) => (typeof role === 'string' && role.split(/[,(]/)[0].trim()) || 'Interviewer'

export default function InterviewRoom({ exercise, track, onDone }) {
  const [i, setI] = useState(0)
  const [followup, setFollowup] = useState(false)
  const [probeText, setProbeText] = useState('')
  const [phase, setPhase] = useState('ready')
  const [answer, setAnswer] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState(null)
  const [scores, setScores] = useState([])
  const [history, setHistory] = useState([])
  const [voice, setVoice] = useState(() => localStorage.getItem(VOICE_KEY) !== 'off')
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const rec = useRef(null)
  const base = useRef('')
  const started = useRef(0)

  const done = i >= exercise.questions.length
  const q = exercise.questions[Math.min(i, exercise.questions.length - 1)]
  const asked = followup ? probeText : q.ask
  const target = Math.max(20, Math.min(240, Number(q.seconds) || 90))

  useEffect(() => localStorage.setItem(VOICE_KEY, voice ? 'on' : 'off'), [voice])
  useEffect(() => { if (!done && phase === 'ready') speak(asked, voice) }, [i, followup]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { window.speechSynthesis?.cancel(); rec.current?.abort() }, [])
  useEffect(() => {
    if (phase !== 'answering') return
    const t = setInterval(() => setElapsed((Date.now() - started.current) / 1000), 250)
    return () => clearInterval(t)
  }, [phase])

  function listen() {
    if (!SR) return
    const r = new SR()
    r.continuous = true
    r.interimResults = true
    r.lang = navigator.language || 'en-US'
    base.current = answer ? `${answer.trimEnd()} ` : ''
    r.onresult = (e) => {
      let finals = '', interim = ''
      for (let k = 0; k < e.results.length; k++) (e.results[k].isFinal ? (finals += e.results[k][0].transcript) : (interim += e.results[k][0].transcript))
      setAnswer(base.current + finals + interim)
    }
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setError('The microphone is blocked, so type your answer instead.')
      else if (e.error !== 'no-speech' && e.error !== 'aborted') setError('Speech recognition stopped. Keep going by typing, or press Speak again.')
    }
    r.onend = () => { setListening(false); rec.current = null }
    rec.current = r
    r.start()
    setListening(true)
  }
  const stopListening = () => rec.current?.stop()

  function begin() {
    window.speechSynthesis?.cancel()
    setAnswer('')
    setError('')
    setElapsed(0)
    started.current = Date.now()
    setPhase('answering')
    if (SR) listen()
  }

  async function finish() {
    stopListening()
    const took = Math.round((Date.now() - started.current) / 1000)
    setElapsed(took)
    setPhase('grading')
    try {
      const r = await ask(system(track), gradeInterviewPrompt(asked, q.strong, answer, target, took))
      const score = Math.max(0, Math.min(100, Math.round(Number(r.score) || 0)))
      const res = { ...r, score, took, missing: Array.isArray(r.missing) ? r.missing : [] }
      setResult(res)
      setHistory((h) => [...h, { ask: asked, followup, score }])
      if (!followup) setScores((s) => [...s, score])
      setPhase('graded')
    } catch (e) {
      setError(e.message)
      setPhase('answering')
      started.current = Date.now() - took * 1000
    }
  }

  function next() {
    const probe = !followup && result.score < PASS && (spoken(result.followup) || spoken(q.followup))
    setResult(null)
    setAnswer('')
    setPhase('ready')
    if (probe) { setProbeText(probe); return setFollowup(true) }
    setFollowup(false)
    setI((n) => n + 1)
  }

  if (done) {
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length))
    return (
      <div className="panes center">
        <section className="pane interview">
          <p className="label">Interview over</p>
          <div className="score">{avg}<small> /100 average</small></div>
          <ul className="steps">
            {history.map((h, k) => (
              <li key={k}><b className={h.score >= PASS ? 'good' : 'bad'}>{h.score}</b><div className="grow">{h.followup && <span className="why">Follow-up: </span>}{h.ask}</div></li>
            ))}
          </ul>
          <button className="btn" onClick={() => onDone(avg)}>Record it</button>
        </section>
      </div>
    )
  }

  const over = elapsed > target
  return (
    <div className="panes center">
      <section className="pane interview">
        <div className="iv-top">
          <span className="why">{shortRole(exercise.role)} <span className="iv-n">Question {i + 1} of {exercise.questions.length}</span>{followup && <span className="iv-tag">Follow-up</span>}</span>
          {window.speechSynthesis && (
            <button className="icon-btn" aria-pressed={voice} onClick={() => setVoice(!voice)} aria-label={voice ? 'Stop reading questions aloud' : 'Read questions aloud'} title={voice ? 'Questions are read aloud' : 'Questions are silent'}>
              <SpeakerIcon on={voice} />
            </button>
          )}
        </div>
        <p className="iv-q">{asked}</p>
        {phase === 'ready' && (
          <>
            <div className="row">
              <button className="btn" onClick={begin}>{SR ? 'Start answering' : 'Start the clock'}</button>
              {voice && window.speechSynthesis && <button className="btn ghost" onClick={() => speak(asked, true)}>Replay</button>}
            </div>
            <p className="why iv-hint">Aim for about {mmss(target)}.{SR ? '' : ' Type your answer; this browser can’t take dictation.'}</p>
          </>
        )}

        {phase !== 'ready' && (
          <>
            <div className={`iv-clock${over ? ' over' : ''}`} role="timer" aria-label={`${mmss(elapsed)} of ${mmss(target)}`}>
              <div className="bar"><i style={{ width: `${Math.min(100, (elapsed / target) * 100)}%` }} /></div>
              <span>{mmss(elapsed)} / {mmss(target)}</span>
              {listening && <span className="live">Listening</span>}
            </div>
            <textarea
              style={{ minHeight: 160, maxHeight: '40vh' }}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={phase !== 'answering'}
              placeholder={SR ? 'Your words appear here as you speak. You can edit them.' : 'Type your answer.'}
              aria-label="Your answer"
            />
          </>
        )}
        {phase === 'answering' && (
          <div className="row">
            <button className="btn" onClick={finish} disabled={!answer.trim()}>Done answering</button>
            {SR && (listening ? <button className="btn ghost" onClick={stopListening}>Pause mic</button> : <button className="btn ghost" onClick={listen}>Speak</button>)}
          </div>
        )}
        {phase === 'grading' && <p className="why">Reviewing your answer…</p>}
        {error && <p className="bad" role="alert">{error}</p>}

        {phase === 'graded' && result && (
          <div className="res">
            <div className="score">{result.score}<small> /100</small></div>
            <p><b>{result.verdict}</b> <span className="why">({mmss(result.took)} against a {mmss(target)} target)</span></p>
            {result.weak && <><p className="label">What was weak</p><p>{result.weak}</p></>}
            {result.missing.length > 0 && <><p className="label">What was missing</p><ul>{result.missing.map((m, k) => <li key={k}>{m}</li>)}</ul></>}
            {result.tighter && <><p className="label">A tighter version, in your words</p><blockquote className="primer">{result.tighter}</blockquote></>}
            <button className="btn" onClick={next}>
              {!followup && result.score < PASS && (spoken(result.followup) || spoken(q.followup)) ? 'Take the follow-up' : i + 1 < exercise.questions.length ? 'Next question' : 'Finish'}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
