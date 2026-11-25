import { useCallback, useEffect, useRef, useState } from 'react'
import Composer from './components/Composer.jsx'
import FeedItem, { Avatar } from './components/FeedItem.jsx'
import Sidebar from './components/Sidebar.jsx'
import { PanelIcon } from './components/Icons.jsx'
import Workspace from './components/Workspace.jsx'
import AccountScreen from './components/AccountScreen.jsx'
import SettingsScreen from './components/Settings.jsx'
import ShareDialog from './components/ShareDialog.jsx'
import { PENDING_KEY, copyClimb } from './lib/share.js'
import { makeExercise } from './lib/exercise.js'
import { PASS, STUCK, isMastered, recordAttempt } from './lib/learner.js'
import { ask, stopAll } from './lib/llm.js'
import { validatePlan } from './lib/plan.js'
import { ENVIRONMENTS, envFor, nextReviewAt, nextStep } from './lib/planner.js'
import { planPrompt, readPastePrompt, system } from './lib/prompts.js'
import { normalizeRoute, routePrompt } from './lib/router.js'
import { load, save } from './lib/storage.js'
import useAccount from './lib/useAccount.js'

const SOURCE_MAX = 15_000
const PASTE_AS_SOURCE = 800
let seq = 0
const item = (kind, props) => ({ id: ++seq, kind, ...props })
const listJoin = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)
const fmtDate = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

function greeting(tracks, now) {
  if (!tracks.length) return { text: 'What do you want to be able to do?' }
  const due = tracks.flatMap((t) => t.concepts).filter((c) => c.review && c.review.due <= now).length
  if (due) {
    return {
      text: `Welcome back. ${due === 1 ? '1 thing you mastered is' : `${due} things you mastered are`} starting to fade. About ${due * 2} minutes of review keeps ${due === 1 ? 'it' : 'them'}.`,
      next: true,
      nextLabel: 'Review now',
    }
  }
  return { text: `Welcome back. ${tracks.length} objective${tracks.length > 1 ? 's' : ''}. Press Next to keep climbing, or tell me something new to learn.` }
}

