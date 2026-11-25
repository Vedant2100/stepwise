import json, re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from _env import BASE, LAUNCH, OUT, PYO, check_errors

SOURCE = ("Attention computes a weighted sum of values. Weights come from a softmax over scaled dot products. "
          "The scaling factor is one over the square root of the key dimension. ") * 6   # > 800 chars: treated as source
PLAN = {"title": "Attention", "concepts": [
  {"id": "weighted-sum", "name": "Attention as a weighted sum", "type": "concept", "summary": "Why attention mixes values.", "prereqs": [], "quote": "Attention computes a weighted sum of values"},
  {"id": "softmax", "name": "Softmax by hand", "type": "procedure", "summary": "Compute softmax weights.", "prereqs": ["weighted-sum"], "quote": "Weights come from a softmax"},
  {"id": "impl", "name": "Implement softmax", "type": "skill", "summary": "Code it.", "prereqs": [], "quote": "this quote is invented"},
  {"id": "terms", "name": "Key terms", "type": "recall", "summary": "Names.", "prereqs": [], "quote": "square root of the key dimension"}]}
EX = {
  "explain-it-back question": {"question": "Why is attention a weighted sum?", "rubric": ["values are mixed", "weights sum to 1"], "reference": "Because..."},
  "worked problem": {"problem": "Softmax of [0, 0]", "steps": [{"expected": "exp gives [1,1]", "hint": "exponentiate"}, {"expected": "[0.5, 0.5]", "hint": "normalise"}]},
  "Python coding exercise": {"brief": "Write `softmax(xs)`.", "starter": "def softmax(xs):\n    pass\n", "hints": ["use math.exp"],
     "reference": "import math\ndef softmax(xs):\n    e = [math.exp(x) for x in xs]\n    return [v / sum(e) for v in e]\n",
     "tests": [{"name": "sums to one", "code": "assert abs(sum(softmax([1,2,3])) - 1) < 1e-9"}, {"name": "uniform", "code": "assert softmax([0,0]) == [0.5,0.5]"}, {"name": "bad", "code": "assert softmax([0,0]) == [1,0]"}]},
  "retrieval drill": {"cards": [{"front": "Scaling factor?", "back": "1/sqrt(d_k)"}, {"front": "Normaliser?", "back": "softmax"}]},
}
ROUTES = {"hi there": {"action": "chat", "say": "Hi! You're 2 steps up Attention. Ready for the next one?", "suggest": ["next", "progress"]},
          "how am i doing": {"action": "progress", "say": "Here's where you are."},
          "switch to steps": {"action": "switch", "env": "steps", "say": ""},
          "what is a softmax": {"action": "help", "say": "Think about turning scores into probabilities."},
          "next": {"action": "next", "say": ""}}
calls = []
histories = []

def llm(route):
    p = json.loads(route.request.post_data)["prompt"]
    calls.append(p[:30])
    if "Decide what it is" in p: reply = {"kind": "notes", "objective": "", "missing": []}
    elif "LEARNER SAYS" in p:
        histories.append(json.loads(route.request.post_data).get("history") or [])
        said = re.search(r'LEARNER SAYS: """(.*?)"""', p, re.S).group(1).lower()
        reply = next((v for k, v in ROUTES.items() if k in said), {"action": "chat", "say": "ok"})
    elif "Break the objective" in p: reply = PLAN
    elif "Grade strictly" in p: reply = {"score": 85, "verdict": "Solid.", "points": [{"met": True, "note": ""}, {"met": False, "note": "never said they sum to one"}]}
    elif "Is the learner's step correct" in p: reply = {"ok": True, "feedback": ""}
    else: reply = next(v for k, v in EX.items() if k in p)
    route.fulfill(json={"text": json.dumps(reply)})

def cdn(route):
    f = PYO / route.request.url.split('/full/')[1].split('?')[0]
    if not f.exists(): return route.fulfill(status=404, body='')
    ct = {'.wasm': 'application/wasm', '.json': 'application/json', '.zip': 'application/zip'}.get(f.suffix, 'text/javascript')
    route.fulfill(body=f.read_bytes(), headers={'content-type': ct, 'access-control-allow-origin': '*'})

