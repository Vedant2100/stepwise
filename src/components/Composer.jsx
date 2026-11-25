import { useRef, useState } from 'react'

import { STARTERS } from '../lib/starters.js'
import { readFile } from '../lib/ingest.js'

export default function Composer({ busy, source, setSource, onSend, onStarter, hasOpen, hasTracks, onNext, onProgress, sourceMax, centered }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [reading, setReading] = useState('')
  const file = useRef(null)
  const box = useRef(null)

  function submit(e) {
    e?.preventDefault()
    const t = text.trim()
    if (!t || busy) return
    setText('')
    if (box.current) box.current.style.height = ''
    onSend(t)
  }

  async function attach(f) {
    setError('')
    setReading(f.name || 'your image')
    try {
      const doc = await readFile(f)
      setSource({ name: doc.title, text: doc.text.slice(0, sourceMax) })
    } catch (e) {
      setError(e.status === 401 ? 'Reading images needs an access code. Add one in Settings.' : e.message)
    }
    setReading('')
  }

  function dropped(e) {
    const f = [...(e.clipboardData ?? e.dataTransfer).files][0]
    if (!f) return
    e.preventDefault()
    attach(f)
  }

  return (
    <form className={`composer${centered ? ' centered' : ''}`} onSubmit={submit} onDrop={dropped} onDragOver={(e) => e.preventDefault()}>
      {reading && <div className="pkg">Reading <b>{reading}</b>…</div>}
      {source && (
        <div className="pkg">
          <span><b>{source.name}</b> attached ({source.text.length.toLocaleString()} characters). Now say what you want to be able to do with it.</span>
          <button type="button" className="btn ghost sm" onClick={() => setSource(null)}>Remove</button>
        </div>
      )}
      {error && <div className="pkg">{error}</div>}
      {hasTracks && (
        <div className="quick">
          <button type="button" className="pick" onClick={onNext} disabled={busy}>{hasOpen ? 'Skip this one' : 'Next exercise'}</button>
          <button type="button" className="pick" onClick={onProgress}>How am I doing?</button>
        </div>
      )}
      <div className="cbar">
        <button type="button" className="btn ghost att" onClick={() => file.current.click()} title="Attach a PDF, Word file, notes or an image" aria-label="Attach notes">+</button>
        <input ref={file} type="file" accept=".pdf,.docx,.txt,.md,.csv,image/*,text/plain,text/markdown,application/pdf" hidden onChange={(e) => { if (e.target.files[0]) attach(e.target.files[0]); e.target.value = '' }} />
        <textarea
          ref={box}
          rows={1}
          onPaste={dropped}
          value={text}
          placeholder={innerWidth < 600 ? (hasTracks ? 'Ask, or say “next”' : 'Name a goal') : hasTracks ? 'Ask a question, say “next”, or name something new to learn' : 'e.g. Understand how transformers use attention'}
          onChange={(e) => {
            setText(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = `${Math.min(180, e.target.scrollHeight)}px`
          }}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && submit(e)}
          aria-label="Message"
        />
        <button className="btn" disabled={busy || reading || !text.trim()}>{hasTracks ? 'Send' : 'Start'}</button>
      </div>
      {!hasTracks && centered && (
        <div className="examples">
          {STARTERS.map((e) => <button key={e} type="button" className="pick" onClick={() => onStarter(e)} disabled={busy}>{e}</button>)}
        </div>
      )}
    </form>
  )
}
