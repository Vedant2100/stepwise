import { useEffect, useRef, useState } from 'react'
import { createLink } from '../lib/share.js'
import { isMastered } from '../lib/learner.js'

export default function ShareDialog({ track, onClose }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const first = useRef(null)
  const done = track.concepts.filter(isMastered).length

  useEffect(() => {
    first.current?.focus()
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  async function make() {
    setBusy(true)
    setError('')
    try {
      setUrl(await createLink(track))
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  async function copy() {
    await navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
  }

  const text = `I’m climbing “${track.title}” on Stepwise: ${done} of ${track.concepts.length} concepts mastered.`
  return (
    <div className="auth" role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="auth-card">
        <h1 id="share-title">Share this climb</h1>
        <p className="why">{track.title}: {done} of {track.concepts.length} mastered.</p>
        <p>Anyone with the link can see the concepts and how far you’ve climbed, and start their own copy. Your notes, answers and username aren’t included.</p>
        {error && <p className="bad" role="alert">{error}</p>}
        {url ? (
          <>
            <input className="share-url" value={url} readOnly onFocus={(e) => e.target.select()} aria-label="Link to this climb" />
            <div className="row">
              <button ref={first} className="btn" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
              {navigator.share && <button className="btn ghost" onClick={() => navigator.share({ title: track.title, text, url }).catch(() => {})}>Share…</button>}
            </div>
          </>
        ) : (
          <button ref={first} className="btn wide" disabled={busy} onClick={make}>{busy ? 'Creating link…' : 'Create link'}</button>
        )}
        <p className="auth-switch"><button className="link" onClick={onClose}>{url ? 'Done' : 'Cancel'}</button></p>
      </div>
    </div>
  )
}
