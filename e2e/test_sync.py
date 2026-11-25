import json, secrets, re
from playwright.sync_api import sync_playwright, expect
from _env import BASE, LAUNCH, OUT, PYO, check_errors, route_reply
C = lambda i, n, t: {"id": i, "name": n, "type": t, "summary": f"About {n}.", "prereqs": []}
PLANS = {"Laptop goal": {"title": "Laptop goal", "concepts": [C("x", "Term one", "recall")]},
         "Phone goal": {"title": "Phone goal", "concepts": [C("y", "Term two", "recall")]}}
DRILL = {"cards": [{"front": "Q?", "back": "a"}]}
def llm(route):
    p = json.loads(route.request.post_data)["prompt"]
    if route_reply(p): return route.fulfill(json={"text": json.dumps(route_reply(p))})
    reply = next((v for k, v in PLANS.items() if k in p), DRILL) if "Break the objective" in p else DRILL
    route.fulfill(json={"text": json.dumps(reply)})
errors = []
USER = f'vedant{secrets.token_hex(3)}'  # unique per run: the dev server keeps accounts in memory
def setup(b, name, size):
    ctx = b.new_context(viewport=size)
    page = ctx.new_page(); page.route('**/api/llm', llm)
    page.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    page.goto(BASE + '/'); return ctx, page
def send(page, text):
    page.get_by_label('Message').fill(text); page.get_by_label('Message').press('Enter')
with sync_playwright() as pw:
    b = pw.chromium.launch(**LAUNCH)
    lctx, laptop = setup(b, 'laptop', {'width': 1280, 'height': 800})
    # progress before having an account
    send(laptop, 'Laptop goal'); expect(laptop.locator('.ws.open')).to_have_count(1)
    laptop.get_by_label('Your answer').fill('a'); laptop.get_by_label('Your answer').press('Enter')
    laptop.get_by_role('button', name='Record it').click()
    expect(laptop.get_by_text('100/100 on Term one')).to_be_visible()
    # create an account: local progress goes up with it
    laptop.get_by_role('button', name='Sign in to sync').click()
    dlg = laptop.get_by_role('dialog')
    dlg.get_by_role('button', name='Create an account').click()
    laptop.screenshot(path=f'{OUT}/auth.png')
    dlg.get_by_label('Username').fill(USER.capitalize()); dlg.get_by_label('Password').fill('correct horse')
    dlg.get_by_role('button', name='Create account').click()
    expect(dlg).to_have_count(0)
    expect(laptop.locator('.who')).to_contain_text(USER)
    expect(laptop.locator('.who small')).to_have_text('Synced', timeout=10000)
    print('1. laptop: progress made signed-out, then account created, synced')

    # second device: phone-sized, signs in, gets laptop progress
    pctx, phone = setup(b, 'phone', {'width': 390, 'height': 844})
    send(phone, 'Phone goal'); expect(phone.locator('.ws.open')).to_have_count(1)
    phone.get_by_role('button', name='Back to chat').click()
    phone.get_by_role('button', name='Show sidebar').click(); phone.get_by_role('button', name='Sign in to sync').click()
    dlg = phone.get_by_role('dialog')
    dlg.get_by_label('Username').fill(USER); dlg.get_by_label('Password').fill('wrong password')
    dlg.get_by_role('button', name='Sign in').click()
    expect(dlg.get_by_text('Wrong username or password.')).to_be_visible()
    phone.screenshot(path=f'{OUT}/auth-phone.png')
    dlg.get_by_label('Password').fill('correct horse'); dlg.get_by_role('button', name='Sign in').click()
    expect(dlg).to_have_count(0)
    phone.get_by_role('button', name='Show sidebar').click()
    expect(phone.locator('.goal')).to_have_count(2)
    expect(phone.locator('.who small')).to_have_text('Synced', timeout=10000)
    print('2. phone: wrong password refused; signed in; both objectives present (merge)')

    # laptop picks up the phone's objective after reload; then deletes one; phone sees deletion
    laptop.reload(); expect(laptop.locator('.goal')).to_have_count(2, timeout=10000)
    data = json.loads(laptop.evaluate("localStorage.getItem('stepwise.v1')"))
    assert all('updatedAt' in t for t in data['tracks'])
    laptop.locator('.goal', has_text='Phone goal').click()
    laptop.get_by_role('button', name='How am I doing?').click()
    laptop.once('dialog', lambda d: d.accept())
    laptop.locator('details.tr', has_text='Phone goal').locator('summary').click()
    laptop.locator('details.tr', has_text='Phone goal').get_by_role('button', name='Delete').click()
    expect(laptop.locator('.goal')).to_have_count(1)
    expect(laptop.locator('.who small')).to_have_text('Synced', timeout=10000)
    phone.reload(); phone.get_by_role('button', name='Show sidebar').click()
    expect(phone.locator('.goal')).to_have_count(1, timeout=10000)
    print('3. laptop reload sees phone objective; deletion on laptop reaches phone')

    # sign out clears this browser; signing back in restores
    phone.get_by_role('button', name='Settings').click()
    phone.get_by_role('dialog').get_by_role('button', name='Sign out').click()
    expect(phone.get_by_role('dialog').get_by_role('button', name='Sign in', exact=True)).to_be_visible()
    phone.screenshot(path=f'{OUT}/settings-phone.png')
    phone.get_by_role('button', name='Back').click()
    expect(phone.get_by_role('dialog')).to_have_count(0)
    phone.get_by_role('button', name='Show sidebar').click()
    expect(phone.locator('.goal')).to_have_count(0)
    cookies = pctx.cookies(); print('   cookie after sign-out:', [c['name'] for c in cookies if c['name'] == 'sw_session'] or 'cleared')
    lc = [c for c in lctx.cookies() if c['name'] == 'sw_session'][0]
    print(f"   session cookie flags: httpOnly={lc['httpOnly']} sameSite={lc['sameSite']}")
    print('4. sign out clears the shared device')
    b.close()
check_errors(errors)
