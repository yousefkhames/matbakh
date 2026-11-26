/* Regenerates docs/screenshots/*.png from the real app with seeded demo data.
   Optional: EMOJI_FONT=/path/to/noto-color-emoji.woff2 when the machine has no emoji font. */
const path = require('path');
const puppeteer = require(process.env.PUPPETEER_PATH || 'puppeteer-core');
const serve = require('./serve.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = path.join(__dirname, '..', 'docs', 'screenshots');
(async () => {
  const srv = await serve(path.join(__dirname, '..')); const base = 'http://localhost:' + srv.address().port + '/index.html';
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: 'new' });
  const p = await browser.newPage();
  const fonts = async () => {
    if (!process.env.EMOJI_FONT) return;
    await p.addStyleTag({ content: "@font-face{font-family:NE;src:url(/__emoji.woff2) format('woff2');unicode-range:U+1F000-1FFFF,U+2300-23FF,U+2600-27BF,U+2B00-2BFF,U+FE0F} :root{--body:NE,system-ui,-apple-system,'Segoe UI',Tahoma,'Noto Sans Arabic',Arial,sans-serif;--disp:NE,'Iowan Old Style','Palatino Linotype',Georgia,'Noto Naskh Arabic',serif}" });
    await p.evaluate(() => document.fonts.load('30px NE', '🍲')); await sleep(300);
  };
  const go = async (hash) => { await p.goto(base + hash); await sleep(300); await fonts(); await sleep(250); };
  const shot = async (name, full) => { await p.screenshot({ path: path.join(out, name + '.png'), fullPage: !!full }); console.log('wrote', name); };
  const seed = (tpl) => p.evaluate((tpl) => {
    const s = window.__mb.state; const now = Date.now();
    const mk = (no, ty, tb, nm, st, age, l, note) => ({ id: 'o' + no, no, origin: '', type: ty, table: tb, name: nm, phone: nm ? '01012345678' : '', note: note || '', status: st, createdAt: now - age * 60000, updatedAt: now,
      lines: l.map(([i, q]) => ({ name: s.items[i].name, price: s.items[i].price, qty: q, note: '' })), totals: { sub: 0, service: 0, tax: 0, total: l.reduce((a, [i, q]) => a + s.items[i].price * q, 0) } });
    s.orders = [mk(5, 'pickup', '', 'Mona', 'new', 2, [[3, 1], [12, 2]]), mk(4, 'table', '7', '', 'preparing', 9, [[7, 2], [9, 1]]), mk(3, 'table', '2', '', 'ready', 4, [[4, 1]]), mk(2, 'table', '4', '', 'new', 17, [[0, 2], [1, 1], [10, 3]], 'من غير بصل'), mk(1, 'pickup', '', 'Omar', 'done', 50, [[8, 1]])];
    s.counter = { day: '', n: 5 };
    localStorage.setItem('matbakh.v1', JSON.stringify(s));
  });
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await go('#/menu'); await seed(); await go('#/menu'); await shot('menu-ar');
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('matbakh.v1')); s.ui.lang = 'en'; localStorage.setItem('matbakh.v1', JSON.stringify(s)); });
  await go('#/menu');
  await p.evaluate(() => { const a = [...document.querySelectorAll('.item .add')]; a[3].click(); }); await sleep(100);
  await p.evaluate(() => { document.querySelectorAll('.item .step button')[1].click(); document.querySelectorAll('.add')[5].click(); }); await sleep(100);
  await go('#/cart'); await shot('cart-en');
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('matbakh.v1')); s.ui.lang = 'ar'; localStorage.setItem('matbakh.v1', JSON.stringify(s)); });
  await go('#/kitchen'); await shot('kitchen-mobile');
  await go('#/studio'); await p.evaluate(() => [...document.querySelectorAll('.seg.tabs button')][2].click()); await sleep(300); await shot('studio-brand');
  await p.evaluate(() => [...document.querySelectorAll('.seg.tabs button')][1].click()); await p.waitForSelector('.qrcard svg'); await sleep(300); await shot('qr-sheet');
  await p.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1.5 });
  await go('#/kitchen'); await shot('kitchen-desktop');
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('matbakh.v1')); s.ui.lang = 'en'; localStorage.setItem('matbakh.v1', JSON.stringify(s)); });
  await go('#/orders'); await shot('orders-desktop');
  await browser.close(); srv.close();
})();
