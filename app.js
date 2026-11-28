/* MIT · Copyright (c) 2026 Yousef Khames · matbakh UI */
(function () {
  'use strict';
  const { el, t, pick } = Kit, C = MenuCore, M = MatCore;
  const cfg = Object.assign({ whatsapp: '', tables: 8, demo: true }, window.MATBAKH_CONFIG);
  const menu = C.normalize(window.MENU_DATA);
  const store = Kit.store('matbakh', 1, { orders: [] });
  const app = document.getElementById('app');
  let cat = '', q = '', cart = {}, bagNote = '', clock = null;
  const route = () => location.hash.replace(/^#\/?/, '') || 'menu';
  const tableOf = (r) => { const m = /^t\/(\d{1,2})$/.exec(r); return m ? Number(m[1]) : 0; };
  const isDemo = () => cfg.demo || menu.demo;
  const field = (label, input) => el('label', { class: 'field' }, el('span', { text: label }), input);
  const lines = () => Object.keys(cart).map((id) => ({ item: id, qty: cart[id].qty, note: cart[id].note }));
  const count = () => lines().reduce((s, l) => s + l.qty, 0);

  function header(r) {
    const tab = (id, href, label) => el('a', { class: 'tab' + (r === id ? ' on' : ''), href, 'aria-current': r === id ? 'page' : null }, label);
    const k = r.startsWith('t/') ? 'menu' : r;
    return el('header', { class: 'top noprint' },
      el('div', { class: 'brand' }, el('img', { src: 'assets/favicon.svg', width: 28, height: 28, alt: '' }), el('strong', { text: Kit.shopName(pick(menu.shop) || t('title')) })),
      el('nav', { class: 'tabs', 'aria-label': 'Main' }, tab('menu', '#/', t('menu')), tab('kitchen', '#/kitchen', t('kitchen')), tab('tables', '#/tables', t('tables'))),
      el('button', { class: 'btn small', onclick: () => { Kit.setLang(Kit.lang === 'ar' ? 'en' : 'ar', 'matbakh'); render(); } }, t('lang')));
  }

  /* ---------- customer ---------- */
  function viewMenu(table) {
    const root = el('main', { id: 'main-content', tabindex: '-1' });
    if (isDemo()) root.append(el('div', { class: 'banner', role: 'note', text: t('demoBanner') }));
    root.append(el('h1', { text: pick(menu.shop) || t('title') }), el('p', { class: 'badge', text: table ? t('table', { n: table }) : t('noTable') }));
    const inp = el('input', { type: 'search', 'aria-label': t('search'), placeholder: t('search'), value: q });
    const chips = el('div', { class: 'chips' }), list = el('div', {});
    const draw = () => {
      chips.replaceChildren(el('button', { class: 'chip' + (!cat ? ' on' : ''), 'aria-pressed': String(!cat), onclick: () => { cat = ''; draw(); } }, t('all')),
        ...menu.categories.map((c) => el('button', { class: 'chip' + (cat === c.id ? ' on' : ''), 'aria-pressed': String(cat === c.id), onclick: () => { cat = c.id; draw(); } }, pick(c.name))));
      list.replaceChildren(); const items = C.visible(menu, cat, q);
      menu.categories.forEach((c) => {
        const here = items.filter((i) => i.cat === c.id); if (!here.length) return;
        list.append(el('h2', { text: pick(c.name) }), ...here.map((it) => el('article', { class: 'item' + (it.soldOut ? ' out' : ''), 'data-id': it.id },
          it.img ? el('img', { class: 'ph', src: it.img, alt: '' }) : null,
          el('div', { class: 'body' }, el('div', { class: 'row' }, el('h3', { class: 'grow', text: pick(it.name) }), el('span', { class: 'price', text: it.price === null ? t('noPrice') : Kit.money(it.price, menu.currency) })),
            pick(it.desc) ? el('p', { class: 'desc', text: pick(it.desc) }) : null,
            el('div', { class: 'row' }, it.soldOut ? el('span', { class: 'badge', text: t('soldOut') }) : null, it.demo ? el('span', { class: 'badge demo', text: t('demoTag') }) : null,
              it.soldOut ? null : el('button', { class: 'btn small primary add', onclick: () => { const c = cart[it.id] || { qty: 0, note: '' }; c.qty = Math.min(99, c.qty + 1); cart[it.id] = c; Kit.toast(pick(it.name) + ' ×' + c.qty); drawBar(); } }, '+ ' + t('add')))))));
      });
    };
    inp.addEventListener('input', () => { q = inp.value; draw(); });
    root.append(inp, chips, list); draw();
    return root;
  }
  const bar = el('div', { class: 'cartbar noprint' });
  function drawBar() {
    const n = count(); bar.replaceChildren(); bar.hidden = !n || !!route().match(/^(kitchen|tables)/);
    if (!bar.hidden) bar.append(el('button', { class: 'btn primary wide', id: 'open-bag', onclick: bagSheet }, t('bag') + ' · ' + t('items', { n })));
  }
  function bagSheet() {
    const sheet = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('bag') });
    const close = () => { sheet.remove(); drawBar(); };
    const panel = el('div', { class: 'panel' }); sheet.append(panel);
    const noteIn = el('textarea', { id: 'bag-note', value: bagNote, 'aria-label': t('note') });
    noteIn.addEventListener('input', () => { bagNote = noteIn.value; });
    const draw = () => {
      panel.replaceChildren(el('h2', { text: t('bag') }));
      const ls = lines(); if (!ls.length) { panel.append(el('p', { text: t('bagEmpty') }), el('button', { class: 'btn', onclick: close }, t('close'))); return; }
      ls.forEach((l) => { const it = menu.items.find((i) => i.id === l.item); if (!it) return;
        panel.append(el('div', { class: 'row line' }, el('span', { class: 'grow', text: pick(it.name) }),
          el('button', { class: 'btn small', 'aria-label': '-', onclick: () => { cart[l.item].qty--; if (cart[l.item].qty < 1) delete cart[l.item]; draw(); } }, '−'), el('strong', { text: String(l.qty) }),
          el('button', { class: 'btn small', 'aria-label': '+', onclick: () => { cart[l.item].qty = Math.min(99, cart[l.item].qty + 1); draw(); } }, '+'),
          el('input', { class: 'inote', 'aria-label': t('itemNote'), placeholder: t('itemNote'), value: cart[l.item].note, onchange: (e) => { cart[l.item].note = e.target.value.slice(0, 120); } }))); });
      const order = M.makeOrder('x', tableOf(route()), ls, 0, '', isDemo()); const tt = M.totals(menu, order);
      panel.append(el('p', { class: 'total' }, t('total') + ': ', el('strong', { text: Kit.money(tt.total, menu.currency) })), el('p', { class: 'small', text: tt.unknown || tt.unpriced ? t('priceCheck') : t('totalNote') }), field(t('note'), noteIn),
        el('div', { class: 'row' }, el('button', { class: 'btn primary', id: 'prepare', onclick: () => prepare(sheet) }, t('prepare')), el('button', { class: 'btn', onclick: () => { cart = {}; bagNote = ''; draw(); } }, t('clearBag')), el('button', { class: 'btn', onclick: close }, t('close'))));
    };
    sheet.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    draw(); document.body.append(sheet);
  }
  function prepare(sheet) {
    const order = M.makeOrder(Math.random().toString(36).slice(2, 8), tableOf(route()), lines(), Kit.now(), bagNote, isDemo());
    const text = M.orderText(menu, order, Kit.lang, pick(menu.shop));
    const wa = Kit.waLink(cfg.whatsapp, text);
    const panel = sheet.firstChild; panel.replaceChildren(...[el('h2', { text: t('prepare') }), el('pre', { class: 'ordertext', id: 'order-text', text: text }),
      el('p', { class: 'banner', role: 'note', text: t('howSend') }), !wa.ok ? el('p', { text: t('noWa') }) : null, wa.ok && wa.long ? el('p', { text: t('longMsg') }) : null,
      el('div', { class: 'row' }, wa.ok && !wa.long ? el('a', { class: 'btn primary', id: 'wa-link', href: wa.url, target: '_blank', rel: 'noopener' }, t('prepare')) : null,
        el('button', { class: 'btn', id: 'copy-order', onclick: async () => { try { await navigator.clipboard.writeText(text); Kit.toast(t('copied')); } catch (e) { const r = document.createRange(); r.selectNodeContents(document.getElementById('order-text')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } } }, t('copy')),
        el('button', { class: 'btn', onclick: () => { sheet.remove(); } }, t('close')))].filter(Boolean));
  }

  /* ---------- kitchen ---------- */
  function viewKitchen() {
    const root = el('main', { id: 'main-content', tabindex: '-1' });
    root.append(el('h1', { text: t('kTitle') }), el('p', { text: t('kHelp') }));
    if (store.blocked) root.append(el('div', { class: 'banner', role: 'alert', text: t('blocked') }), el('button', { class: 'btn danger', onclick: () => { if (confirm(t('confirmDel'))) { store.reset(); render(); } } }, t('reset')));
    const ta = el('textarea', { id: 'k-paste', placeholder: t('kPaste'), 'aria-label': t('kPaste') });
    root.append(ta, el('div', { class: 'row' }, el('button', { class: 'btn primary', id: 'k-import', onclick: () => {
      const o = M.decode(ta.value); if (!o) return Kit.toast(t('kBad'));
      const r = M.addIncoming(store.data.orders, o, Kit.now()); if (!r.ok) return Kit.toast(t('kDup'));
      store.data.orders = r.list; store.save(); Kit.toast(t('kDone')); render();
    } }, t('kImport')),
      store.data.orders.some((o) => o.demo) ? el('button', { class: 'btn', id: 'k-clear-demo', onclick: () => { store.data.orders = store.data.orders.filter((o) => !o.demo); store.save(); render(); } }, t('clearDemo')) : null,
      store.data.orders.some((o) => o.status === 'served') ? el('button', { class: 'btn', onclick: () => { store.data.orders = store.data.orders.filter((o) => o.status !== 'served'); store.save(); render(); } }, t('clearServed')) : null));
    const board = el('div', { class: 'board' });
    M.STATUS.forEach((s) => {
      const col = el('section', { class: 'col', 'data-status': s }, el('h2', { text: t('s_' + s) }));
      const os = store.data.orders.filter((o) => o.status === s); if (!os.length) col.append(el('p', { class: 'small', text: t('noOrders') }));
      os.forEach((o) => { const tt = M.totals(menu, o);
        col.append(el('article', { class: 'ticket', 'data-oid': o.id },
          el('div', { class: 'row' }, el('strong', { class: 'grow', text: o.table ? t('table', { n: o.table }) : t('noTable') }), o.demo ? el('span', { class: 'badge demo', text: t('demoTag') }) : null, el('span', { class: 'badge', text: t('waiting', { n: M.elapsedMin(o, Kit.now()) }) })),
          el('ul', {}, o.lines.map((l) => { const it = menu.items.find((i) => i.id === l.item); return el('li', {}, l.qty + ' × ' + (it ? pick(it.name) : t('unknownItem') + ' (' + l.item + ')'), l.note ? ' · ' + l.note : ''); })),
          o.note ? el('p', { class: 'small', text: o.note }) : null,
          el('p', { class: 'small', text: t('orderTotal') + ': ' + Kit.money(tt.total, menu.currency) + (tt.unknown || tt.unpriced ? ' · ' + t('priceCheck') : '') }),
          el('div', { class: 'row' }, s !== 'served' ? el('button', { class: 'btn small primary next', onclick: () => { o.status = M.advance(o); store.save(); render(); } }, t('next')) : null,
            el('button', { class: 'btn small danger', onclick: () => { if (confirm(t('confirmDel'))) { store.data.orders = store.data.orders.filter((x) => x.id !== o.id); store.save(); render(); } } }, t('cancel'))))); });
      board.append(col);
    });
    root.append(board);
    clearInterval(clock); clock = setInterval(() => { if (route() === 'kitchen' && !document.activeElement.matches('textarea,input')) render(); }, 60000);
    return root;
  }

  /* ---------- table cards ---------- */
  function viewTables() {
    const root = el('main', { id: 'main-content', tabindex: '-1' });
    let url = store.data.tablesUrl || '';
    const inp = el('input', { id: 't-url', type: 'url', inputmode: 'url', placeholder: 'https://yousefkhames.github.io/matbakh/', value: url, 'aria-label': t('tUrl') });
    const out = el('div', { class: 'cards' });
    const n = Math.max(1, Math.min(99, Math.floor(cfg.tables) || 1));
    const draw = () => {
      out.replaceChildren(); const v = inp.value.trim(); if (!v) return;
      if (/^https?:\/\/(localhost|127\.|192\.168\.)/.test(v) || !/^https?:\/\//.test(v)) out.append(el('p', { class: 'banner noprint', role: 'alert', text: t('qrLocal') }));
      for (let i = 1; i <= n; i++) { const box = el('div', { class: 'qrbox' }); box.innerHTML = Kit.qrSvg(M.tableUrl(v, i));
        out.append(el('div', { class: 'tcard' }, el('h2', { text: pick(menu.shop) || t('title') }), el('p', { class: 'tnum', text: t('table', { n: i }) }), box, el('p', { text: t('scanOrder') }),
          el('div', { class: 'yk-footer small' }, el('img', { src: 'assets/yk-logo.svg', width: 16, height: 16, alt: '' }), el('span', { text: 'By Yousef Khames · من تطوير يوسف خميس' })))); }
    };
    inp.addEventListener('input', () => { store.data.tablesUrl = inp.value.trim(); store.save(); draw(); });
    root.append(el('h1', { text: t('tables') }), el('p', { class: 'noprint', text: t('tHelp') }), el('p', { class: 'noprint', text: t('tCount', { n }) }), field(t('tUrl'), inp), el('button', { class: 'btn primary noprint', onclick: () => window.print() }, t('print')), out); draw();
    return root;
  }

  function render() {
    const r = route(); Kit.applyTheme(); document.title = 'matbakh | مطبخ'; clearInterval(clock); document.querySelectorAll('.sheet').forEach((x) => x.remove());
    const view = r === 'kitchen' ? viewKitchen() : r === 'tables' ? viewTables() : viewMenu(tableOf(r));
    app.replaceChildren(header(r), el('div', { class: 'wrap' }, view), Kit.footer(), bar); drawBar(); document.body.dataset.ready = '1';
  }
  window.addEventListener('hashchange', () => { cat = ''; q = ''; render(); window.scrollTo(0, 0); });
  Kit.initLang('matbakh'); render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
