import json
from playwright.sync_api import sync_playwright, expect
from _env import BASE, LAUNCH, check_errors

# Without a code the message is held; entering the code in the chat sends it, with no retyping.
calls = []
def llm(route):
    req = route.request
    body = json.loads(req.post_data)
    calls.append((req.headers.get('x-access-code', ''), body['prompt']))
    if req.headers.get('x-access-code') != 'good':
        return route.fulfill(status=401, json={'error': 'Access code required.'})
    route.fulfill(json={'text': json.dumps({'action': 'chat', 'say': 'Hello there.', 'suggest': []})})

with sync_playwright() as pw:
    b = pw.chromium.launch(**LAUNCH)
    p = b.new_page(); errs = []
    p.on('pageerror', lambda e: errs.append(str(e)))
    p.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(body='', headers={'content-type': 'text/css'}))
    p.route('**/api/llm', llm)
    p.goto(BASE + '/')
    p.get_by_label('Message').fill('hi'); p.get_by_label('Message').press('Enter')
    code = p.locator('.msg').get_by_label('Access code')
    expect(code).to_be_visible()
    code.fill('nope'); code.press('Enter')
    expect(p.get_by_text('That code didn’t work. Try again.')).to_be_visible()
    expect(p.locator('.msg').get_by_label('Access code')).to_have_count(1)
    p.locator('.msg').get_by_label('Access code').fill('good')
    p.get_by_role('button', name='Continue').click()
    expect(p.get_by_text('Hello there.')).to_be_visible()
    expect(p.locator('.msg').get_by_label('Access code')).to_have_count(0)
    expect(p.locator('.msg.me')).to_have_count(1)
    assert [c for c, _ in calls] == ['', 'nope', 'good'], calls
    assert len({prompt for _, prompt in calls}) == 1
    print('access code entered in chat; the held message went through once'); b.close()
check_errors(errs)
