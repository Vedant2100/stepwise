import { useState } from 'react'
import Md from './Md.jsx'
import Progress from './Progress.jsx'
import { EnvIcon, Mark } from './Icons.jsx'
import { SUGGESTIONS } from '../lib/router.js'
import ReadingMap from './ReadingMap.jsx'
import { ACCESS_KEY } from '../lib/llm.js'
import { ENVIRONMENTS, envFor } from '../lib/planner.js'
const TYPE_LABEL = { concept: 'Concept', procedure: 'Procedure', skill: 'Skill', recall: 'Recall', intuition: 'Intuition', reading: 'Code reading', ordering: 'Ordering', data: 'Data', algorithm: 'Algorithm' }

export const Avatar = () => <span className="avatar"><Mark size={30} /></span>

function AccessForm({ onSubmit }) {
  const [code, setCode] = useState('')
  return (
    <form className="row access" onSubmit={(e) => { e.preventDefault(); if (code.trim()) onSubmit(code.trim()) }}>
      <input className="secret" autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="Access code" aria-label="Access code" autoComplete="off" autoCapitalize="off" spellCheck={false} data-1p-ignore data-lpignore="true" />
      <button className="btn sm" disabled={!code.trim()}>Continue</button>
    </form>
  )
}

function Teacher({ err, wide, children }) {
  return (
    <div className={`msg t${err ? ' err' : ''}${wide ? ' wide' : ''}`}>
      <Avatar />
      <div className="body">{children}</div>
    </div>
  )
}

export default function FeedItem({ it, data, actions, busy, openWs }) {
  const track = data.tracks.find((t) => t.id === it.trackId)

  switch (it.kind) {
    case 'me':
      return <div className="msg me">{it.text}</div>

    case 't':
      return (
        <Teacher err={it.err}>
          <Md>{it.text}</Md>
          {it.gain && (
            <div className="gain">
              <div className="bar" style={{ '--from': `${it.gain.from}%`, '--to': `${it.gain.to}%` }} role="img" aria-label={`Mastery ${it.gain.from}% to ${it.gain.to}%`}><i /><s /></div>
              <span>{it.gain.to}% mastered</span>
            </div>
          )}
          {it.badges?.length > 0 && (
            <div className="badges">
              {it.badges.map((b) => <span key={b.text} className={`badge ${b.kind}`}>{b.kind === 'mastered' ? '★' : '↑'} {b.text}</span>)}
            </div>
          )}
          {it.suggest?.length > 0 && (
            <div className="row suggest">
              {it.suggest.map((k) => (
                <button key={k} className="btn ghost sm" disabled={busy} onClick={() => ({ next: actions.next, review: actions.next, progress: actions.progress, new: actions.newObjective })[k]()}>{SUGGESTIONS[k]}</button>
              ))}
            </div>
          )}
          {it.next && (
            <div className="row">
              <button className="btn sm" onClick={() => actions.next()} disabled={busy}>{it.nextLabel ?? 'Next exercise'}</button>
            </div>
          )}
        </Teacher>
      )

    case 'map':
      return (
        <Teacher wide>
          <p>Reading map</p>
          <ReadingMap map={it.map} />
        </Teacher>
      )

    case 'plan':
      if (!track) return null
      return (
        <Teacher wide>
          <p>{it.revised ? 'Updated climb' : 'Your climb'}: <b>{track.title}</b></p>
          <div className="plan-card">
            <div className="plan-envs">
              {[...new Set(track.concepts.map((c) => envFor(c.type)))].map((env) => {
                const Icon = EnvIcon[env]
                const n = track.concepts.filter((c) => envFor(c.type) === env).length
                return <span key={env} className="plan-env"><Icon /> {ENVIRONMENTS[env].label} <b>{n}</b></span>
              })}
            </div>
            <ol className="plan-list">
              {track.concepts.map((c) => {
                const Icon = EnvIcon[envFor(c.type)]
                return (
                  <li key={c.id} title={`${TYPE_LABEL[c.type]}, practiced in ${ENVIRONMENTS[envFor(c.type)].label.toLowerCase()}`}>
                    <Icon />
                    <span>{c.name}{c.grounded === false && <span className="warn">Quote not found in your source</span>}</span>
                  </li>
                )
              })}
            </ol>
          </div>
        </Teacher>
      )

    case 'exercise': {
      if (!track) return null
      const concept = track.concepts.find((c) => c.id === it.conceptId)
      if (!concept) return null
      const Icon = EnvIcon[it.env]
      const status = {
        finished: 'Recorded',
        skipped: 'Skipped',
        switched: 'Switched to another workspace',
      }[it.done] ?? (it.mode === 'review' ? 'Review' : '')
      return (
        <div className={`launch${openWs === it.id ? ' open' : ''}`}>
          <span className="glyph"><Icon /></span>
          <div>
            <small>{ENVIRONMENTS[it.env].label}</small>
            <b>{concept.name}</b>
            {status && <small>{status}</small>}
          </div>
          {it.done === 'finished' ? (
            <span className="done-score">{it.score}<small>/100</small></span>
          ) : !it.done ? (
            <button className="btn sm" onClick={() => actions.openWorkspace(it.id)}>Open</button>
          ) : <span />}
        </div>
      )
    }

    case 'progress':
      return <Teacher wide><Progress tracks={data.tracks} actions={actions} busy={busy} /></Teacher>

    case 'access':
      return (
        it.done ? null : (
          <Teacher err={it.wrong}>
            <p>{it.wrong ? 'That code didn’t work. Try again.' : 'Enter your access code to continue.'}</p>
            <AccessForm onSubmit={(code) => actions.unlock(it.id, code)} />
          </Teacher>
        )
      )

    case 'confirmDelete':
      return <Teacher><ConfirmDelete track={track} onYes={() => actions.remove(it.trackId)} /></Teacher>

    default:
      return null
  }
}

function ConfirmDelete({ track, onYes }) {
  const [done, setDone] = useState(false)
  if (!track) return null
  return (
    <div>
      <p>Delete <b>{track.title}</b> and its progress?</p>
      {!done && (
        <div className="row">
          <button className="btn danger sm" onClick={() => { setDone(true); onYes() }}>Delete it</button>
          <button className="btn ghost sm" onClick={() => setDone(true)}>Keep it</button>
        </div>
      )}
    </div>
  )
}
