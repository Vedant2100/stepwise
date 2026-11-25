import json, re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from _env import BASE, LAUNCH, OUT, PYO, check_errors

SOURCE = ("Attention computes a weighted sum of values. Weights come from a softmax over scaled dot products. "
          "The scaling factor is one over the square root of the key dimension. Temperature sharpens or flattens the softmax. ") * 5
C = lambda i, n, t, q: {"id": i, "name": n, "type": t, "summary": f"About {n}.", "prereqs": [], "quote": q}
PLAN = {"title": "Attention", "concepts": [
  C("why", "Attention as a weighted sum", "concept", "Attention computes a weighted sum of values"),
  C("by-hand", "Softmax by hand", "procedure", "Weights come from a softmax"),
  C("impl", "Implement softmax", "skill", "scaled dot products"),
  C("terms", "Key terms", "recall", "square root of the key dimension"),
  C("temp", "Temperature intuition", "intuition", "Temperature sharpens or flattens the softmax")]}
EX = {
  "explain-it-back question": {"question": "Why is attention a weighted sum?", "rubric": ["values are mixed", "weights sum to 1"], "reference": "Because..."},
  "worked problem": {"problem": "Compute $\\mathrm{softmax}([0,0])$", "steps": [{"expected": "$e^0 = 1$", "hint": "exponentiate"}, {"expected": "[0.5, 0.5]", "hint": "normalise"}]},
  "Python coding exercise": {"brief": "Write `softmax(xs)`.", "starter": "def softmax(xs):\n    pass\n", "hints": ["use math.exp", "divide by the sum"],
     "reference": "import math\ndef softmax(xs):\n    e = [math.exp(x) for x in xs]\n    return [v / sum(e) for v in e]\n",
     "tests": [{"name": "sums to one", "code": "assert abs(sum(softmax([1,2,3])) - 1) < 1e-9"}, {"name": "uniform", "code": "assert softmax([0,0]) == [0.5,0.5]"}, {"name": "bad", "code": "assert softmax([0,0]) == [1,0]"}]},
  "retrieval drill": {"cards": [{"front": "Scaling factor?", "back": "1/sqrt(d_k)"}, {"front": "Normaliser?", "back": "softmax"}]},
  "interactive simulation": {"intro": "Move **temperature** and watch the weights.", "chart": "softmax weights",
     "params": [{"name": "t", "label": "Temperature", "min": 0.1, "max": 5, "step": 0.1, "value": 1}],
     "compute": "const s=[2,1,0.5].map(x=>Math.exp(x/p.t)); const z=s.reduce((a,b)=>a+b,0); try{fetch('https://example.com')}catch(e){} return {labels:['a','b','c'], values:s.map(v=>v/z)}",
     "questions": [{"ask": "What happens as temperature goes to 0.1?", "answer": "The largest score takes almost all the weight."}]},
}
calls = []
def llm(route):
    p = json.loads(route.request.post_data)["prompt"]; calls.append(p[:25])
    if "Decide what it is" in p: reply = {"kind": "notes", "objective": "", "missing": []}
    elif "Break the objective" in p: reply = PLAN
    elif "Grade strictly" in p: reply = {"score": 85, "verdict": "Half there.", "points": [{"met": True, "note": "good"}, {"met": False, "note": "never said they sum to one"}]}
    elif "Is the learner's step correct" in p: reply = {"ok": True, "feedback": ""}
    else: reply = next(v for k, v in EX.items() if k in p)
    route.fulfill(json={"text": json.dumps(reply)})
def cdn(route):
    f = PYO / route.request.url.split('/full/')[1].split('?')[0]
    if not f.exists(): return route.fulfill(status=404, body='')
    ct = {'.wasm': 'application/wasm', '.json': 'application/json', '.zip': 'application/zip'}.get(f.suffix, 'text/javascript')
    route.fulfill(body=f.read_bytes(), headers={'content-type': ct, 'access-control-allow-origin': '*'})

