import json, time
from playwright.sync_api import sync_playwright, expect
from _env import BASE, LAUNCH, OUT, PYO, check_errors
now = int(time.time()*1000)
def con(i, n, pL, pre=None, review=None): return {"id": i, "name": n, "type": "recall", "summary": "s", "prereqs": pre or [], "pL": pL, "attempts": 2 if pL > .1 else 0, "misses": 0, "review": review}
cs = [con("a","Greetings",0.97, review={"due": now-1000, "interval": 1, "ease": 2.5, "reps": 1}), con("b","Ordering",0.9,["a"]), con("c","Paying",0.1,["b"]), con("d","Numbers",0.1)]
data = {"tracks": [{"id": "t1", "title": "Order food in Spanish", "objective": "Order food in Spanish", "source": "MY PRIVATE NOTES", "concepts": cs, "log": [], "createdAt": now-86400000*3}], "deleted": []}
DRILL = {"cards": [{"front": "Q?", "back": "a"}]}
errors = []
def page(b, seed=None, size={'width': 1280, 'height': 860}):
    p = b.new_context(viewport=size).new_page()
    p.route('**/api/llm', lambda r: r.fulfill(json={"text": json.dumps(DRILL)}))
    p.on('pageerror', lambda e: errors.append(str(e)))
    if seed: p.add_init_script(f"if (!sessionStorage.seeded) {{ localStorage.setItem('stepwise.v1', {json.dumps(json.dumps(seed))}); sessionStorage.seeded = 1 }}")
    return p
with sync_playwright() as pw:
    b = pw.chromium.launch(**LAUNCH)
    me = page(b, data); me.goto(BASE + '/')
    expect(me.get_by_text('Welcome back. 1 review due, about 2 min.')).to_be_visible()
    expect(me.get_by_role('button', name='Review now')).to_be_visible()
    me.wait_for_timeout(1000); me.screenshot(path=f'{OUT}/m1-welcome.png')
    print('1. fading-review nudge with Review now')

    # Finish an exercise on "Ordering" (0.9): pass -> mastered + unlock Paying
    me.locator('.side details.fold summary').first.click(); me.locator('.stair', has_text='Ordering').click(); 
    expect(me.locator('.ws.open')).to_have_count(1)
    me.get_by_label('Your answer').fill('a'); me.get_by_label('Your answer').press('Enter')
    me.get_by_role('button', name='Record it').click()
    expect(me.locator('.badge.mastered')).to_have_text('★ Mastered Ordering')
    expect(me.locator('.badge.unlocked')).to_have_text('↑ Unlocked Paying')
    expect(me.locator('.gain')).to_be_visible()
    me.wait_for_timeout(1200); me.screenshot(path=f'{OUT}/m2-badges.png')
    expect(me.locator('.today')).to_contain_text('Today 1/3')
    expect(me.locator('.today')).to_contain_text('1-day streak')
    print('2. progress bar + Mastered and Unlocked badges; today ring 1 of 3, streak started')

    me.get_by_role('button', name='Share').click()
    dlg = me.get_by_role('dialog'); dlg.get_by_role('button', name='Create link').click()
    url = dlg.get_by_label('Link to this climb').input_value()
    me.screenshot(path=f'{OUT}/m3-share.png')
    assert '/c/' in url, url; print('3. link created:', url)

    them = page(b, size={'width': 390, 'height': 844}); them.goto(url)
    expect(them.get_by_role('heading', name='Order food in Spanish')).to_be_visible()
    expect(them.get_by_text('MY PRIVATE NOTES')).to_have_count(0)
    them.wait_for_timeout(1000); them.screenshot(path=f'{OUT}/m4-shared.png', full_page=True)
    them.get_by_role('button', name='Start this climb').click()
    expect(them.locator('.ws.open')).to_have_count(1)
    them.get_by_role('button', name='Back to chat').click()
    them.get_by_role('button', name='Show sidebar').click()
    expect(them.locator('.goal')).to_have_text('Order food in Spanish0/4')
    print('4. visitor opened the link, started a fresh copy at the bottom (notes not included)')
    them.reload(); expect(them.locator('.goal')).to_have_count(1)
    bad = page(b); bad.goto(BASE + '/c/AAAAAAAAAA'); expect(bad.get_by_role('heading', name='Climb not found')).to_be_visible()
    print('5. reload does not duplicate; unknown link shows not found')
    b.close()
check_errors(errors)
