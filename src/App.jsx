import { useEffect, useRef, useState } from 'react'
import Composer from './components/Composer.jsx'
import FeedItem, { Avatar } from './components/FeedItem.jsx'
import Sidebar from './components/Sidebar.jsx'
import Workspace from './components/Workspace.jsx'
import { makeExercise } from './lib/exercise.js'
import { isMastered, recordAttempt } from './lib/learner.js'
import { ask, stopAll } from './lib/llm.js'
import { validatePlan } from './lib/plan.js'
import { ENVIRONMENTS, envFor, nextReviewAt, nextStep } from './lib/planner.js'
import { planPrompt, system } from './lib/prompts.js'
import { normalizeRoute, routePrompt } from './lib/router.js'
import { load, save } from './lib/storage.js'

const SOURCE_MAX = 15_000
const PASTE_AS_SOURCE = 800
let seq = 0
const item = (kind, props) => ({ id: ++seq, kind, ...props })
const fmtDate = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

function greeting(tracks, now) {
  if (!tracks.length) {
    return 'What do you want to be able to do?'
  }
  const due = tracks.flatMap((t) => t.concepts).filter((c) => c.review && c.review.due <= now).length
  return `Welcome back. ${tracks.length} objective${tracks.length > 1 ? 's' : ''}${due ? `, ${due} review${due > 1 ? 's' : ''} due` : ''}. Press Next to keep climbing, or tell me something new to learn.`
}

