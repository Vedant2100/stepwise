from playwright.sync_api import sync_playwright, expect
from _env import BASE, LAUNCH, check_errors

# Both looks, phone and desktop: the sidebar never pushes the page down; on phones it's an off-screen drawer.
with sync_playwright() as pw:
    b = pw.chromium.launch(**LAUNCH)
    errs = []
    for look in ('solid', 'glass'):
        for w, h in ((390, 844), (1280, 800)):
            p = b.new_page(viewport={'width': w, 'height': h})
            p.on('pageerror', lambda e: errs.append(str(e)))
            p.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(body='', headers={'content-type': 'text/css'}))
            p.add_init_script(f"localStorage.setItem('stepwise.look', '{look}')")
            p.goto(BASE + '/')
            expect(p.get_by_role('heading', name='What do you want to learn?')).to_be_visible()
            side = p.locator('aside.side')
            pos = side.evaluate('e => getComputedStyle(e).position')
            box = side.bounding_box()
            if w < 900:
                assert pos == 'fixed', (look, w, pos)
                assert box['x'] + box['width'] <= 1, (look, w, box)
                p.get_by_role('button', name='Show sidebar').click()
                p.wait_for_timeout(400)
                assert side.bounding_box()['x'] >= -1 and side.bounding_box()['y'] <= 1, (look, w, side.bounding_box())
            else:
                assert pos == 'sticky', (look, w, pos)
            assert p.evaluate('document.scrollingElement.scrollHeight') <= h + 1, (look, w, 'page scrolls')
            p.close()
    print('sidebar is a drawer on phones and sticky on desktop, in both looks'); b.close()
check_errors(errs)
