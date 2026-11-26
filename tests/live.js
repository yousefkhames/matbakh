/* Live relay check: owner turns on live orders, a customer phone sends an order, the kitchen receives it.
   Usage: node tests/live.js [baseUrl]. Needs internet (ntfy.sh) and puppeteer-core. */
const path = require('path');
const puppeteer = require(process.env.PUPPETEER_PATH || 'puppeteer-core');
const serve = require('./serve.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  let srv, base = process.argv[2];
  if (!base) { srv = await serve(path.join(__dirname, '..')); base = 'http://localhost:' + srv.address().port + '/'; }
  if (!base.endsWith('/')) base += '/';
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: 'new' });
  let bad = 0; const ok = (c, n) => { console.log((c ? '  ok   ' : '  FAIL ') + n); if (!c) bad++; };
  const errors = [];
  const owner = await (await browser.createBrowserContext()).newPage(); await owner.setViewport({ width: 390, height: 844 });
  owner.on('pageerror', (e) => errors.push(e.message));
  await owner.evaluateOnNewDocument(() => { window.open = () => null; });
  await owner.goto(base + '#/studio'); await sleep(500);
  await owner.evaluate(() => { [...document.querySelectorAll('button,[role=tab]')].find((b) => /Brand|الهوية/.test(b.textContent)).click(); });
  await sleep(300);
  await owner.evaluate(() => { const c = [...document.querySelectorAll('label.chk input')].pop(); c.click(); });
  await sleep(500);
  const topic = await owner.evaluate(() => window.__mb.state.brand.liveTopic);
  ok(/^mb[a-z0-9]{16,}$/.test(topic), 'owner enabled live orders, private topic created');
  await owner.evaluate(() => { [...document.querySelectorAll('button,[role=tab]')].find((b) => /Tables|الطاولات/.test(b.textContent)).click(); });
  await sleep(500);
  const link = await owner.evaluate(() => [...document.querySelectorAll('input[readonly]')].map((i) => i.value).find((v) => v.includes('#')) || '');
  ok(link.includes('#'), 'shared link available');
  await owner.goto(base + '#/kitchen'); await sleep(1500);
  const live = await owner.$eval('[data-live]', (e) => e.dataset.live).catch(() => 'none');
  ok(live === 'on', 'kitchen shows live connection (' + live + ')');
  const guest = await (await browser.createBrowserContext()).newPage(); await guest.setViewport({ width: 390, height: 844 });
  guest.on('pageerror', (e) => errors.push(e.message));
  await guest.goto(link); await sleep(1200);
  await guest.evaluate(() => document.querySelector('.add').click()); await sleep(200);
  await guest.evaluate(() => [...document.querySelectorAll('.cartbar button, .cartbar a, a[href*="cart"], button')].find((b) => /View order|شوف|عرض الطلب|الطلب/.test(b.textContent)).click()); await sleep(500);
  await guest.evaluate(() => { [...document.querySelectorAll('.form input')].forEach((i) => { i.value = i.getAttribute('inputmode') === 'tel' ? '01012345678' : i.getAttribute('inputmode') === 'numeric' ? '7' : 'Live Test'; i.dispatchEvent(new Event('input')); }); });
  const hasBtn = await guest.evaluate(() => [...document.querySelectorAll('button')].some((b) => /Send to kitchen now|ابعت للمطبخ دلوقتي/.test(b.textContent)));
  ok(hasBtn, 'customer sees the live send button');
  await guest.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Send to kitchen now|ابعت للمطبخ دلوقتي/.test(b.textContent)).click());
  await sleep(2500);
  const done = await guest.evaluate(() => document.querySelector('.done h1') && document.querySelector('.done h1').textContent);
  ok(/reached the kitchen|وصل شاشة المطبخ/.test(done || ''), 'customer sees confirmation: ' + done);
  let got = false;
  for (let i = 0; i < 12 && !got; i++) { await sleep(500); got = await owner.evaluate(() => window.__mb.state.orders.some((o) => o.name === 'Live Test')); }
  if (!got) console.log(JSON.stringify(await owner.evaluate(() => ({o: window.__mb.state.orders.map((o) => o.name), t: window.__mb.state.brand.liveTopic, hash: location.hash})))); ok(got, 'kitchen received the order live');
  await owner.reload(); await sleep(2500);
  const n = await owner.evaluate(() => window.__mb.state.orders.filter((o) => o.name === 'Live Test').length);
  ok(n === 1, 'reload does not duplicate the order (' + n + ')');
  ok(errors.length === 0, 'no page errors ' + errors.join('|'));
  await browser.close(); if (srv) srv.close();
  console.log(bad ? bad + ' FAILED' : 'LIVE PASS'); process.exit(bad ? 1 : 0);
})();
