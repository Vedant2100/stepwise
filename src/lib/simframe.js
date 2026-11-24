// Builds the sandboxed page for a simulation. The model supplies only `compute`; our harness draws sliders and bars.
// The iframe gets sandbox="allow-scripts" (no same-origin: no access to Stepwise's storage or cookies)
// and this CSP blocks all network requests.
const CSP = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'"

export function simPage(sim, dark) {
  const config = JSON.stringify({ params: sim.params, compute: sim.compute, dark }).replace(/</g, '\\u003c')
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}">
<style>
body{margin:0;padding:16px;font:15px/1.4 system-ui,sans-serif;background:${dark ? '#14221e' : '#fff'};color:${dark ? '#e4ece8' : '#1a2522'}}
label{display:grid;grid-template-columns:9em 1fr 4em;gap:10px;align-items:center;margin:6px 0}
input{width:100%;accent-color:#f0a81c}output{font-family:ui-monospace,monospace;text-align:right}
svg{width:100%;height:auto;margin-top:12px}.err{color:#c62d1f;font-family:ui-monospace,monospace;white-space:pre-wrap}
</style></head><body><div id="sliders"></div><svg id="chart" viewBox="0 0 600 260" role="img"></svg><div id="err" class="err"></div>
<script>
const C = ${config}
const f = new Function('p', '"use strict";' + C.compute)
const p = Object.fromEntries(C.params.map((q) => [q.name, q.value]))
const ink = C.dark ? '#e4ece8' : '#1a2522', line = C.dark ? '#27403a' : '#d5ddd9', bar = C.dark ? '#f0a81c' : '#1d5446'
for (const q of C.params) {
  const l = document.createElement('label')
  l.innerHTML = '<span></span><input type="range"><output></output>'
  l.children[0].textContent = q.label || q.name
  const i = l.children[1], o = l.children[2]
  Object.assign(i, { min: q.min, max: q.max, step: q.step, value: q.value })
  o.textContent = q.value
  i.oninput = () => { p[q.name] = Number(i.value); o.textContent = i.value; draw() }
  document.getElementById('sliders').append(l)
}
function draw() {
  const svg = document.getElementById('chart'), err = document.getElementById('err')
  svg.textContent = ''; err.textContent = ''
  let r
  try { r = f({ ...p }) } catch (e) { err.textContent = 'Simulation error: ' + e.message; return }
  const vals = (r && Array.isArray(r.values) ? r.values : []).slice(0, 24).map(Number)
  if (!vals.length || vals.some((v) => !Number.isFinite(v))) { err.textContent = 'The simulation returned no usable numbers.'; return }
  const max = Math.max(...vals.map(Math.abs), 1e-9), w = 600 / vals.length, base = vals.some((v) => v < 0) ? 120 : 220, scale = (vals.some((v) => v < 0) ? 100 : 200) / max
  const ns = 'http://www.w3.org/2000/svg', el = (t, a) => { const e = document.createElementNS(ns, t); for (const k in a) e.setAttribute(k, a[k]); svg.append(e); return e }
  el('line', { x1: 0, x2: 600, y1: base, y2: base, stroke: line })
  vals.forEach((v, i) => {
    const h = Math.abs(v) * scale
    el('rect', { x: i * w + w * 0.15, width: w * 0.7, y: v >= 0 ? base - h : base, height: Math.max(h, 1), fill: bar, rx: 4 })
    el('text', { x: i * w + w / 2, y: v >= 0 ? base - h - 4 : base + h + 14, 'text-anchor': 'middle', 'font-size': 11, fill: ink }).textContent = +v.toFixed(3)
    el('text', { x: i * w + w / 2, y: 250, 'text-anchor': 'middle', 'font-size': 11, fill: ink }).textContent = String((r.labels || [])[i] ?? i + 1).slice(0, 10)
  })
}
draw()
</script></body></html>`
}