export default function App() {
  const [data, setData] = useState(load)
  const [feed, setFeed] = useState(() => [item('t', greeting(data.tracks, Date.now()))])
  const [busy, setBusy] = useState('')
  const [source, setSource] = useState(null)
  const pending = useRef(null)
  const [activeId, setActiveId] = useState(data.tracks[0]?.id ?? null)
  const [openWs, setOpenWs] = useState(null)
  const [sideOpen, setSideOpen] = useState(false)
  const [closing, setClosing] = useState(null)
  const retire = (id) => {
    setClosing(id)
    setTimeout(() => setClosing((c) => (c === id ? null : c)), 400)
  }
  const [sideHidden, setSideHidden] = useState(() => localStorage.getItem('stepwise.sideHidden') === '1')
  useEffect(() => localStorage.setItem('stepwise.sideHidden', sideHidden ? '1' : '0'), [sideHidden])
  const narrow = () => matchMedia('(max-width: 900px)').matches
  const showSide = () => (narrow() ? setSideOpen(true) : setSideHidden(false))
  const hideSide = () => (narrow() ? setSideOpen(false) : setSideHidden(true))
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  const [theme, setTheme] = useState(() => localStorage.getItem('stepwise.theme') ?? '')
  const [look, setLook] = useState(() => localStorage.getItem('stepwise.look') ?? 'solid')
  useEffect(() => {
    document.documentElement.dataset.look = look
    localStorage.setItem('stepwise.look', look)
  }, [look])
  const dark = theme ? theme === 'dark' : systemDark
  const dataRef = useRef(data)
  const end = useRef(null)
  const account = useAccount(data, dataRef, setData)
  const [authOpen, setAuthOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  const closeAuth = useCallback(() => setAuthOpen(false), [])
  const [sharing, setSharing] = useState(null)
  const closeShare = useCallback(() => setSharing(null), [])

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
  function changeTracks(fn) {
    const before = dataRef.current
    const now = Date.now()
    const prev = new Map(before.tracks.map((t) => [t.id, t]))
    const after = fn(before.tracks).map((t) => (prev.get(t.id) === t ? t : { ...t, updatedAt: now }))
    const kept = new Set(after.map((t) => t.id))
    const removed = before.tracks.filter((t) => !kept.has(t.id)).map((t) => ({ id: t.id, at: now }))
    const next = { ...before, tracks: after, deleted: [...before.deleted, ...removed].slice(-500) }
    dataRef.current = next
    setData(next)
  }
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

  async function learn(objective, src, context = '') {
    const text = (src?.text ?? '').slice(0, SOURCE_MAX)
    await run('Planning', async () => {
      objective = objective.replace(/\s+/g, ' ').trim()
      const plan = validatePlan(await ask(system({ source: text }), planPrompt(objective, text, context), { variant: 0 }), text)
      const track = { id: crypto.randomUUID(), objective, source: text, ...(context && { context }), ...plan, log: [], createdAt: Date.now() }
      changeTracks((ts) => [track, ...ts])
      setActiveId(track.id)
      setSource(null)
      push(item('plan', { trackId: track.id }))
      await start(track, nextStep(track.concepts, Date.now()))
    })
  }

  useEffect(() => {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return
    localStorage.removeItem(PENDING_KEY)
    let snap
    try { snap = JSON.parse(raw) } catch { return }
    const have = dataRef.current.tracks.find((t) => t.objective === snap.objective && t.title === snap.title)
    if (have) {
      setActiveId(have.id)
      return say(`You already have **${have.title}**. Press Next to keep climbing.`, { next: true })
    }
    const track = copyClimb(snap)
    run('Thinking', async () => {
      changeTracks((ts) => [track, ...ts])
      setActiveId(track.id)
      push(item('plan', { trackId: track.id }))
      await start(track, nextStep(track.concepts, Date.now()))
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (open) { retire(open.id); patch(open.id, { done: 'skipped' }) }
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
    retire(open.id)
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
    changeTracks((ts) => ts.map((t) => (t.id === track.id ? updated : t)))
    retire(it.id)
    patch(it.id, { done: 'finished', score })
    setOpenWs(null)
    const unlocked = updated.concepts.filter((c) => !isMastered(c) && c.prereqs.includes(after.id) && c.prereqs.every((p) => isMastered(updated.concepts.find((x) => x.id === p))))
    const mastered = isMastered(after) && !isMastered(before)
    say(
      `**${score}/100** on ${before.name}.` +
        (mastered ? ` First review ${fmtDate(after.review.due)}, so it sticks.` : '') +
        (score < PASS && after.misses < STUCK ? ' Next, another go at it with a different exercise.' : '') +
        (after.misses >= STUCK ? ' Three misses in a row, so we’ll move on and come back to this one later.' : ''),
      {
        next: true,
        gain: { from: Math.round(before.pL * 100), to: Math.round(after.pL * 100) },
        badges: [...(mastered ? [{ kind: 'mastered', text: `Mastered ${before.name}` }] : []), ...unlocked.map((c) => ({ kind: 'unlocked', text: `Unlocked ${c.name}` }))],
      },
    )
  }

  function remove(trackId) {
    changeTracks((ts) => ts.filter((t) => t.id !== trackId))
    setFeed((f) => f.map((x) => (x.trackId === trackId && x.kind === 'exercise' && !x.done ? { ...x, done: 'skipped' } : x)))
    say('Deleted.')
  }

  async function send(text) {
    push(item('me', { text: text.length > 400 ? `${text.slice(0, 400)}… (${text.length.toLocaleString()} characters)` : text }))
    const waiting = pending.current
    if (waiting) {
      pending.current = null
      const skip = /^\s*(go|skip|plan|continue|without|no)\b/i.test(text) && !source
      const more = [source?.text, skip ? '' : text].filter(Boolean).join('\n\n')
      return learn(waiting.objective, null, [waiting.context, more].filter(Boolean).join('\n\n').slice(0, SOURCE_MAX))
    }
    if (!source && text.length > PASTE_AS_SOURCE) {
      let read
      setBusy('Reading')
      try {
        read = await ask(system(), readPastePrompt(text))
      } catch (e) {
        setBusy('')
        return e.status === 401 ? push(item('access')) : say(e.message, { err: !e.stopped })
      }
      setBusy('')
      if (read.kind !== 'request' || !read.objective) {
        setSource({ name: 'Pasted text', text: text.slice(0, SOURCE_MAX) })
        return say('Got it, I’ll treat that as source material and teach only what it supports. What do you want to be able to do with it?')
      }
      const missing = (Array.isArray(read.missing) ? read.missing : []).filter((m) => typeof m === 'string' && m.trim()).slice(0, 5)
      if (missing.length) {
        pending.current = { objective: read.objective, context: text }
        return say(`Goal: **${read.objective}**\n\nYour message mentions ${listJoin(missing)}, but ${missing.length > 1 ? 'they aren’t' : 'it isn’t'} here. Paste or attach ${missing.length > 1 ? 'them' : 'it'} so the plan fits you, or say “go” to plan without.`)
      }
      return learn(read.objective, null, text)
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
    if (open) { retire(open.id); patch(open.id, { done: 'skipped' }) }
    await run('Thinking', () => start(track, { concept, mode: isMastered(concept) ? 'review' : 'learn' }))
  }

  function newObjective() {
    setSideOpen(false)
    setActiveId(null)
    if (feed.length > 1) say('What do you want to be able to do next? Paste or attach notes if you want me to teach only from them.')
  }

  const actions = { next, switchEnv, finish, remove, changeTracks, push, say, openWorkspace: setOpenWs, account, signIn: () => setAuthOpen(true), openSettings: (focus) => setSettingsOpen(focus) }
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
    <div className={`app${sideHidden ? ' side-hidden' : ''}`}>
      {settingsOpen && (
        <SettingsScreen
          data={data}
          changeTracks={changeTracks}
          account={account}
          theme={theme}
          setTheme={setTheme}
          look={look}
          setLook={setLook}
          focus={settingsOpen}
          onSignIn={(mode) => setAuthOpen(mode)}
          onClose={closeSettings}
        />
      )}
      {authOpen && <AccountScreen account={account} mode={authOpen === true ? 'login' : authOpen} onClose={closeAuth} />}
      {sharing && <ShareDialog track={sharing} onClose={closeShare} />}
      <Sidebar
        tracks={data.tracks}
        activeId={activeId}
        setActiveId={(id) => { setActiveId(id); setSideOpen(false) }}
        open={sideOpen}
        onClose={() => setSideOpen(false)}
        onHide={hideSide}
        onNew={newObjective}
        onPick={practice}
        onSettings={() => { setSideOpen(false); setSettingsOpen('top') }}
        account={account}
        onAccount={() => { setSideOpen(false); account.username ? setSettingsOpen('top') : setAuthOpen(true) }}
        onShare={(t) => { setSideOpen(false); setSharing(t) }}
        dark={dark}
        busy={Boolean(busy)}
        onStarter={(s) => { setSideOpen(false); push(item('me', { text: s })); learn(s) }}
      />
      <div className="main">
        {hero ? (
          <>
            <div className="hero">
              <button className="icon-btn menu" onClick={showSide} aria-label="Show sidebar" title="Show sidebar"><PanelIcon /></button>
              <h1>What do you want to be able to do?</h1>
              <p>Name a goal. Stepwise breaks it into concepts, picks the right kind of practice for each one, and keeps track of what you’ve mastered. Paste or attach notes and it teaches only from them.</p>
            </div>
            {composer}
          </>
        ) : (
          <>
            <header className="main-head">
              <button className="icon-btn menu" onClick={showSide} aria-label="Show sidebar" title="Show sidebar"><PanelIcon /></button>
              {active && (
                <div>
                  <h1>{active.title}</h1>
                  <p>{active.objective}</p>
                </div>
              )}
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
      {feed.filter((x) => x.kind === 'exercise' && (!x.done || x.id === closing)).map((x) => (
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
