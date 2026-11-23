import { useState } from 'react'
import { ACCESS_KEY } from '../lib/llm.js'
import { download, parseData } from '../lib/storage.js'

export default function Settings({ data, setData }) {
  const [code, setCode] = useState(localStorage.getItem(ACCESS_KEY) ?? '')
  const [message, setMessage] = useState('')

  async function importFile(file) {
    try {
      const imported = parseData(await file.text())
      const ids = new Set(data.tracks.map((t) => t.id))
      const fresh = imported.tracks.filter((t) => !ids.has(t.id))
      setData({ tracks: [...data.tracks, ...fresh] })
      setMessage(`Imported ${fresh.length} objective(s); ${imported.tracks.length - fresh.length} already here were skipped.`)
    } catch (e) {
      setMessage(e instanceof SyntaxError ? 'That file is not valid JSON.' : e.message)
    }
  }

  return (
    <details className="card">
      <summary className="cursor-pointer font-semibold">Settings &amp; data</summary>
      <div className="mt-4 space-y-4 text-sm">
        <label className="block space-y-1">
          <span>Access code (only if the deployment asks for one)</span>
          <input
            className="field"
            type="password"
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              localStorage.setItem(ACCESS_KEY, e.target.value)
            }}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-ghost" onClick={() => download(data)} disabled={!data.tracks.length}>Export JSON</button>
          <label className="btn-ghost cursor-pointer">
            Import JSON
            <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => e.target.files[0] && importFile(e.target.files[0])} />
          </label>
        </div>
        {message && <p>{message}</p>}
        <p className="text-xs text-stone-500">Your progress is stored only in this browser. Export it to move it to another device.</p>
      </div>
    </details>
  )
}