errors = []
with sync_playwright() as pw:
    b = pw.chromium.launch(**LAUNCH)
    page = b.new_context(viewport={'width': 1100, 'height': 900}).new_page()
    page.route('**/api/llm', llm); page.route('https://cdn.jsdelivr.net/pyodide/**', cdn)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    page.goto(BASE + '/')
    msg = page.get_by_label('Message')
    send = lambda t: (msg.fill(t), msg.press('Enter'))
    ws = lambda: page.locator('.ws.open')
    expect(page.get_by_role('heading', name='What do you want to be able to do?')).to_be_visible()

    send(SOURCE)
    expect(page.get_by_text("I’ll treat that as source material")).to_be_visible()
    expect(page.locator('.pkg')).to_contain_text('Pasted text')
    send('Understand and implement attention')
    expect(page.get_by_text('4 concepts, each with the practice')).to_be_visible()
    expect(page.locator('.warn')).to_have_count(1)
    print('1. paste read as notes -> source; objective -> plan (1 ungrounded quote flagged)')

    expect(ws().locator('.chip')).to_have_text('Explain it back')
    ws().get_by_label('Your explanation').fill('Attention mixes values with softmax weights.')
    ws().get_by_role('button', name='Submit').click()
    expect(ws().get_by_text('Solid.')).to_be_visible()
    expect(ws().get_by_text('never said they sum to one')).to_be_visible()
    ws().get_by_role('button', name='Record it').click()
    expect(ws()).to_have_count(0)
    expect(page.get_by_text('85/100 on Attention as a weighted sum')).to_be_visible()
    print('2. explain-back graded point by point, workspace closes, score reported')

    page.get_by_role('button', name='Next exercise').last.click()
    expect(ws().locator('.chip')).to_have_text('Code sandbox', timeout=120000)
    expect(ws().get_by_text('1 disagreeing test(s) removed')).to_be_visible()
    ws().get_by_role('button', name='Run tests').click()
    expect(ws().get_by_text('0/2')).to_be_visible(timeout=120000)
    ws().locator('.cm-content').click(); page.keyboard.press('Control+A'); page.keyboard.press('Delete')
    page.keyboard.insert_text("import math\ndef softmax(xs):\n    e=[math.exp(x) for x in xs]\n    return [v/sum(e) for v in e]\n")
    ws().get_by_role('button', name='Run tests').click()
    expect(ws().get_by_text('2/2')).to_be_visible(timeout=60000)
    page.screenshot(path=f'{OUT}/chat-code-light.png')
    ws().get_by_role('button', name=re.compile('Record 100')).click()
    print('3. code sandbox: real Python, the bad generated test dropped')

    page.get_by_role('button', name='Next exercise').last.click()
    expect(ws().locator('.chip')).to_have_text('Retrieval drill')
    ws().get_by_label('Your answer').fill('1/sqrt(d_k)'); ws().get_by_label('Your answer').press('Enter')
    ws().get_by_label('Your answer').fill('normalize'); ws().get_by_role('button', name='Check').click()
    ws().get_by_role('button', name='Missed it').click()
    ws().get_by_role('button', name='Record it').click()
    print('4. retrieval drill')

    page.get_by_role('button', name='Next exercise').last.click()
    expect(ws().locator('.chip')).to_have_text('Retrieval drill')
    ws().get_by_role('button', name='Back to chat').click()
    send('switch to steps please')
    expect(ws().locator('.chip')).to_have_text('Step workspace')
    expect(page.locator('.launch').nth(-2)).to_contain_text('Switched to another workspace')
    ws().get_by_role('button', name='Back to chat').click()
    send('what is a softmax?')
    expect(page.get_by_text('Think about turning scores')).to_be_visible()
    page.get_by_role('button', name='Open workspace').last.click()
    for k, a in enumerate(['exp gives 1,1', '0.5 each']):
        ws().get_by_label('Current step').fill(a); ws().get_by_role('button', name='Check step').click()
        expect(ws().get_by_text(f'{k + 1} of 2 steps')).to_be_visible()
    ws().get_by_role('button', name='Record it').click()
    print('5. switch via chat -> step workspace; a question is answered while it is open')

    send('how am i doing')
    expect(page.locator('details.tr')).to_have_count(1)
    page.get_by_role('button', name='Settings').click()
    page.get_by_role('radio', name='Dark').click(); page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/settings.png')
    page.get_by_role('button', name='Close settings').click()
    expect(page.locator('html')).to_have_attribute('data-theme', 'dark')
    page.locator('details.tr summary').last.click()
    page.screenshot(path=f'{OUT}/chat-progress-dark.png')
    print('6. progress card + dark mode')

    send('hi there')
    expect(page.get_by_text("Hi! You're 2 steps up Attention")).to_be_visible()
    reply = page.locator('.msg.t').last
    expect(reply.get_by_role('button', name='Next exercise')).to_be_visible()
    expect(reply.get_by_role('button', name='How am I doing?')).to_be_visible()
    last = histories[-1]
    assert last and last[-1]['role'] == 'assistant' and any('how am i doing' in m['content'] for m in last), last
    reply.get_by_role('button', name='How am I doing?').click()
    expect(page.locator('details.tr')).to_have_count(2)
    print('6b. greeting answered with suggestion buttons; recent conversation sent as history')

    page.reload()
    expect(page.get_by_text('Welcome back. 1 objective')).to_be_visible()
    t = json.loads(page.evaluate("localStorage.getItem('stepwise.v1')"))['tracks'][0]
    log = [(l['conceptId'], l['env'], l['defaultEnv'], l['score']) for l in t['log']]
    assert [x[0] for x in log] == ['weighted-sum', 'impl', 'terms', 'terms'] and log[-1][1] == 'steps' and log[-1][2] == 'drill', log
    print('7. persisted; log records recommended vs used environment:', log)
    b.close()
print('model calls:', len(calls)); check_errors(errors)
