import { useState } from 'react'
import { ACCESS_KEY } from '../lib/llm.js'
import { download, parseData } from '../lib/storage.js'

export default function Settings({ data, changeTracks }) {
  const [code, setCode] = useState(localStorage.getItem(ACCESS_KEY) ?? '')
  const [message, setMessage] = useState('')

  async function importFile(file) {
    try {
      const imported = parseData(await file.text())
      const ids = new Set(data.tracks.map((t) => t.id))
      const fresh = imported.tracks.filter((t) => !ids.has(t.id))
      changeTracks((ts) => [...ts, ...fresh])
      setMessage(`Imported ${fresh.length} objective(s); ${imported.tracks.length - fresh.length} already here were skipped.`)
    } catch (e) {
      setMessage(e instanceof SyntaxError ? 'That file is not valid JSON.' : e.message)
    }
  }

  return (
    <>
      <h3 style={{ marginTop: 0 }}>Settings &amp; data</h3>
      <label>
        <span className="why">Access code (only if this deployment asks for one)</span>
        <input
          type="password"
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            localStorage.setItem(ACCESS_KEY, e.target.value)
          }}
        />
      </label>
      <div className="row">
        <button className="btn ghost sm" onClick={() => download(data)} disabled={!data.tracks.length}>Export JSON</button>
        <label className="btn ghost sm">
          Import JSON
          <input type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files[0] && importFile(e.target.files[0])} />
        </label>
      </div>
      {message && <p>{message}</p>}
      <p className="why">Progress is kept in this browser, and in your account when you’re signed in. Export makes a file you can keep or import elsewhere.</p>
    </>
  )
}
