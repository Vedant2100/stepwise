export default function ReadingMap({ map }) {
  const into = (doc) => map.links.filter((l) => l.to === doc)
  return (
    <div className="rmap">
      {map.themes.length > 0 && (
        <div className="rmap-themes">{map.themes.map((t) => <span key={t}>{t}</span>)}</div>
      )}
      <ol className="rmap-flow">
        {map.steps.map((s, i) => {
          const doc = map.docs[s.doc]
          return (
            <li key={s.doc}>
              <div className="rmap-node">
                <span className="rmap-num">{i + 1}</span>
                <div>
                  <a href={doc.url} target="_blank" rel="noreferrer">{doc.title}</a>
                  {s.ideas.length > 0 ? <ul>{s.ideas.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="why">{doc.summary}</p>}
                  {into(s.doc).map((l) => (
                    <small key={l.from} className="rmap-link">Builds on {map.steps.findIndex((x) => x.doc === l.from) + 1}: {l.why}</small>
                  ))}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