export default function App() {
  const [data, setData] = useState(load)
  const [feed, setFeed] = useState(() => [item('t', { text: greeting(data.tracks, Date.now()) })])
  const [busy, setBusy] = useState('')
  const [source, setSource] = useState(null)
  const [activeId, setActiveId] = useState(data.tracks[0]?.id ?? null)
  const [openWs, setOpenWs] = useState(null)
  const [sideOpen, setSideOpen] = useState(false)
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  const [theme, setTheme] = useState(() => localStorage.getItem('stepwise.theme') ?? '')
  const dark = theme ? theme === 'dark' : systemDark
  const dataRef = useRef(data)
  const end = useRef(null)

  useEffect(() => {
    dataRef.current = data
    save(data)
  }, [data])
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme
    else delete document.documentElement.dataset.theme
    localStorage.setItem('stepwise.theme', theme)
  }, [theme])
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [feed.length, busy])

  const push = (...items) => setFeed((f) => [...f, ...items])
  const say = (text, extra) => push(item('t', { text, ...extra }))
  const patch = (id, changes) => setFeed((f) => f.map((x) => (x.id === id ? { ...x, ...changes } : x)))
  const setTracks = (fn) => setData((d) => ({ tracks: fn(d.tracks) }))
  const openExercise = () => [...feed].reverse().find((x) => x.kind === 'exercise' && !x.done)

  async function run(label, fn) {
    setBusy(label)
    try {
      await fn()
    } catch (e) {
      if (e.status === 401) push(item('access'))
      else say(e.message, { err: !e.stopped })
    }
    setBusy('')
  }

  async function learn(objective, src) {
    const text = (src?.text ?? '').slice(0, SOURCE_MAX)
    await run('Planning', async () => {
      const plan = validatePlan(await ask(system({ source: text }), planPrompt(objective, text)), text)
      const track = { id: crypto.randomUUID(), objective, source: text, ...plan, log: [], createdAt: Date.now() }
      setTracks((ts) => [track, ...ts])
      dataRef.current = { tracks: [track, ...dataRef.current.tracks] }
      setActiveId(track.id)
      setSource(null)
      push(item('plan', { trackId: track.id }))
      await start(track, nextStep(track.concepts, Date.now()))
    })
  }

  // Due reviews anywhere come first, then the focused objective, then any other.
  function pickNext(focusId) {
    const now = Date.now()
    const tracks = dataRef.current.tracks
    const focused = tracks.find((t) => t.id === focusId)
    const order = focused ? [focused, ...tracks.filter((t) => t !== focused)] : tracks
    for (const t of order) {
      const s = nextStep(t.concepts, now)
      if (s?.mode === 'review') return { track: t, step: s }
    }
    for (const t of order) {
      const s = nextStep(t.concepts, now)
      if (s) return { track: t, step: s }
    }
    return null
  }

  async function start(track, step, env = envFor(step.concept.type)) {
    setBusy(`Building ${ENVIRONMENTS[env].label.toLowerCase()} for “${step.concept.name}”`)
    const exercise = await makeExercise(env, step.concept, track, step.mode)
    const it = item('exercise', { trackId: track.id, conceptId: step.concept.id, mode: step.mode, env, exercise, started: Date.now() })
    push(it)
    setOpenWs(it.id)
  }

  async function next(focusId = activeId) {
    const open = openExercise()
    if (open) patch(open.id, { done: 'skipped' })
    const pick = pickNext(focusId)
    if (!pick) {
      const all = dataRef.current.tracks.flatMap((t) => t.concepts)
      const when = nextReviewAt(all)
      return say(all.length ? `Everything is mastered. Next review: ${fmtDate(when)}. Give me something new to learn.` : 'Give me something to learn first.')
    }
    setActiveId(pick.track.id)
    await run('Thinking', () => start(pick.track, pick.step))
  }

  async function switchEnv(env) {
    const open = openExercise()
    if (!open) return say('There’s no exercise open to switch.')
    const track = dataRef.current.tracks.find((t) => t.id === open.trackId)
    const concept = track.concepts.find((c) => c.id === open.conceptId)
    patch(open.id, { done: 'switched' })
    await run('Thinking', () => start(track, { concept, mode: open.mode }, env))
  }

  function finish(it, score) {
    const now = Date.now()
    const track = dataRef.current.tracks.find((t) => t.id === it.trackId)
    const before = track.concepts.find((c) => c.id === it.conceptId)
    const after = recordAttempt(before, score, now)
    const updated = {
      ...track,
      concepts: track.concepts.map((c) => (c.id === after.id ? after : c)),
      log: [...track.log, { conceptId: it.conceptId, env: it.env, defaultEnv: envFor(before.type), mode: it.mode, score, at: now, ms: now - it.started }],
    }
    setTracks((ts) => ts.map((t) => (t.id === track.id ? updated : t)))
    dataRef.current = { tracks: dataRef.current.tracks.map((t) => (t.id === track.id ? updated : t)) }
    patch(it.id, { done: 'finished', score })
    setOpenWs(null)
    const unlocked = updated.concepts.filter((c) => !isMastered(c) && c.prereqs.includes(after.id) && c.prereqs.every((p) => isMastered(updated.concepts.find((x) => x.id === p))))
    say(
      `**${score}/100** on ${before.name}. Mastery went from ${Math.round(before.pL * 100)}% to ${Math.round(after.pL * 100)}%.` +
        (isMastered(after) && !isMastered(before) ? ` Mastered; first review ${fmtDate(after.review.due)}.` : '') +
        (unlocked.length ? ` Unlocked: ${unlocked.map((c) => c.name).join(', ')}.` : ''),
      { next: true },
    )
  }

  function remove(trackId) {
    setTracks((ts) => ts.filter((t) => t.id !== trackId))
    dataRef.current = { tracks: dataRef.current.tracks.filter((t) => t.id !== trackId) }
    setFeed((f) => f.map((x) => (x.trackId === trackId && x.kind === 'exercise' && !x.done ? { ...x, done: 'skipped' } : x)))
    say('Deleted.')
  }

  async function send(text) {
    push(item('me', { text: text.length > 400 ? `${text.slice(0, 400)}… (${text.length.toLocaleString()} characters)` : text }))
    if (!source && text.length > PASTE_AS_SOURCE) {
      setSource({ name: 'Pasted text', text: text.slice(0, SOURCE_MAX) })
      return say('Got it, I’ll treat that as source material and teach only what it supports. What do you want to be able to do with it?')
    }
    if (source || !dataRef.current.tracks.length) return learn(text, source)

    let r
    setBusy('Thinking')
    try {
      const open = openExercise()
      const current = open && { ...open, concept: dataRef.current.tracks.find((t) => t.id === open.trackId).concepts.find((c) => c.id === open.conceptId) }
      r = normalizeRoute(await ask(system(), routePrompt(text, dataRef.current.tracks, current)), dataRef.current.tracks)
    } catch (e) {
      setBusy('')
      return e.status === 401 ? push(item('access')) : say(e.message, { err: !e.stopped })
    }
    setBusy('')
    if (r.say) say(r.say)
    if (r.action === 'learn') return learn(r.topic || text, null)
    if (r.action === 'next' || r.action === 'skip') return next()
    if (r.action === 'focus') return next(r.trackId ?? activeId)
    if (r.action === 'switch' && r.env) return switchEnv(r.env)
    if (r.action === 'progress') return push(item('progress'))
    if (r.action === 'delete' && r.trackId) return push(item('confirmDelete', { trackId: r.trackId }))
  }

  async function practice(track, concept) {
    setSideOpen(false)
    setActiveId(track.id)
    const open = openExercise()
    if (open) patch(open.id, { done: 'skipped' })
    await run('Thinking', () => start(track, { concept, mode: isMastered(concept) ? 'review' : 'learn' }))
  }

  function newObjective() {
    setSideOpen(false)
    setActiveId(null)
    if (feed.length > 1) say('What do you want to be able to do next? Paste or attach notes if you want me to teach only from them.')
  }

  const actions = { next, switchEnv, finish, remove, setTracks, push, say, openWorkspace: setOpenWs }
  const active = data.tracks.find((t) => t.id === activeId)
  const hero = feed.length === 1 && !busy && !data.tracks.length

  const composer = (
    <Composer
      busy={Boolean(busy)}
      source={source}
      setSource={setSource}
      onSend={send}
      hasOpen={Boolean(openExercise())}
      hasTracks={data.tracks.length > 0}
      onNext={() => next()}
      onProgress={() => push(item('progress'))}
      sourceMax={SOURCE_MAX}
      centered={hero}
    />
  )

  return (
    <div className="app">
      <Sidebar
        tracks={data.tracks}
        activeId={activeId}
        setActiveId={(id) => { setActiveId(id); setSideOpen(false) }}
        open={sideOpen}
        onClose={() => setSideOpen(false)}
        onNew={newObjective}
        onPick={practice}
        onSettings={() => { setSideOpen(false); push(item('settings')) }}
        dark={dark}
        toggleTheme={() => setTheme(dark ? 'light' : 'dark')}
      />
      <div className="main">
        {hero ? (
          <>
            <div className="hero">
              <button className="btn ghost sm menu" onClick={() => setSideOpen(true)}>Menu</button>
              <h1>What do you want to be able to do?</h1>
              <p>Name a goal. Stepwise breaks it into concepts, picks the right kind of practice for each one, and keeps track of what you’ve mastered. Paste or attach notes and it teaches only from them.</p>
            </div>
            {composer}
          </>
        ) : (
          <>
            <header className="main-head">
              <button className="btn ghost sm menu" onClick={() => setSideOpen(true)}>Menu</button>
              <div>
                <h1>{active ? active.title : 'Stepwise'}</h1>
                {active && <p>{active.objective}</p>}
              </div>
            </header>
            <div className="wrap">
              <main className="feed" aria-live="polite">
                {feed.map((it) => (
                  <FeedItem key={it.id} it={it} data={data} setData={setData} actions={actions} busy={Boolean(busy)} openWs={openWs} />
                ))}
                {busy && (
                  <div className="msg t">
                    <Avatar />
                    <div className="body row" style={{ margin: 0 }}>
                      <span className="dots">{busy}</span>
                      <button className="btn ghost sm" onClick={stopAll}>Stop</button>
                    </div>
                  </div>
                )}
                <div ref={end} />
              </main>
            </div>
            {composer}
          </>
        )}
      </div>
      {feed.filter((x) => x.kind === 'exercise' && !x.done).map((x) => (
        <Workspace
          key={x.id}
          it={x}
          track={data.tracks.find((t) => t.id === x.trackId)}
          open={openWs === x.id}
          busy={Boolean(busy)}
          onClose={() => setOpenWs(null)}
          onSwitch={switchEnv}
          onDone={(score) => finish(x, score)}
        />
      ))}
    </div>
  )
}
