import { useState } from 'react'
import { ask } from '../lib/llm.js'
import { isMastered } from '../lib/learner.js'
import { validatePlan } from '../lib/plan.js'
import { planPrompt, system } from '../lib/prompts.js'
import Settings from './Settings.jsx'

const SOURCE_MAX = 15_000

export default function Home({ data, setData, open }) {
  const [objective, setObjective] = useState('')
  const [source, setSource] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function readFile(file) {
    if (file.size > 2_000_000) return setError('That file is over 2 MB.')
    setSource((await file.text()).slice(0, SOURCE_MAX))
  }

  async function create(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const text = source.trim()
      const plan = validatePlan(await ask(system({ source: text }), planPrompt(objective.trim(), text)), text)
      const track = { id: crypto.randomUUID(), objective: objective.trim(), source: text, ...plan, log: [], createdAt: Date.now() }
      setData({ tracks: [track, ...data.tracks] })
      open(track.id)
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <div className="space-y-8">
      <form className="card space-y-3" onSubmit={create}>
        <h2 className="font-semibold">What do you want to be able to do?</h2>
        <textarea
          className="field h-20"
          placeholder="e.g. Understand and implement scaled dot-product attention"
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          maxLength={500}
          required
        />
        <details>
          <summary className="cursor-pointer text-sm">Add source material (optional)</summary>
          <div className="mt-2 space-y-2">
            <textarea
              className="field h-32"
              placeholder="Paste notes, an article or a paper's text. Everything taught will be checked against it."
              value={source}
              onChange={(e) => setSource(e.target.value.slice(0, SOURCE_MAX))}
            />
            <div className="flex items-center justify-between text-xs text-stone-500">
              <input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={(e) => e.target.files[0] && readFile(e.target.files[0])} />
              <span>{source.length.toLocaleString()} / {SOURCE_MAX.toLocaleString()} characters</span>
            </div>
          </div>
        </details>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn" disabled={busy || objective.trim().length < 5}>{busy ? 'Planning…' : 'Build my plan'}</button>
      </form>

      <section className="space-y-2">
        <h2 className="font-semibold">Your objectives</h2>
        {data.tracks.length === 0 && <p className="text-sm text-stone-500">Nothing yet. Start with an objective above.</p>}
        {data.tracks.map((t) => {
          const done = t.concepts.filter(isMastered).length
          return (
            <button key={t.id} className="card block w-full text-left hover:border-stone-400" onClick={() => open(t.id)}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-medium">{t.title}</span>
                <span className="shrink-0 text-xs text-stone-500">{done}/{t.concepts.length} mastered</span>
              </div>
              <p className="mt-1 text-sm text-stone-500">{t.objective}</p>
              <div className="mt-3 h-1.5 rounded bg-stone-200 dark:bg-stone-800">
                <div className="h-1.5 rounded bg-emerald-600" style={{ width: `${(done / t.concepts.length) * 100}%` }} />
              </div>
            </button>
          )
        })}
      </section>

      <Settings data={data} setData={setData} />
    </div>
  )
}
