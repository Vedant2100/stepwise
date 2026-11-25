import json, re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from _env import BASE, LAUNCH, OUT, PYO, check_errors, route_reply
C = lambda i, n, t: {"id": i, "name": n, "type": t, "summary": f"About {n}.", "prereqs": []}
PLAN = {"title": "CS fundamentals", "concepts": [C("read", "Reading loops", "reading"), C("order", "Steps of merge sort", "ordering"),
        C("data", "Summary statistics", "data"), C("algo", "Bubble sort", "algorithm")]}
EX = {
 "code-reading exercise": {"snippets": [
     {"code": "x = [1, 2, 3]\nprint(sum(x) * 2)", "ask": "What does this print?"},
     {"code": "for i in range(3):\n    print(i, end=' ')", "ask": "What does this print?"},
     {"code": "print(1/0)", "ask": "broken"}],
   "debug": {"brief": "`largest(xs)` returns the largest number.", "buggy": "def largest(xs):\n    m = 0\n    for x in xs:\n        if x > m:\n            m = x\n    return m\n",
             "reference": "def largest(xs):\n    m = xs[0]\n    for x in xs:\n        if x > m:\n            m = x\n    return m\n",
             "tests": [{"name": "positives", "code": "assert largest([1, 5, 2]) == 5"}, {"name": "negatives", "code": "assert largest([-3, -1, -2]) == -1"}]}},
 "sorting exercise": {"mode": "order", "prompt": "Put merge sort's steps in order.", "items": ["Split the list in half", "Sort each half recursively", "Merge the two sorted halves"], "why": "Divide, conquer, combine."},
 "data-exploration notebook": {"intro": "Some exam scores.", "setup": "scores = [70, 80, 90, 100]",
   "tasks": [{"ask": "Store the mean in `avg`.", "solution": "avg = sum(scores) / len(scores)", "check": "assert avg == 85"},
             {"ask": "Broken check", "solution": "z = 1", "check": "assert z == 2"}]},
 "algorithm-tracing exercise": {"brief": "Bubble sort on `[3, 1, 2]`; `array` after each swap.",
   "code": "a = [3, 1, 2]\nfor i in range(len(a)):\n    for j in range(len(a) - 1 - i):\n        if a[j] > a[j + 1]:\n            a[j], a[j + 1] = a[j + 1], a[j]\n            trace(array=a)\n",
   "questions": [{"ask": "Worst-case time complexity?", "choices": ["O(n)", "O(n^2)", "O(log n)"], "answer": 1, "why": "Nested passes."}]},
}
def llm(route):
    p = json.loads(route.request.post_data)["prompt"]
    if route_reply(p): return route.fulfill(json={"text": json.dumps(route_reply(p))})
    reply = PLAN if "Break the objective" in p else next(v for k, v in EX.items() if k in p)
    route.fulfill(json={"text": json.dumps(reply)})
def cdn(route):
    f = PYO / route.request.url.split('/full/')[1].split('?')[0]
    if not f.exists(): return route.fulfill(status=404, body='')
    ct = {'.wasm': 'application/wasm', '.json': 'application/json', '.zip': 'application/zip'}.get(f.suffix, 'text/javascript')
    route.fulfill(body=f.read_bytes(), headers={'content-type': ct, 'access-control-allow-origin': '*'})
