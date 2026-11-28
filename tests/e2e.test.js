const assert = require('node:assert/strict'), { serve, launch } = require('./cdp.js');
(async () => {
  const srv = await serve(8125); const b = await launch(); let fail = 0;
  const step = async (n, f) => { try { await f(); console.log('ok  ' + n); } catch (e) { fail++; console.log('FAIL ' + n + ' ' + e.message); } };
  try {
    const U = 'http://127.0.0.1:8125/'; let code = '';
    await b.goto(U + '#/t/5');
    await step('demo banner, table badge, byline', async () => { const t = await b.text(); assert.match(t, /وضع تجريبي/); assert.match(t, /طاولة 5/); assert.match(t, /من تطوير يوسف خميس/); });
    await step('add items and prepare order without a number: copy only, no wa link', async () => {
      await b.click('.add'); await b.click('.add'); await b.click('#open-bag'); await b.waitFor("document.querySelector('#prepare')"); await b.click('#prepare');
      await b.waitFor("document.querySelector('#order-text')"); assert.ok(await b.eval("!document.querySelector('#wa-link')"));
      const t = await b.eval("document.querySelector('#order-text').textContent"); assert.match(t, /طلب تجريبي/); assert.match(t, /MB1\./); code = t;
    });
    await step('kitchen imports the order once, shows demo tag, advances status', async () => {
      await b.eval("location.hash='#/kitchen'"); await b.waitFor("document.querySelector('#k-paste')");
      await b.type('#k-paste', code); await b.click('#k-import'); await b.waitFor("document.querySelector('.ticket')");
      assert.equal(await b.eval("document.querySelector('[data-status=new] .ticket') ? 1 : 0"), 1); assert.match(await b.text(), /تجريبي/);
      await b.type('#k-paste', code); await b.click('#k-import'); assert.equal(await b.eval("document.querySelectorAll('.ticket').length"), 1);
      await b.click('.next'); assert.equal(await b.eval("document.querySelector('[data-status=preparing] .ticket') ? 1 : 0"), 1);
    });
    await step('clear demo orders', async () => { await b.click('#k-clear-demo'); await b.waitFor("!document.querySelector('.ticket')"); });
    await step('table cards render qr per table', async () => {
      await b.eval("location.hash='#/tables'"); await b.waitFor("document.querySelector('#t-url')"); await b.type('#t-url', 'https://yousefkhames.github.io/matbakh/');
      assert.equal(await b.eval("document.querySelectorAll('.tcard .qrbox svg').length"), 8);
    });
    await step('no script errors', async () => assert.deepEqual(b.logs, []));
    await b.viewport(412, 860, true); await b.eval("location.hash='#/t/5'"); await b.shot('/tmp/matbakh-menu.png');
    await b.eval("location.hash='#/kitchen'"); await b.type('#k-paste', code); await b.click('#k-import'); await b.viewport(1100, 800, false); await b.shot('/tmp/matbakh-kitchen.png');
  } finally { await b.close(); srv.close(); }
  process.exit(fail ? 1 : 0);
})();