errors, net = [], []
with sync_playwright() as pw:
    b = pw.chromium.launch(**LAUNCH)
    page = b.new_context(viewport={'width': 1280, 'height': 820}).new_page()
    page.route('**/api/llm', llm); page.route('https://cdn.jsdelivr.net/pyodide/**', cdn)
    page.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(body='', headers={'content-type': 'text/css'}))
    page.on('request', lambda r: 'example.com' in r.url and net.append(r.url))
    page.on('pageerror', lambda e: errors.append(f'{e} {e.stack}'))
    page.on('console', lambda m: m.type == 'error' and 'Content Security Policy' not in m.text and errors.append(m.text))
    page.goto(BASE + '/')
    msg = page.get_by_label('Message'); send = lambda t: (msg.fill(t), msg.press('Enter'))
    send(SOURCE); expect(page.get_by_text('treat that as source material')).to_be_visible(); send('Understand attention')
    ws = lambda: page.locator('.ws:not([hidden])')
    shot = lambda n: page.screenshot(path=f'{OUT}/ws-{n}.png')
    record = lambda: ws().get_by_role('button', name=re.compile('^Record'))

    # explain
    expect(ws()).to_have_count(1); expect(ws().locator('.chip')).to_have_text('Explain it back')
    expect(ws().get_by_text('Revealed after you answer')).to_have_count(2)
    ws().get_by_label('Your explanation').fill('Attention mixes the values together.')
    ws().get_by_role('button', name='Submit').click()
    expect(ws().get_by_text('never said they sum to one')).to_be_visible()
    expect(ws().get_by_text('From your source')).to_be_visible()
    shot('explain'); record().click()
    expect(ws()).to_have_count(0); expect(page.get_by_text('85/100 on Attention as a weighted sum')).to_be_visible()
    print('explain: rubric checklist + source passage, closes to chat with score')

    # steps: first step accepted locally (no model call)
    page.get_by_role('button', name='Next exercise').last.click()
    expect(ws().locator('.chip')).to_have_text('Step workspace')
    n0 = len(calls)
    ws().get_by_label('Current step').fill('$e^{0} = 1$'.replace('{0}', '0'))
    expect(ws().locator('.katex').first).to_be_visible()
    ws().get_by_label('Current step').press('Control+Enter')
    expect(ws().get_by_text('Step 2', exact=True)).to_be_visible()
    assert len(calls) == n0, 'exact step should not call the model'
    ws().get_by_role('button', name='Back to chat').click(); expect(ws()).to_have_count(0)
    page.get_by_role('button', name='Open workspace').last.click(); expect(ws()).to_have_count(1)
    ws().get_by_label('Current step').fill('each is one half'); ws().get_by_role('button', name='Check step').click()
    shot('steps'); record().click()
    print('steps: math preview, local check without model call, minimise and reopen keeps state')

    # code IDE: rerun as you type
    page.get_by_role('button', name='Next exercise').last.click()
    expect(ws().locator('.chip')).to_have_text('Code sandbox', timeout=120000)
    ws().get_by_role('button', name='Run tests').click()
    expect(ws().get_by_text('0/2', exact=False).first).to_be_visible(timeout=120000)
    ws().locator('.cm-content').click(); page.keyboard.press('Control+A'); page.keyboard.press('Delete')
    page.keyboard.insert_text("import math\ndef softmax(xs):\n    e=[math.exp(x) for x in xs]\n    print('ran')\n    return [v/sum(e) for v in e]\n")
    expect(ws().locator('.score')).to_contain_text('2/2', timeout=60000)   # no click: reran on typing
    expect(ws().locator('pre').last).to_contain_text('ran')
    shot('code'); record().click()
    print('code IDE: three panes, reran tests as I typed, console output')

    # drill with keyboard
    page.get_by_role('button', name='Next exercise').last.click()
    expect(ws().locator('.chip')).to_have_text('Retrieval drill')
    ws().get_by_label('Your answer').fill('1/sqrt(d_k)'); ws().get_by_label('Your answer').press('Enter')
    ws().get_by_label('Your answer').press('Enter')   # blank: flip
    expect(ws().locator('.flash .back')).to_have_text('softmax'); shot('drill')
    page.keyboard.press('2'); expect(ws().locator('.score')).to_have_text('2/2'); record().click()
    print('drill: exact answer auto-counted, blank Enter flips, key 2 = had it')

    # simulation in sandbox
    page.get_by_role('button', name='Next exercise').last.click()
    expect(ws().locator('.chip')).to_have_text('Simulation')
    frame = ws().frame_locator('iframe.sim')
    expect(frame.locator('svg rect')).to_have_count(3)
    first = frame.locator('svg text').first.text_content()
    frame.locator('input[type=range]').fill('0.1')
    expect(frame.locator('svg text').first).not_to_have_text(first)
    assert ws().locator('iframe.sim').get_attribute('sandbox') == 'allow-scripts'
    leak = frame.locator('body').evaluate("() => { try { return String(localStorage.length) } catch (e) { return 'blocked' } }")
    ws().get_by_label('Your prediction').fill('The biggest one takes everything')
    ws().get_by_role('button', name='Check').click(); shot('sim')
    ws().get_by_role('button', name='I predicted that').click(); record().click()
    print(f'simulation: bars redraw on slider, sandboxed; storage from inside frame: {leak}; network from model code: {net or "blocked"}')
    b.close()
print('model calls:', len(calls)); check_errors(errors, allow=('about:srcdoc',))
