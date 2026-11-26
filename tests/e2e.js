/* Real-browser click-through. Usage: node tests/e2e.js [baseUrl]   (default: serves this folder locally)
   Needs puppeteer-core and a Chrome/Chromium (CHROME env or /usr/bin/google-chrome). */
const path = require('path'), fs = require('fs'), os = require('os');
const puppeteer = require(process.env.PUPPETEER_PATH || 'puppeteer-core');
const serve = require('./serve.js');
// DOM-level click: sticky headers and the bottom bar can sit on top of an element puppeteer scrolled to
const EH = puppeteer.ElementHandle.prototype;
EH.click = async function (o) { await this.evaluate((e) => { e.scrollIntoView({ block: 'center' }); e.click(); }); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0; const failures = [];
function ok(cond, name) { if (cond) { passed++; console.log('  ok   ' + name); } else { failures.push(name); console.log('  FAIL ' + name); } }

(async () => {
  let srv, base = process.argv[2];
  if (!base) { srv = await serve(path.join(__dirname, '..')); base = 'http://localhost:' + srv.address().port + '/'; }
  if (!base.endsWith('/')) base += '/';
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: 'new' });
  const errors = [];
  const newPage = async (ctx, w = 390, h = 844) => {
    const p = await ctx.newPage(); await p.setViewport({ width: w, height: h });
    p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()); });
    await p.evaluateOnNewDocument(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
    return p;
  };
  const clickText = async (p, sel, text) => {
    const h = await p.evaluateHandle((sel, text) => [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().includes(text)), sel, text);
    const el = h.asElement(); if (!el) throw new Error('no element ' + sel + ' ~ ' + text);
    await el.click(); await sleep(120);
  };
  const count = (p, sel) => p.$$eval(sel, (e) => e.length);
  const text = (p, sel) => p.$eval(sel, (e) => e.textContent);
  const lastToast = (p) => p.evaluate(() => { const t = document.querySelectorAll('.toast'); return t.length ? t[t.length - 1].textContent : ''; });
  const state = (p) => p.evaluate(() => JSON.parse(JSON.stringify(window.__mb.state)));

  console.log('Owner flow');
  const ctx = await browser.createBrowserContext();
  const a = await newPage(ctx);
  await a.goto(base + '#/menu'); await sleep(400);
  ok((await a.evaluate(() => document.documentElement.dir)) === 'rtl', 'Arabic default sets dir=rtl');
  ok((await count(a, '.item')) >= 18, 'menu renders items (incl. popular strip)');
  ok((await count(a, '.nav .tab')) === 5, 'staff nav present');

  // language switch
  await clickText(a, '.langbtn', 'English');
  ok((await a.evaluate(() => document.documentElement.dir)) === 'ltr' && /Menu/.test(await text(a, '.tab.on')), 'switch to English flips direction and labels');
  await clickText(a, '.langbtn', 'العربية');
  await clickText(a, '.langbtn', 'English');

  // search
  await a.type('.search', 'koshary'); await sleep(200);
  ok((await count(a, '.item')) === 1, 'search filters to one item');
  await a.$eval('.search', (e) => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(200);

  // cart
  const addBtns = await a.$$('.item .add'); await addBtns[3].click(); await sleep(100);
  await (await a.$('.item .step button:last-child')).click(); await sleep(100);
  ok((await text(a, '.cb-n')) === '2', 'cart bar shows 2 items after + twice');
  await a.click('.cartbar'); await sleep(200);
  ok((await count(a, '.line')) === 1, 'cart page lists the line');

  // validation: pickup requires name and phone
  await clickText(a, '.seg button', 'Pickup');
  await clickText(a, '.btn.primary', 'Send to kitchen');
  ok(/name/i.test(await text(a, '.err')), 'pickup without name shows error');
  const inputs = await a.$$('.form .fld input'); // name, phone, note
  await inputs[0].type('Mona'); await inputs[1].type('01012345678');
  await clickText(a, '.btn.primary', 'Send to kitchen'); await sleep(250);
  ok(/done/.test(await a.evaluate(() => location.hash)), 'order placed, confirmation screen shown');
  ok(/#1/.test(await text(a, '.bigno')), 'first order number is #1');
  let st = await state(a);
  ok(st.orders.length === 1 && st.orders[0].status === 'new' && st.orders[0].totals.total === st.orders[0].lines[0].price * 2, 'order stored with correct total');

  ok(/^\(1\)/.test(await a.title()), 'tab title shows the count of new orders');
  // kitchen
  await a.goto(base + '#/kitchen'); await sleep(300);
  ok((await text(a, '.tab[href="#/kitchen"] .badge')) === '1', 'kitchen badge shows 1 new');
  await clickText(a, '.k-tabs button', 'New').catch(() => {});
  ok((await count(a, '.ticket')) >= 1, 'ticket visible on kitchen screen');
  await clickText(a, '.ticket .go', 'Start');
  ok((await state(a)).orders[0].status === 'preparing', 'Start moves order to preparing');
  await clickText(a, '.k-tabs button', 'Preparing');
  await clickText(a, '.ticket .go', 'Mark ready');
  ok((await state(a)).orders[0].status === 'ready', 'Mark ready moves order to ready');
  await clickText(a, '.k-tabs button', 'Ready');
  await clickText(a, '.ticket .mini', '💬');
  ok((await a.evaluate(() => window.__opened[0] || '')).startsWith('https://wa.me/201012345678?text='), 'Ready WhatsApp button opens wa.me with the customer number');
  await clickText(a, '.ticket .go', 'Handed over');
  ok((await state(a)).orders[0].status === 'done', 'Handed over completes the order');

  // orders page
  await a.goto(base + '#/orders'); await sleep(300);
  ok((await count(a, '.orow')) === 1 && (await count(a, '.stat')) === 3, 'orders page lists the order with stats');
  ok(/EGP/.test(await text(a, '.stat b')), 'sales stat uses the currency');

  // studio: menu editor
  await a.goto(base + '#/studio'); await sleep(300);
  await clickText(a, '.toolrow .btn', 'Add item'); await sleep(200);
  const mi = await a.$$('dialog[open] input');
  await mi[1].type('Test Falafel'); await mi[4].evaluate((e) => e.select()); await mi[4].type('12.5');
  await clickText(a, 'dialog[open] .btn', 'Save'); await sleep(250);
  st = await state(a);
  ok(st.items.some((i) => i.name.en === 'Test Falafel' && i.price === 12.5), 'new menu item saved');
  const sw = await a.$('.edit-row .sw input'); await sw.click(); await sleep(150);
  ok((await state(a)).items[0].available === false, 'availability switch marks item sold out');

  // brand editing
  await clickText(a, '.seg.tabs button', 'Brand'); await sleep(200);
  const nameEn = (await a.$$('.form .two input'))[1];
  await nameEn.evaluate((e) => e.select()); await nameEn.type('Zaman Cafe'); await a.keyboard.press('Tab'); await sleep(200);
  ok((await state(a)).brand.name.en === 'Zaman Cafe', 'brand name editable');
  await a.$eval('input[type=color]', (e) => { e.value = '#aa3355'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
  ok((await a.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--p').trim())) === '#aa3355', 'main color applies live to the theme');
  ok((await state(a)).brand.colors.primary === '#aa3355', 'color persisted');
  const wa = (await a.$$('.form .two input')).find(Boolean);
  await a.$$eval('input[inputmode=tel]', (els) => { els[0].value = '01099998888'; els[0].dispatchEvent(new Event('change', { bubbles: true })); });
  await a.$$eval('select', (els) => { const s = els.find((e) => [...e.options].some((o) => o.value === 'before')); s.value = 'before'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await sleep(150);
  st = await state(a);
  ok(st.brand.whatsapp === '01099998888' && st.brand.currency.pos === 'before', 'whatsapp number and currency position saved');

  // tables & QR + shared link
  await clickText(a, '.seg.tabs button', 'Tables'); await a.waitForSelector('.qrcard svg', { timeout: 5000 }); await sleep(200);
  ok((await count(a, '.qrcard svg')) === 9, 'QR sheet has pickup + 8 table codes');
  const link = await a.$eval('.pane input[readonly]', (e) => e.value);
  ok(/#\/menu\?d=z/.test(link), 'share link carries compressed menu payload');
  ok(link.length < 2500, 'share link small enough for a scannable QR (' + link.length + ' chars)');

  console.log('Guest (customer phone) flow');
  const ctx2 = await browser.createBrowserContext(); // separate storage = another phone
  const g = await newPage(ctx2);
  const tlink = link.replace('#/menu?', '#/menu?t=5&');
  await g.goto(tlink.replace(/^https?:\/\/[^/]+\//, base)); await g.waitForSelector('.item', { timeout: 5000 }); await sleep(300);
  ok(/^(ar)$/.test(await g.evaluate(() => document.documentElement.lang)), 'guest opens in the restaurant default language (Arabic)');
  await clickText(g, '.langchip', 'English');
  ok((await count(g, '.nav')) === 0, 'guest sees no staff navigation');
  ok(/Zaman Cafe|مطبخ/.test(await text(g, '.hero h1')) && /Zaman/.test(await text(g, '.hero h1')), 'guest sees the owner branding from the link');
  ok(/5/.test(await text(g, '.chip.solid')), 'table number from QR is shown');
  ok((await g.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--p').trim())) === '#aa3355', 'guest gets the owner color');
  ok((await count(g, '.item.off')) >= 1, 'sold-out item is shown as sold out');
  await (await g.$('.item:not(.off) .add')).click(); await sleep(100);
  await (await g.$('.item .step button:last-child')).click(); await sleep(100);
  await g.click('.cartbar'); await sleep(250);
  ok(/table|Table/i.test(await text(g, '.seg button.on')), 'guest checkout defaults to At the table');
  await clickText(g, '.btn.primary', 'WhatsApp'); await sleep(200);
  const waUrl = await g.evaluate(() => window.__opened[0] || '');
  ok(waUrl.startsWith('https://wa.me/201099998888?text='), 'guest order opens WhatsApp to the restaurant number');
  const waText = decodeURIComponent(waUrl.split('?text=')[1] || '');
  ok(/MB1\./.test(waText) && /Zaman Cafe/.test(waText), 'WhatsApp text has restaurant name and order code');
  ok(/done/.test(await g.evaluate(() => location.hash)) && (await count(g, '.wa-text')) === 1, 'guest confirmation screen with copyable text');
  await g.goto('about:blank');

  console.log('Import WhatsApp order into kitchen');
  await a.goto(base + '#/kitchen'); await sleep(300);
  const before = (await state(a)).orders.length;
  const doImport = async () => {
    await clickText(a, '.k-tools .btn', 'Import'); await sleep(150);
    await a.$eval('dialog textarea', (t, v) => { t.value = v; }, 'Hello from WhatsApp\n' + waText + '\nthanks');
    await clickText(a, 'dialog .btn.primary', 'Import'); await sleep(250);
  };
  await doImport();
  st = await state(a);
  ok(st.orders.length === before + 1 && st.orders[0].table === '5' && st.orders[0].status === 'new', 'pasted WhatsApp message becomes a kitchen order');
  await doImport(); if (await a.$('dialog[open]')) await a.keyboard.press('Escape');
  await sleep(150);
  ok((await state(a)).orders.length === before + 1, 'importing the same message twice does not duplicate');
  await clickText(a, '.k-tools .btn', 'Import'); await a.$eval('dialog textarea', (t) => { t.value = 'no code here'; });
  await clickText(a, 'dialog .btn.primary', 'Import'); await sleep(150);
  ok((await count(a, 'dialog[open]')) === 1 && /valid/i.test(await lastToast(a)), 'garbage text is rejected with a message');
  await a.keyboard.press('Escape'); await sleep(150);

  console.log('Cross-tab live update');
  const b2 = await newPage(ctx); await b2.goto(base + '#/kitchen'); await sleep(300);
  const n0 = await count(b2, '.ticket');
  await a.goto(base + '#/menu'); await sleep(200);
  await (await a.$('.item:not(.off) .add')).click(); await a.click('.cartbar'); await sleep(200);
  await a.$$eval('.form .fld input', (els) => { els[0].value = '9'; els[0].dispatchEvent(new Event('input', { bubbles: true })); });
  await clickText(a, '.btn.primary', 'Send to kitchen'); await sleep(500);
  ok((await count(b2, '.ticket')) === n0 + 1, 'second tab shows the new ticket without reload');
  await b2.close();

  console.log('Data: export / import');
  const dl = fs.mkdtempSync(path.join(os.tmpdir(), 'mbdl-'));
  const cdp = await browser.target().createCDPSession(); await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl, browserContextId: ctx.id });
  await a.goto(base + '#/studio'); await sleep(250);
  await clickText(a, '.seg.tabs button', 'Data');
  await clickText(a, '.datagrid .btn', 'Export brand'); await sleep(700);
  const files = fs.readdirSync(dl).filter((f) => f.endsWith('.json'));
  ok(files.length === 1, 'brand export downloads a JSON file');
  const exp = JSON.parse(fs.readFileSync(path.join(dl, files[0]), 'utf8'));
  ok(exp.app === 'matbakh' && exp.brand.name.en === 'Zaman Cafe' && exp.items.some((i) => i.name.en === 'Test Falafel') && !exp.orders, 'export has brand + menu and no orders');
  // import into a fresh browser profile
  const ctx3 = await browser.createBrowserContext(); const c = await newPage(ctx3);
  await c.goto(base + '#/studio'); await sleep(300); await clickText(c, '.langbtn', 'English'); await clickText(c, '.seg.tabs button', 'Data');
  const fi = await c.$('input[type=file]'); await fi.uploadFile(path.join(dl, files[0])); await sleep(500);
  ok((await state(c)).brand.name.en === 'Zaman Cafe', 'exported file imports into a fresh browser');
  fs.writeFileSync(path.join(dl, 'bad.json'), '{"hello":1}');
  await fi.uploadFile(path.join(dl, 'bad.json')); await sleep(300);
  ok(/valid/i.test(await lastToast(c)) && (await state(c)).brand.name.en === 'Zaman Cafe', 'invalid import is rejected and keeps existing data');
  // template
  await clickText(c, '.tpl', 'Fast food'); await sleep(150); await clickText(c, 'dialog .btn.primary', 'Save'); await sleep(250);
  ok((await state(c)).brand.name.en === 'Burger House', 'template replaces brand + menu');
  await c.close();

  console.log('Robustness');
  const d = await newPage(await browser.createBrowserContext());
  await d.goto(base + '#/menu?d=zNOTVALID'); await sleep(600);
  ok((await count(d, '.done h1')) === 1, 'broken share link shows a clear message instead of crashing');
  await d.goto(base + '#/menu'); await d.evaluate(() => localStorage.setItem('matbakh.v1', '{broken'));
  await d.reload(); await sleep(400);
  ok((await count(d, '.item')) > 0, 'corrupt localStorage falls back to the default menu');
  const xss = '<img src=x onerror="window.__x=1">';
  await d.evaluate((x) => { const s = JSON.parse(JSON.stringify(window.__mb.state)); s.items[0].name.en = x; localStorage.setItem('matbakh.v1', JSON.stringify(s)); }, xss);
  await d.reload(); await sleep(400);
  ok(!(await d.evaluate(() => window.__x)) && (await count(d, '.item img')) === 0, 'item names containing HTML are shown as text, not executed');
  // desktop layout
  await d.setViewport({ width: 1280, height: 800 }); await d.goto(base + '#/kitchen'); await sleep(300);
  ok((await d.evaluate(() => getComputedStyle(document.querySelector('.k-board')).gridTemplateColumns.split(' ').length)) === 3, 'desktop kitchen shows 3 columns');

  ok(errors.length === 0, 'no console or page errors (' + errors.slice(0, 3).join(' | ') + ')');
  await browser.close(); if (srv) srv.close();
  console.log('\n' + passed + ' passed, ' + failures.length + ' failed');
  if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
