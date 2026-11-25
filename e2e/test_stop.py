from playwright.sync_api import sync_playwright, expect
from _env import BASE, LAUNCH, OUT, PYO, check_errors
with sync_playwright() as pw:
    b = pw.chromium.launch(**LAUNCH)
    p = b.new_page(); errs = []
    p.on('pageerror', lambda e: errs.append(str(e)))
    p.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(body='', headers={'content-type': 'text/css'}))
    p.route('**/api/llm', lambda r: None)   # never answers
    p.goto(BASE + '/')
    p.get_by_label('Message').fill('Learn vectors'); p.get_by_label('Message').press('Enter')
    expect(p.get_by_text('Planning')).to_be_visible()
    p.get_by_role('button', name='Stop').click()
    expect(p.get_by_text('Stopped.')).to_be_visible()
    expect(p.get_by_role('button', name='Stop')).to_have_count(0)
    expect(p.locator('.msg.err')).to_have_count(0)
    p.get_by_label('Message').fill('again'); expect(p.get_by_role('button', name='Start')).to_be_enabled()
    print('stop works; composer usable again'); p.unroute_all(behavior='ignoreErrors'); b.close()
check_errors(errs)
