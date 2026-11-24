import { useRef, useState } from 'react'

const EXAMPLES = [
  'Understand and implement scaled dot-product attention',
  'Binary search, well enough for interviews',
  'Order food in Spanish',
  'Get a feel for how learning rate affects training',
]

export default function Composer({ busy, source, setSource, onSend, hasOpen, hasTracks, onNext, onProgress, sourceMax, centered }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
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
    if (f.size > 2_000_000) return setError('That file is over 2 MB.')
    setSource({ name: f.name, text: (await f.text()).slice(0, sourceMax) })
  }

  return (
    <form className={`composer${centered ? ' centered' : ''}`} onSubmit={submit}>
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
        <button type="button" className="btn ghost att" onClick={() => file.current.click()} title="Attach notes (.txt, .md)" aria-label="Attach notes">+</button>
        <input ref={file} type="file" accept=".txt,.md,text/plain,text/markdown" hidden onChange={(e) => { if (e.target.files[0]) attach(e.target.files[0]); e.target.value = '' }} />
        <textarea
          ref={box}
          rows={1}
          value={text}
          placeholder={hasTracks ? 'Ask a question, say “next”, or name something new to learn' : 'e.g. Understand how transformers use attention'}
          onChange={(e) => {
            setText(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = `${Math.min(180, e.target.scrollHeight)}px`
          }}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && submit(e)}
          aria-label="Message"
        />
        <button className="btn" disabled={busy || !text.trim()}>{hasTracks ? 'Send' : 'Start'}</button>
      </div>
      {!hasTracks && centered && (
        <div className="examples">
          {EXAMPLES.map((e) => <button key={e} type="button" className="pick" onClick={() => onSend(e)} disabled={busy}>{e}</button>)}
        </div>
      )}
    </form>
  )
}