errors = []
with sync_playwright() as pw:
    b = pw.chromium.launch(**LAUNCH)
    page = b.new_context(viewport={'width': 1320, 'height': 860}).new_page()
    page.route('**/api/llm', llm); page.route('https://cdn.jsdelivr.net/pyodide/**', cdn)
    page.on('pageerror', lambda e: errors.append(str(e))); page.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    page.goto(BASE + '/')
    page.get_by_label('Message').fill('CS fundamentals'); page.get_by_label('Message').press('Enter')
    ws = lambda: page.locator('.ws.open')
    shot = lambda n: page.screenshot(path=f'{OUT}/n-{n}.png')
    def open_concept(name):
        if ws().count(): ws().get_by_role('button', name='Back to chat').click()
        fold = page.locator('.side details.fold').first
        if fold.get_attribute('open') is None: fold.locator('summary').click()
        page.locator('.side .stair', has_text=name).click()

    # read & debug (first concept opens automatically)
    expect(ws().locator('.tab.on')).to_have_text('Read & debug', timeout=120000)
    expect(ws().get_by_text('Snippet 1 of 2')).to_be_visible()      # the erroring snippet was dropped
    ws().get_by_label('Predicted output').fill('12'); ws().get_by_role('button', name='Check').click()
    expect(ws().get_by_text('Correct.')).to_be_visible(); ws().get_by_role('button', name='Next snippet').click()
    ws().get_by_label('Predicted output').fill('0 1 2 3'); ws().get_by_role('button', name='Check').click()
    expect(ws().get_by_text('one try left')).to_be_visible()
    ws().get_by_label('Predicted output').fill('0 1 2'); ws().get_by_role('button', name='Check').click()
    expect(ws().get_by_text('Correct.')).to_be_visible(); shot('readcode'); ws().get_by_role('button', name='On to the bug').click()
    ws().get_by_role('button', name='Run tests').click()
    expect(ws().locator('.score')).to_contain_text('1/2', timeout=60000)
    ws().locator('.cm-content').last.click(); page.keyboard.press('Control+A'); page.keyboard.press('Delete')
    page.keyboard.insert_text("def largest(xs):\n    m = xs[0]\n    for x in xs:\n        if x > m:\n            m = x\n    return m\n")
    expect(ws().locator('.score')).to_contain_text('2/2', timeout=60000)
    ws().get_by_role('button', name=re.compile('^Record')).click()
    expect(page.get_by_text('85/100 on Reading loops')).to_be_visible()   # predictions 0.75*60 + 100*0.4
    print('read & debug: real outputs, bad snippet dropped, retry credit, bug fix reruns as typed, score 85')

    # sort & sequence with keyboard arrows
    open_concept('Steps of merge sort'); expect(ws().locator('.tab.on')).to_have_text('Sort & sequence')
    expect(ws().locator('.sortitem')).to_have_count(3)
    want = ["Split the list in half", "Sort each half recursively", "Merge the two sorted halves"]
    for target, item in enumerate(want):
        cur = [t.strip() for t in ws().locator('.sortitem .grow').all_inner_texts()].index(item)
        while cur > target:
            ws().get_by_role('button', name=f'Move {item} up').click(); cur -= 1
    ws().get_by_role('button', name='Check order').click()
    expect(ws().get_by_text('3/3')).to_be_visible(); shot('sort'); ws().get_by_role('button', name='Record it').click()
    print('sort & sequence: reordered with arrow buttons, 3/3')

    # notebook
    open_concept('Summary statistics'); expect(ws().locator('.tab.on')).to_have_text('Data notebook')
    expect(ws().get_by_text('Broken check')).to_have_count(0)        # its check failed on its own solution
    expect(ws().get_by_text('1 task(s) whose checks')).to_be_visible()
    cell = ws().locator('.cell').nth(1).locator('.cm-content')
    cell.click(); page.keyboard.press('Control+A'); page.keyboard.press('Delete')
    page.keyboard.insert_text("avg = sum(scores) / len(scores)\nprint('mean is', avg)\navg * 2"); page.keyboard.press('Shift+Enter')
    expect(ws().locator('.cellout').last).to_contain_text('170.0')
    ws().get_by_role('button', name='Check my work').click()
    expect(ws().get_by_role('button', name='Record 100/100')).to_be_visible(); shot('notebook')
    ws().get_by_role('button', name='Record 100/100').click()
    print('notebook: setup ran, shared namespace, value + stdout shown, hidden check passed, broken task removed')

    # tracer
    open_concept('Bubble sort'); expect(ws().locator('.tab.on')).to_have_text('Algorithm tracer')
    expect(ws().get_by_text('Step 1 of 2')).to_be_visible()
    ws().get_by_label('Value of array').fill('[1, 3, 2]'); ws().get_by_label('Value of array').press('Enter')
    expect(ws().get_by_text('Right.')).to_be_visible(); ws().get_by_role('button', name='Next step').click()
    expect(ws().get_by_label('Value of array')).to_have_value('[1,3,2]')   # prefilled with the previous state
    ws().get_by_label('Value of array').fill('(1, 2, 3)'); ws().get_by_role('button', name='Check step').click()
    expect(ws().get_by_text('Right.')).to_be_visible(); shot('trace-step')
    ws().get_by_role('button', name='On to the questions').click()
    ws().get_by_label('O(n^2)').check()
    expect(ws().get_by_role('button', name='Record it')).to_be_visible(); shot('trace-done'); ws().get_by_role('button', name='Record it').click()
    expect(page.get_by_text('100/100 on Bubble sort')).to_be_visible()
    print('tracer: steps checked against the real run, python tuple syntax accepted, complexity question')
    b.close()
check_errors(errors)
