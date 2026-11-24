import { useMemo, useState } from 'react'
import Md from '../components/Md.jsx'

function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.join('|') === list.join('|') && a.length > 1 ? [...a.slice(1), a[0]] : a
}

// "order": drag (or use the arrow buttons) into sequence. "buckets": pick an item, then a category.
export default function SortWorkspace({ exercise, onDone }) {
  return exercise.mode === 'order' ? <Order exercise={exercise} onDone={onDone} /> : <Buckets exercise={exercise} onDone={onDone} />
}

function Order({ exercise, onDone }) {
  const [items, setItems] = useState(() => shuffle(exercise.items))
  const [dragging, setDragging] = useState(null)
  const [checked, setChecked] = useState(false)
  const right = items.filter((it, i) => exercise.items[i] === it).length
  const score = Math.round((right / items.length) * 100)

  const move = (from, to) => {
    if (to < 0 || to >= items.length || checked) return
    const a = [...items]
    const [x] = a.splice(from, 1)
    a.splice(to, 0, x)
    setItems(a)
  }

  return (
    <div className="panes center">
      <section className="pane" style={{ alignSelf: 'start' }}>
        <Md>{exercise.prompt}</Md>
        <p className="why">Drag items into order, or use the arrows. First at the top.</p>
        <ol className="sortlist">
          {items.map((it, i) => {
            const state = checked ? (exercise.items[i] === it ? ' right' : ' wrong') : ''
            return (
              <li
                key={it}
                className={`sortitem${state}${dragging === i ? ' dragging' : ''}`}
                draggable={!checked}
                onDragStart={() => setDragging(i)}
                onDragOver={(e) => { e.preventDefault(); if (dragging !== null && dragging !== i) { move(dragging, i); setDragging(i) } }}
                onDragEnd={() => setDragging(null)}
              >
                <span className="grip" aria-hidden="true">⋮⋮</span>
                <span className="grow">{it}</span>
                {checked && exercise.items[i] !== it && <small className="why">belongs at {exercise.items.indexOf(it) + 1}</small>}
                {!checked && (
                  <span className="arrows">
                    <button className="btn ghost sm" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${it} up`}>↑</button>
                    <button className="btn ghost sm" onClick={() => move(i, i + 1)} disabled={i === items.length - 1} aria-label={`Move ${it} down`}>↓</button>
                  </span>
                )}
              </li>
            )
          })}
        </ol>
        {!checked ? (
          <div className="row" style={{ margin: 0 }}><button className="btn" onClick={() => setChecked(true)}>Check order</button></div>
        ) : (
          <div className="res" style={{ marginTop: 0 }}>
            <div className="score">{right}/{items.length}<small> in the right place</small></div>
            {exercise.why && <p>{exercise.why}</p>}
            <button className="btn" onClick={() => onDone(score)}>Record it</button>
          </div>
        )}
      </section>
    </div>
  )
}

function Buckets({ exercise, onDone }) {
  const answer = useMemo(() => Object.fromEntries(exercise.buckets.flatMap((b) => b.items.map((it) => [it, b.name]))), [exercise])
  const [pool] = useState(() => shuffle(Object.keys(answer)))
  const [placed, setPlaced] = useState({})
  const [picked, setPicked] = useState(null)
  const [checked, setChecked] = useState(false)
  const right = pool.filter((it) => placed[it] === answer[it]).length
  const left = pool.filter((it) => !placed[it])

  const put = (item, bucket) => {
    if (checked || !item) return
    setPlaced({ ...placed, [item]: bucket })
    setPicked(null)
  }

  return (
    <div className="panes center" style={{ gridTemplateColumns: 'minmax(0, 980px)' }}>
      <section className="pane" style={{ alignSelf: 'start' }}>
        <Md>{exercise.prompt}</Md>
        <p className="why">Pick an item, then the category it belongs to. You can also drag.</p>
        <div className="pool">
          {left.map((it) => (
            <button key={it} className={`pick${picked === it ? ' on' : ''}`} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', it)} onClick={() => setPicked(it)}>{it}</button>
          ))}
          {!left.length && !checked && <span className="why">All placed. Check when ready.</span>}
        </div>
        <div className="buckets">
          {exercise.buckets.map((b) => (
            <div key={b.name} className={`bucket${picked ? ' ready' : ''}`} onClick={() => put(picked, b.name)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => put(e.dataTransfer.getData('text/plain'), b.name)}>
              <b>{b.name}</b>
              {pool.filter((it) => placed[it] === b.name).map((it) => (
                <button
                  key={it}
                  className={`pick${checked ? (answer[it] === b.name ? ' right' : ' wrong') : ''}`}
                  onClick={(e) => { e.stopPropagation(); if (!checked) setPlaced({ ...placed, [it]: undefined }) }}
                  title={checked && answer[it] !== b.name ? `Belongs in ${answer[it]}` : checked ? '' : 'Click to take it back out'}
                >
                  {it}{checked && answer[it] !== b.name && <small> (belongs in {answer[it]})</small>}
                </button>
              ))}
            </div>
          ))}
        </div>
        {!checked ? (
          <div className="row" style={{ margin: 0 }}><button className="btn" onClick={() => setChecked(true)} disabled={left.length > 0}>Check</button></div>
        ) : (
          <div className="res" style={{ marginTop: 0 }}>
            <div className="score">{right}/{pool.length}<small> sorted correctly</small></div>
            {exercise.why && <p>{exercise.why}</p>}
            <button className="btn" onClick={() => onDone(Math.round((right / pool.length) * 100))}>Record it</button>
          </div>
        )}
      </section>
    </div>
  )
}
