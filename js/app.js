/* Matbakh app. Static, client-side. All user text is rendered with textContent (never innerHTML). */
(function () {
  'use strict';
  const C = window.MB, I18N = window.MB_I18N, TPL = window.MB_TEMPLATES;
  const KEY = 'matbakh.v1';
  const $app = document.getElementById('app');

  /* ---------- state ---------- */
  let S;            // owner state {brand,categories,items,orders,counter,ui}
  let guest = null; // config from a shared link (memory only)
  let guestQ = '';  // raw hash query for guest navigation
  let route = { path: ['menu'], q: {} };
  let cart = [];    // [{id, qty, note}]
  let lastOrder = null;
  let loading = false, badLink = false;
  let shareCache = { key: '', payload: '' };
  let ordersFilter = { range: 'today', status: 'all' };
  let kTab = 'new';
  let search = '';
  let studioTab = 'menu';
  let form = null;   // checkout form draft

  const clone = (o) => JSON.parse(JSON.stringify(o));
  function fresh() {
    const base = C.sanitizeConfig(clone(TPL.cafe));
    return Object.assign(base, { orders: [], counter: { day: '', n: 0 }, ui: { lang: '', sound: true } });
  }
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (!raw) return fresh();
      const cfg = C.sanitizeConfig(raw);
      const orders = (Array.isArray(raw.orders) ? raw.orders : []).map(C.sanitizeOrder).filter(Boolean).slice(0, 2000);
      const counter = raw.counter && typeof raw.counter.n === 'number' ? { day: String(raw.counter.day || ''), n: raw.counter.n } : { day: '', n: 0 };
      const ui = { lang: raw.ui && (raw.ui.lang === 'ar' || raw.ui.lang === 'en') ? raw.ui.lang : '', sound: !(raw.ui && raw.ui.sound === false) };
      return Object.assign(cfg, { orders, counter, ui });
    } catch (e) { return fresh(); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { toast('⚠ Storage full. Export a backup and clear old orders.'); }
  }
  function cfg() { return guest || S; }
  function brand() { return cfg().brand; }
  function lang() {
    if (guest) return sessionStorage.getItem('mb.lang') || guest.brand.lang;
    return S.ui.lang || S.brand.lang;
  }
  function setLang(l) {
    if (guest) sessionStorage.setItem('mb.lang', l); else { S.ui.lang = l; save(); }
    applyChrome(); render();
  }
  const t = (k) => (I18N[lang()] && I18N[lang()][k]) || I18N.en[k] || k;
  const isAr = () => lang() === 'ar';
  const money = (n) => C.fmtMoney(n, brand().currency, lang(), brand().arabicDigits);
  const nf = (n) => (isAr() && brand().arabicDigits ? C.toArabicDigits(String(n)) : String(n));
  const bn = (o) => (o && (o[lang()] || o.en || o.ar)) || '';
  const fmtTime = (ts) => new Date(ts).toLocaleTimeString(isAr() ? 'ar-EG-u-nu-' + (brand().arabicDigits ? 'arab' : 'latn') : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (ts) => new Date(ts).toLocaleDateString(isAr() ? 'ar-EG-u-nu-' + (brand().arabicDigits ? 'arab' : 'latn') : 'en-GB', { day: 'numeric', month: 'short' });

  /* ---------- DOM helper ---------- */
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style') el.style.cssText = v;
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const btn = (label, onclick, cls, extra) => h('button', Object.assign({ type: 'button', class: 'btn ' + (cls || ''), onclick }, extra), label);

  function toast(msg) {
    const el = h('div', { class: 'toast', role: 'status' }, msg);
    document.body.append(el);
    setTimeout(() => el.classList.add('out'), 2200);
    setTimeout(() => el.remove(), 2700);
  }
  function modal(title, body, actions) {
    return new Promise((resolve) => {
      const dlg = h('dialog', { class: 'modal' });
      const close = (v) => { dlg.close(); dlg.remove(); resolve(v); };
      dlg.append(h('div', { class: 'modal-head' }, h('h3', null, title), h('button', { class: 'x', type: 'button', 'aria-label': t('closed'), onclick: () => close(null) }, '×')),
        h('div', { class: 'modal-body' }, body), h('div', { class: 'modal-actions' }, (actions || []).map((a) => btn(a.label, () => { const r = a.run ? a.run() : true; if (r !== false) close(a.value === undefined ? true : a.value); }, a.cls))));
      dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(null); });
      document.body.append(dlg);
      dlg.showModal();
      const f = dlg.querySelector('input,textarea,select'); if (f) f.focus();
    });
  }
  const ask = (msg, danger) => modal(msg, null, [{ label: t('closed'), value: false, cls: 'ghost' }, { label: danger ? t('del') : t('save'), value: true, cls: danger ? 'danger' : 'primary' }]).then((v) => v === true);

  /* ---------- theme ---------- */
  function lum(hex) {
    const c = [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  const onColor = (hex) => (lum(hex) > 0.4 ? '#1e1712' : '#ffffff');
  function applyChrome() {
    const b = brand(), r = document.documentElement;
    r.style.setProperty('--p', b.colors.primary); r.style.setProperty('--a', b.colors.accent);
    r.style.setProperty('--pt', onColor(b.colors.primary)); r.style.setProperty('--at', onColor(b.colors.accent));
    r.lang = lang(); r.dir = isAr() ? 'rtl' : 'ltr';
    document.title = bn(b.name) + ' | ' + t('menu');
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = b.colors.primary;
  }
  function logoEl(size) {
    const b = brand();
    const box = h('span', { class: 'logo ' + (size || ''), 'aria-hidden': 'true' });
    if (b.logo.image) box.append(h('img', { src: b.logo.image, alt: '' })); else box.append(b.logo.emoji);
    return box;
  }

  /* ---------- routing ---------- */
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [p, qs] = raw.split('?');
    const q = {};
    new URLSearchParams(qs || '').forEach((v, k) => { q[k] = v; });
    return { path: p ? p.split('/') : ['menu'], q, qs: qs || '' };
  }
  function go(path, extra) {
    const qs = guest ? guestQ : '';
    const target = '#/' + path + (qs ? '?' + qs : '');
    if (location.hash === target) render(); else location.hash = target;
    void extra;
  }
  async function onRoute() {
    const r = parseHash();
    route = r;
    if (r.q.d && !guest && !loading) {
      loading = true; badLink = false; render();
      try {
        const cfgObj = C.sanitizeConfig(JSON.parse(await C.unpackText(r.q.d)));
        guest = Object.assign(cfgObj, { orders: [] });
        guestQ = r.qs;
        cart = JSON.parse(sessionStorage.getItem('mb.gcart') || '[]');
      } catch (e) { badLink = true; }
      loading = false;
    } else if (!r.q.d && guest) { guest = null; guestQ = ''; cart = loadCart(); }
    if (guest && r.q.d) guestQ = r.qs;
    applyChrome(); render(); window.scrollTo(0, 0);
  }
  const loadCart = () => { try { return JSON.parse(localStorage.getItem('mb.cart') || '[]'); } catch (e) { return []; } };
  function saveCart() {
    const s = JSON.stringify(cart);
    if (guest) sessionStorage.setItem('mb.gcart', s); else localStorage.setItem('mb.cart', s);
  }

  /* ---------- cart helpers ---------- */
  const findItem = (id) => cfg().items.find((i) => i.id === id);
  function qtyOf(id) { const l = cart.find((x) => x.id === id); return l ? l.qty : 0; }
  function setQty(id, q) {
    const l = cart.find((x) => x.id === id);
    if (l) { l.qty = Math.max(0, Math.min(99, q)); if (!l.qty) cart = cart.filter((x) => x !== l); }
    else if (q > 0) cart.push({ id, qty: q, note: '' });
    saveCart(); render(true);
  }
  function cartLines() {
    return cart.map((l) => { const it = findItem(l.id); return it ? { item: it, qty: l.qty, note: l.note, price: it.price, name: it.name } : null; }).filter(Boolean);
  }
  const cartCount = () => cartLines().reduce((s, l) => s + l.qty, 0);
  const totalsFor = (lines) => C.cartTotals(lines, brand().taxPct, brand().servicePct, brand().currency.decimals);

  /* ---------- order creation ---------- */
  function buildOrder(form) {
    const lines = cartLines().map((l) => ({ name: clone(l.name), price: l.price, qty: l.qty, note: l.note || '' }));
    const now = Date.now();
    const o = {
      id: C.uid('o'), no: 0, origin: '', type: form.type, table: form.type === 'table' ? form.table : '', name: form.name, phone: form.phone, note: form.note,
      status: 'new', createdAt: now, updatedAt: now, lines, totals: totalsFor(lines),
    };
    return o;
  }
  function addOwnerOrder(o) {
    const n = C.nextOrderNo(S.counter, o.createdAt);
    o.no = n.no; S.counter = n.counter;
    S.orders.unshift(o); save();
    return o;
  }

  /* ---------- sound + cross-tab ---------- */
  let actx;
  function beep() {
    if (!S.ui.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      [660, 880].forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.frequency.value = f; o.connect(g); g.connect(actx.destination);
        const t0 = actx.currentTime + i * 0.18; g.gain.setValueAtTime(0.15, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
        o.start(t0); o.stop(t0 + 0.17);
      });
    } catch (e) { /* audio blocked */ }
  }
  /* live orders from customers' phones through ntfy.sh (optional, owner device only) */
  let es = null, esTopic = '', liveOk = false;
  function liveIngest(text) {
    try {
      const d = C.decodeOrder(text);
      if (d.origin && S.orders.some((o) => o.origin === d.origin)) return;
      const o = Object.assign(d, { id: C.uid('o'), no: 0, status: 'new', updatedAt: Date.now() });
      addOwnerOrder(o); beep(); toast(t('liveReceived')); applyChrome(); render(true);
    } catch (e) { /* not an order */ }
  }
  function liveSync() {
    const topic = guest ? '' : (S.brand.liveTopic || '');
    if (topic === esTopic) return;
    if (es) { es.close(); es = null; }
    esTopic = topic; liveOk = false;
    if (!topic || typeof EventSource === 'undefined') return;
    es = new EventSource(C.liveUrl(topic, '/sse?since=12h'));
    es.onopen = () => { liveOk = true; };
    es.onerror = () => { liveOk = false; };
    es.onmessage = (m) => { try { const d = JSON.parse(m.data); if (d.event === 'message' && d.message) liveIngest(d.message); } catch (e) { /* ignore */ } };
  }
  window.addEventListener('storage', (e) => {
    if (guest || e.key !== KEY) return;
    const before = S.orders.filter((o) => o.status === 'new').length;
    S = load();
    if (S.orders.filter((o) => o.status === 'new').length > before) beep();
    applyChrome(); render(true);
  });
  setInterval(() => {
    if (!guest && route.path[0] === 'kitchen' && !document.querySelector('dialog[open]') && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) render(true);
  }, 20000);

  /* ---------- views ---------- */
  function shell(content) {
    const b = brand();
    const kids = [];
    if (!guest) {
      const newCount = S.orders.filter((o) => o.status === 'new').length;
      const tab = (p, label, ic, badge) => h('a', { href: '#/' + p, class: 'tab' + (route.path[0] === p ? ' on' : ''), 'aria-current': route.path[0] === p ? 'page' : null },
        h('span', { class: 'ti', 'aria-hidden': 'true' }, ic), h('span', { class: 't' }, label), badge ? h('b', { class: 'badge' }, nf(badge)) : null);
      kids.push(h('nav', { class: 'nav', 'aria-label': 'main' },
        h('div', { class: 'nav-brand' }, logoEl('sm'), h('span', null, bn(b.name))),
        tab('menu', t('menu'), '☰'), tab('kitchen', t('kitchen'), '♨', newCount), tab('orders', t('orders'), '🧾'), tab('studio', t('studio'), '⚙'),
        h('button', { class: 'tab langbtn', type: 'button', onclick: () => setLang(isAr() ? 'en' : 'ar') }, h('span', { class: 'ti' }, '🌐'), h('span', { class: 't' }, t('lang')))));
    }
    kids.push(h('main', { class: 'main' + (guest ? ' guest' : '') }, content));
    return kids;
  }

  function menuView() {
    const b = brand(), c = cfg();
    const q = search.trim().toLowerCase();
    const wrap = h('div', { class: 'menu' });
    const tableParam = route.q.t;
    const hero = h('header', { class: 'hero' },
      h('div', { class: 'arch' }, logoEl('lg')),
      h('div', { class: 'hero-txt' },
        h('h1', null, bn(b.name)),
        bn(b.tagline) ? h('p', { class: 'tag' }, bn(b.tagline)) : null,
        bn(b.about) ? h('p', { class: 'about' }, bn(b.about)) : null,
        h('div', { class: 'chips' },
          tableParam ? h('span', { class: 'chip solid' }, t('table') + ' ' + nf(tableParam)) : null,
          b.pickupMinutes ? h('span', { class: 'chip' }, '⏱ ' + nf(b.pickupMinutes) + ' ' + t('min')) : null)),
      guest ? h('button', { class: 'chip langchip', type: 'button', onclick: () => setLang(isAr() ? 'en' : 'ar') }, '🌐 ' + t('lang')) : null);
    wrap.append(hero);
    wrap.append(guest ? h('p', { class: 'banner' }, t('guestNote')) : h('p', { class: 'banner staff' }, t('staffMode')));
    const searchBox = h('input', { class: 'search', type: 'search', placeholder: t('search'), value: search, 'aria-label': t('search'),
      oninput: (e) => { search = e.target.value; const pos = e.target.selectionStart; render(true); const n = document.querySelector('.search'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } } });
    const cats = c.categories.filter((cat) => c.items.some((i) => i.cat === cat.id));
    wrap.append(h('div', { class: 'sticky' }, searchBox, h('div', { class: 'catbar' }, cats.map((cat) =>
      h('button', { type: 'button', class: 'cat', onclick: () => { const el = document.getElementById('cat-' + cat.id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, bn(cat.name))))));
    const popular = c.items.filter((i) => i.popular && i.available && !q);
    const sections = [];
    if (popular.length) sections.push({ id: 'pop', name: '★ ' + t('popular'), items: popular });
    for (const cat of cats) {
      const its = c.items.filter((i) => i.cat === cat.id && (!q || (bn(i.name) + ' ' + i.name.ar + ' ' + i.name.en + ' ' + bn(i.desc)).toLowerCase().includes(q)));
      if (its.length) sections.push({ id: cat.id, name: bn(cat.name), items: its });
    }
    if (!sections.length) wrap.append(h('p', { class: 'empty' }, t('none')));
    for (const s of sections) {
      wrap.append(h('section', { class: 'cat-sec', id: 'cat-' + s.id }, h('h2', null, s.name), h('div', { class: 'items' }, s.items.map(itemRow))));
    }
    wrap.append(h('footer', { class: 'foot' }, t('powered')));
    return wrap;
  }
  function itemRow(it) {
    const q = qtyOf(it.id);
    const ctl = !it.available ? h('span', { class: 'sold' }, t('soldOut'))
      : q ? h('div', { class: 'step' }, h('button', { type: 'button', 'aria-label': t('remove'), onclick: () => setQty(it.id, q - 1) }, '−'), h('output', null, nf(q)), h('button', { type: 'button', 'aria-label': t('add'), onclick: () => setQty(it.id, q + 1) }, '+'))
        : h('button', { type: 'button', class: 'add', onclick: () => setQty(it.id, 1) }, '+ ' + t('add'));
    return h('article', { class: 'item' + (it.available ? '' : ' off') },
      h('div', { class: 'em', 'aria-hidden': 'true' }, it.emoji),
      h('div', { class: 'body' }, h('h3', null, bn(it.name)), bn(it.desc) ? h('p', null, bn(it.desc)) : null, h('div', { class: 'row' }, h('span', { class: 'price' }, money(it.price)), ctl)));
  }

  function cartBar() {
    const n = cartCount();
    if (!n) return null;
    const tot = totalsFor(cartLines());
    return h('a', { class: 'cartbar', href: '#/cart' + (guest ? '?' + guestQ : '') }, h('span', { class: 'cb-n' }, nf(n)), h('span', { class: 'cb-l' }, t('viewOrder')), h('span', { class: 'cb-t' }, money(tot.total)));
  }

  function cartView() {
    const lines = cartLines();
    const wrap = h('div', { class: 'cart' });
    wrap.append(h('div', { class: 'pagehead' }, h('a', { class: 'back', href: '#/menu' + (guest ? '?' + guestQ : '') }, (isAr() ? '→ ' : '← ') + t('back')), h('h1', null, t('yourOrder'))));
    if (!lines.length) { wrap.append(h('p', { class: 'empty' }, t('emptyCart'))); return wrap; }
    const list = h('div', { class: 'lines' }, lines.map((l) => h('div', { class: 'line' },
      h('span', { class: 'em' }, l.item.emoji),
      h('div', { class: 'lb' }, h('b', null, bn(l.name)), h('input', { class: 'lnote', placeholder: t('noteForKitchen'), maxlength: 100, value: l.note || '', 'aria-label': t('noteForKitchen'), onchange: (e) => { const x = cart.find((c) => c.id === l.item.id); if (x) { x.note = e.target.value.slice(0, 100); saveCart(); } } })),
      h('div', { class: 'step' }, h('button', { type: 'button', 'aria-label': t('remove'), onclick: () => setQty(l.item.id, l.qty - 1) }, '−'), h('output', null, nf(l.qty)), h('button', { type: 'button', 'aria-label': t('add'), onclick: () => setQty(l.item.id, l.qty + 1) }, '+')),
      h('span', { class: 'lp' }, money(l.price * l.qty)))));
    wrap.append(list);

    const defType = route.q.t ? 'table' : (brand().tables > 0 && !guest ? 'table' : 'pickup');
    const f = form || (form = { type: defType, table: route.q.t || '', name: '', phone: '', note: '' });
    const err = h('p', { class: 'err', role: 'alert' });
    const typeSeg = h('div', { class: 'seg', role: 'radiogroup' },
      ['table', 'pickup'].map((ty) => h('button', { type: 'button', role: 'radio', 'aria-checked': f.type === ty ? 'true' : 'false', class: f.type === ty ? 'on' : '', onclick: () => { f.type = ty; render(true); } }, ty === 'table' ? '🪑 ' + t('atTable') : '🛍 ' + t('pickup'))));
    const field = (label, key, attrs) => h('label', { class: 'fld' }, h('span', null, label), h('input', Object.assign({ value: f[key], oninput: (e) => { f[key] = e.target.value; } }, attrs)));
    const formEl = h('div', { class: 'form' }, typeSeg,
      f.type === 'table' ? field(t('tableNo'), 'table', { inputmode: 'numeric', maxlength: 6, autocomplete: 'off' }) : null,
      field(t('yourName'), 'name', { maxlength: 40, autocomplete: 'name' }),
      f.type === 'pickup' || guest ? field(t('yourPhone'), 'phone', { inputmode: 'tel', maxlength: 20, autocomplete: 'tel' }) : null,
      field(t('noteForKitchen'), 'note', { maxlength: 200 }));
    wrap.append(formEl);
    const tot = totalsFor(lines);
    wrap.append(h('div', { class: 'totals' },
      h('div', null, h('span', null, t('subtotal')), h('span', null, money(tot.sub))),
      tot.service ? h('div', null, h('span', null, t('service') + ' ' + nf(brand().servicePct) + '%'), h('span', null, money(tot.service))) : null,
      tot.tax ? h('div', null, h('span', null, t('tax') + ' ' + nf(brand().taxPct) + '%'), h('span', null, money(tot.tax))) : null,
      h('div', { class: 'grand' }, h('span', null, t('total')), h('span', null, money(tot.total)))));
    const validate = () => {
      if (f.type === 'table' && !f.table.trim()) return t('needTable');
      if (f.type === 'pickup' && !f.name.trim()) return t('needName');
      if (f.type === 'pickup' && !f.phone.trim()) return t('needPhone');
      return '';
    };
    const form2 = () => ({ type: f.type, table: C.str(f.table, 6), name: C.str(f.name, 40), phone: C.str(f.phone, 20), note: C.str(f.note, 200) });
    const actions = h('div', { class: 'actions' });
    if (guest) {
      if (brand().liveTopic) actions.append(btn('♨ ' + t('sendLive'), async (ev) => {
        const e = validate(); if (e) { err.textContent = e; return; }
        const o = buildOrder(form2()); o.no = 0; o.createdAt = Date.now();
        const text = C.orderText(o, brand(), lang(), brand().arabicDigits);
        const num = C.normalizePhone(brand().whatsapp, brand().countryCode);
        err.textContent = ''; ev.currentTarget.disabled = true;
        try {
          const code = C.encodeOrder(o);
          if (code.length > 3800) throw new Error('too big');
          const r = await fetch(C.liveUrl(brand().liveTopic), { method: 'POST', body: code });
          if (!r.ok) throw new Error('http ' + r.status);
        } catch (x) { err.textContent = t('liveFailed'); ev.currentTarget.disabled = false; return; }
        lastOrder = { order: o, text, wa: num ? C.waLink(num, text) : '', live: true };
        cart = []; saveCart(); go('done');
      }, 'primary wide'));
      actions.append(btn('💬 ' + t('sendWhatsApp'), () => {
        const e = validate(); if (e) { err.textContent = e; return; }
        const num = C.normalizePhone(brand().whatsapp, brand().countryCode);
        if (!num) { err.textContent = t('noWhatsApp'); return; }
        const o = buildOrder(form2()); o.no = 0; o.createdAt = Date.now();
        const text = C.orderText(o, brand(), lang(), brand().arabicDigits);
        lastOrder = { order: o, text, wa: C.waLink(num, text) };
        cart = []; saveCart(); go('done');
        window.open(lastOrder.wa, '_blank', 'noopener');
      }, 'primary wide'));
    } else {
      actions.append(btn('♨ ' + t('sendKitchen'), () => {
        const e = validate(); if (e) { err.textContent = e; return; }
        const o = addOwnerOrder(buildOrder(form2()));
        lastOrder = { order: o }; cart = []; saveCart(); form = null; beep(); go('done');
      }, 'primary wide'));
    }
    actions.append(btn(t('clear'), async () => { cart = []; saveCart(); toast(t('cartCleared')); go('menu'); }, 'ghost'));
    wrap.append(err, actions);
    return wrap;
  }

  function doneView() {
    const wrap = h('div', { class: 'done' });
    if (!lastOrder) { go('menu'); return wrap; }
    const o = lastOrder.order;
    wrap.append(h('div', { class: 'stamp' }, '✓'), h('h1', null, guest ? (lastOrder.live ? t('liveSent') : t('orderSent')) : t('orderSavedKitchen')));
    if (!guest) wrap.append(h('p', { class: 'bigno' }, t('orderNo') + ' #' + nf(o.no)));
    wrap.append(h('p', { class: 'muted' }, guest ? (lastOrder.live ? t('liveNote') : t('waOpened')) : (o.type === 'table' ? t('table') + ' ' + nf(o.table) : t('pickup') + ' · ' + nf(brand().pickupMinutes) + ' ' + t('min'))));
    wrap.append(h('div', { class: 'receipt-mini' }, o.lines.map((l) => h('div', null, h('span', null, nf(l.qty) + ' × ' + C.lineName(l, lang())), h('span', null, money(l.price * l.qty)))), h('div', { class: 'grand' }, h('span', null, t('total')), h('span', null, money(o.totals.total)))));
    const acts = h('div', { class: 'actions' });
    if (guest) {
      if (lastOrder.wa) acts.append(btn('💬 ' + t('sendWhatsApp'), () => window.open(lastOrder.wa, '_blank', 'noopener'), lastOrder.live ? 'ghost' : 'primary'));
      acts.append(
        btn(t('copyText'), () => { (navigator.clipboard ? navigator.clipboard.writeText(lastOrder.text) : Promise.reject()).then(() => toast(t('copied')), () => toast(lastOrder.text)); }, 'ghost'));
      if (!lastOrder.live) wrap.append(h('pre', { class: 'wa-text' }, lastOrder.text));
    } else {
      const ph = C.normalizePhone(o.phone, brand().countryCode);
      if (ph) acts.append(btn('💬 ' + t('whatsappCustomer'), () => window.open(C.waLink(ph, C.confirmText(o, brand(), lang())), '_blank', 'noopener'), 'ghost'));
      acts.append(btn('♨ ' + t('kitchen'), () => go('kitchen'), 'ghost'));
    }
    acts.append(btn('+ ' + t('newOrder'), () => go('menu'), guest ? 'ghost' : 'primary'));
    wrap.append(acts);
    return wrap;
  }

  /* ----- kitchen ----- */
  const COLS = [['new', 'colNew'], ['preparing', 'colPrep'], ['ready', 'colReady']];
  function setStatus(id, st) {
    const o = S.orders.find((x) => x.id === id); if (!o) return;
    o.status = st; o.updatedAt = Date.now(); save(); render(true);
  }
  function ticket(o) {
    const mins = Math.max(0, Math.floor((Date.now() - o.createdAt) / 60000));
    const age = o.status === 'ready' || mins < 8 ? 'ok' : mins < 15 ? 'warn' : 'late';
    const ph = C.normalizePhone(o.phone, brand().countryCode);
    const nextLabel = { new: t('start'), preparing: t('markReady'), ready: t('handOver') }[o.status];
    const el = h('article', { class: 'ticket st-' + o.status, 'data-no': o.no },
      h('div', { class: 'tk-head' }, h('span', { class: 'tk-no' }, '#' + nf(o.no)), h('span', { class: 'tk-where' }, o.type === 'table' ? '🪑 ' + t('table') + ' ' + nf(o.table) : '🛍 ' + t('pickup')),
        h('span', { class: 'tk-age ' + age }, nf(mins) + ' ' + t('ago'))),
      o.name || o.phone ? h('div', { class: 'tk-who' }, [o.name, o.phone].filter(Boolean).join(' · ')) : null,
      h('ul', { class: 'tk-lines' }, o.lines.map((l) => h('li', null, h('b', null, nf(l.qty) + '×'), ' ' + C.lineName(l, lang()), l.note ? h('i', null, ' — ' + l.note) : null))),
      o.note ? h('p', { class: 'tk-note' }, '📝 ' + o.note) : null,
      h('div', { class: 'tk-foot' },
        h('span', { class: 'tk-time' }, fmtTime(o.createdAt) + ' · ' + money(o.totals.total)),
        h('div', { class: 'tk-acts' },
          o.status !== 'new' ? btn('↩', () => setStatus(o.id, C.PREV[o.status]), 'mini ghost', { title: t('undo'), 'aria-label': t('undo') }) : null,
          ph && o.status === 'ready' ? btn('💬', () => window.open(C.waLink(ph, C.readyText(o, brand(), lang())), '_blank', 'noopener'), 'mini ghost', { title: t('waReady'), 'aria-label': t('waReady') }) : null,
          ph && o.status === 'new' ? btn('💬', () => window.open(C.waLink(ph, C.confirmText(o, brand(), lang())), '_blank', 'noopener'), 'mini ghost', { title: t('waConfirm'), 'aria-label': t('waConfirm') }) : null,
          o.status === 'new' ? btn('✕', async () => { if (await ask(t('cancel') + '?', true)) setStatus(o.id, 'cancelled'); }, 'mini ghost', { title: t('cancel'), 'aria-label': t('cancel') }) : null,
          btn(nextLabel, () => setStatus(o.id, C.NEXT[o.status]), 'mini go'))));
    return el;
  }
  async function importDialog() {
    const ta = h('textarea', { rows: 8, placeholder: t('pasteHere'), 'aria-label': t('pasteHere') });
    await modal(t('importWa'), ta, [{ label: t('closed'), cls: 'ghost', value: false }, { label: t('importBtn'), cls: 'primary', run: () => {
      try {
        const d = C.decodeOrder(ta.value);
        if (d.origin && S.orders.some((o) => o.origin === d.origin)) { toast(t('alreadyImported')); return true; }
        const o = Object.assign(d, { id: C.uid('o'), no: 0, status: 'new', updatedAt: Date.now() });
        addOwnerOrder(o); toast(t('imported')); beep(); render(true); return true;
      } catch (e) { toast(t('badCode')); return false; }
    } }]);
  }
  function kitchenView() {
    const wrap = h('div', { class: 'kitchen' });
    wrap.append(h('div', { class: 'k-head' }, h('h1', null, '♨ ' + t('kitchen')),
      h('div', { class: 'k-tools' },
        btn(S.ui.sound ? '🔔 ' + t('sound') : '🔕 ' + t('sound'), () => { S.ui.sound = !S.ui.sound; save(); if (S.ui.sound) beep(); render(true); }, 'mini ghost'),
        btn('⛶ ' + t('fullscreen'), () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); }, 'mini ghost'),
        btn('⤓ ' + t('importWa'), importDialog, 'mini go'))));
    const by = (st) => S.orders.filter((o) => o.status === st).sort((a, b) => a.createdAt - b.createdAt);
    wrap.append(h('div', { class: 'k-tabs', role: 'tablist' }, COLS.map(([st, k]) => h('button', { type: 'button', role: 'tab', class: kTab === st ? 'on' : '', 'aria-selected': kTab === st ? 'true' : 'false', onclick: () => { kTab = st; render(true); } }, t(k), h('b', null, nf(by(st).length))))));
    wrap.append(h('div', { class: 'k-board' }, COLS.map(([st, k]) => h('section', { class: 'k-col' + (kTab === st ? ' show' : ''), 'data-col': st },
      h('h2', null, t(k), h('b', null, nf(by(st).length))),
      by(st).length ? by(st).map(ticket) : h('p', { class: 'k-none' }, t('none'))))));
    wrap.append(h('p', { class: 'hint' }, t('sync')));
    if (S.brand.liveTopic) wrap.append(h('p', { class: 'hint', 'data-live': liveOk ? 'on' : 'down' }, (liveOk ? '● ' + t('liveStatusOn') : '○ ' + t('liveStatusDown'))));
    return wrap;
  }

  /* ----- orders ----- */
  function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function statusLabel(s) { return { new: t('colNew'), preparing: t('colPrep'), ready: t('colReady'), done: t('colDone'), cancelled: t('colCancelled') }[s]; }
  function download(name, text, type) {
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function printReceipt(o) {
    const b = brand();
    const r = h('div', { id: 'receipt' },
      h('h2', null, bn(b.name)), h('p', { class: 'c' }, bn(b.tagline)),
      h('p', null, t('orderNo') + ' #' + nf(o.no) + ' · ' + fmtDate(o.createdAt) + ' ' + fmtTime(o.createdAt)),
      h('p', null, o.type === 'table' ? t('table') + ' ' + nf(o.table) : t('pickup') + (o.name ? ' · ' + o.name : '')),
      h('hr'), o.lines.map((l) => h('div', { class: 'rl' }, h('span', null, nf(l.qty) + ' × ' + C.lineName(l, lang())), h('span', null, money(l.price * l.qty)))), h('hr'),
      o.totals.service ? h('div', { class: 'rl' }, h('span', null, t('service')), h('span', null, money(o.totals.service))) : null,
      o.totals.tax ? h('div', { class: 'rl' }, h('span', null, t('tax')), h('span', null, money(o.totals.tax))) : null,
      h('div', { class: 'rl big' }, h('span', null, t('total')), h('span', null, money(o.totals.total))), h('p', { class: 'c' }, t('thanks')));
    document.body.append(r); document.body.classList.add('print-receipt');
    window.print();
    setTimeout(() => { r.remove(); document.body.classList.remove('print-receipt'); }, 300);
  }
  function ordersView() {
    const wrap = h('div', { class: 'orders' });
    const from = ordersFilter.range === 'today' ? startOfToday() : 0;
    const st = C.stats(S.orders, from);
    wrap.append(h('div', { class: 'pagehead' }, h('h1', null, t('orders')),
      h('div', { class: 'seg sm' }, ['today', 'all'].map((r) => h('button', { type: 'button', class: ordersFilter.range === r ? 'on' : '', onclick: () => { ordersFilter.range = r; render(true); } }, t(r))))));
    wrap.append(h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('small', null, t('sales')), h('b', null, money(st.sales))),
      h('div', { class: 'stat' }, h('small', null, t('colDone')), h('b', null, nf(st.count))),
      h('div', { class: 'stat' }, h('small', null, t('avgOrder')), h('b', null, money(Math.round(st.avg * 100) / 100)))));
    if (st.top.length) {
      const max = st.top[0].qty;
      wrap.append(h('div', { class: 'top' }, h('h3', null, t('topItems')), st.top.map((x) => h('div', { class: 'bar' }, h('span', { class: 'bl' }, bn(x.name)), h('span', { class: 'bt' }, h('i', { style: 'width:' + Math.round((x.qty / max) * 100) + '%' })), h('span', { class: 'bq' }, nf(x.qty))))));
    }
    const sel = h('select', { 'aria-label': t('status'), onchange: (e) => { ordersFilter.status = e.target.value; render(true); } },
      [['all', t('all')]].concat(C.STATUS.map((s) => [s, statusLabel(s)])).map(([v, l]) => h('option', { value: v, selected: ordersFilter.status === v }, l)));
    wrap.append(h('div', { class: 'ofilter' }, sel, h('div', { class: 'spacer' }),
      btn('⤓ ' + t('exportCsv'), () => download('matbakh-orders.csv', C.ordersCsv(S.orders, lang()), 'text/csv;charset=utf-8'), 'mini ghost'),
      btn('🗑 ' + t('clearHistory'), async () => { if (await ask(t('confirmDelete'), true)) { S.orders = []; save(); render(true); } }, 'mini ghost')));
    const list = S.orders.filter((o) => o.createdAt >= from && (ordersFilter.status === 'all' || o.status === ordersFilter.status));
    if (!list.length) wrap.append(h('p', { class: 'empty' }, t('noOrders')));
    wrap.append(h('div', { class: 'olist' }, list.map((o) => h('details', { class: 'orow st-' + o.status },
      h('summary', null, h('b', null, '#' + nf(o.no)), h('span', { class: 'ow' }, o.type === 'table' ? t('table') + ' ' + nf(o.table) : t('pickup') + (o.name ? ' · ' + o.name : '')), h('span', { class: 'os' }, statusLabel(o.status)), h('span', { class: 'ot' }, money(o.totals.total))),
      h('div', { class: 'od' }, h('p', { class: 'muted' }, fmtDate(o.createdAt) + ' ' + fmtTime(o.createdAt) + (o.phone ? ' · ' + o.phone : '')),
        h('ul', null, o.lines.map((l) => h('li', null, nf(l.qty) + ' × ' + C.lineName(l, lang()) + ' — ' + money(l.price * l.qty)))),
        o.note ? h('p', null, '📝 ' + o.note) : null,
        h('div', { class: 'tk-acts' }, btn('🖨 ' + t('print'), () => printReceipt(o), 'mini ghost'),
          o.status !== 'done' && o.status !== 'cancelled' ? btn(t('handOver'), () => setStatus(o.id, 'done'), 'mini go') : null))))));
    return wrap;
  }

  /* ----- studio ----- */
  function studioView() {
    const wrap = h('div', { class: 'studio' });
    wrap.append(h('div', { class: 'pagehead' }, h('h1', null, t('studio'))));
    const tabs = [['menu', 'tabMenu'], ['tables', 'tabTables'], ['brand', 'tabBrand'], ['data', 'tabData']];
    wrap.append(h('div', { class: 'seg tabs', role: 'tablist' }, tabs.map(([k, l]) => h('button', { type: 'button', role: 'tab', class: studioTab === k ? 'on' : '', 'aria-selected': studioTab === k ? 'true' : 'false', onclick: () => { studioTab = k; render(true); } }, t(l)))));
    const pane = h('div', { class: 'pane' });
    wrap.append(pane);
    ({ menu: studioMenu, tables: studioTables, brand: studioBrand, data: studioData })[studioTab](pane);
    return wrap;
  }

  function fld(label, input) { return h('label', { class: 'fld' }, h('span', null, label), input); }
  async function editItem(it) {
    const isNew = !it;
    const d = it ? clone(it) : { id: C.uid('i'), cat: S.categories[0] && S.categories[0].id, name: { ar: '', en: '' }, desc: { ar: '', en: '' }, price: 0, emoji: '🍽️', available: true, popular: false };
    const inp = (v, a) => h('input', Object.assign({ value: v }, a));
    const nAr = inp(d.name.ar, { maxlength: 60, dir: 'rtl' }), nEn = inp(d.name.en, { maxlength: 60, dir: 'ltr' });
    const dAr = inp(d.desc.ar, { maxlength: 160, dir: 'rtl' }), dEn = inp(d.desc.en, { maxlength: 160, dir: 'ltr' });
    const pr = inp(String(d.price), { inputmode: 'decimal', 'aria-label': t('price') }), em = inp(d.emoji, { maxlength: 8 });
    const cat = h('select', null, S.categories.map((c) => h('option', { value: c.id, selected: c.id === d.cat }, bn(c.name))));
    const av = h('input', { type: 'checkbox', checked: d.available }), po = h('input', { type: 'checkbox', checked: d.popular });
    const sugg = h('div', { class: 'emsug' }, ['🍳', '🥙', '🌯', '🍔', '🍕', '🍝', '🥗', '🍗', '🥩', '🍟', '☕', '🍵', '🥤', '🍰', '🧁', '🥐', '🍨', '🥭'].map((e) => h('button', { type: 'button', onclick: () => { em.value = e; } }, e)));
    const body = h('div', { class: 'form' }, fld(t('nameAr'), nAr), fld(t('nameEn'), nEn), fld(t('descAr'), dAr), fld(t('descEn'), dEn),
      h('div', { class: 'two' }, fld(t('price'), pr), fld(t('emoji'), em)), sugg, fld(t('category'), cat),
      h('label', { class: 'chk' }, av, t('available')), h('label', { class: 'chk' }, po, t('markPopular')));
    const r = await modal(isNew ? t('addItem') : t('edit'), body, [{ label: t('closed'), cls: 'ghost', value: false }, { label: t('save'), cls: 'primary', run: () => {
      if (!nAr.value.trim() && !nEn.value.trim()) { nEn.focus(); return false; }
      return true;
    } }]);
    if (r !== true) return;
    const out = { id: d.id, cat: cat.value, name: { ar: C.str(nAr.value, 60), en: C.str(nEn.value, 60) }, desc: { ar: C.str(dAr.value, 160), en: C.str(dEn.value, 160) },
      price: C.num(pr.value, 0, 1e6, 0), emoji: C.str(em.value, 8) || '🍽️', available: av.checked, popular: po.checked };
    if (isNew) S.items.push(out); else S.items[S.items.findIndex((x) => x.id === d.id)] = out;
    save(); toast(t('saved')); render(true);
  }
  async function editCategory(cat) {
    const nAr = h('input', { value: cat ? cat.name.ar : '', maxlength: 40, dir: 'rtl' }), nEn = h('input', { value: cat ? cat.name.en : '', maxlength: 40, dir: 'ltr' });
    const r = await modal(cat ? t('edit') : t('addCategory'), h('div', { class: 'form' }, fld(t('nameAr'), nAr), fld(t('nameEn'), nEn)), [{ label: t('closed'), cls: 'ghost', value: false }, { label: t('save'), cls: 'primary', run: () => (nAr.value.trim() || nEn.value.trim() ? true : false) }]);
    if (r !== true) return;
    const name = { ar: C.str(nAr.value, 40), en: C.str(nEn.value, 40) };
    if (cat) cat.name = name; else S.categories.push({ id: C.uid('c'), name });
    save(); render(true);
  }
  function move(arr, i, d) { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; save(); render(true); }
  function studioMenu(pane) {
    pane.append(h('div', { class: 'toolrow' }, btn('+ ' + t('addCategory'), () => editCategory(null), 'ghost'), S.categories.length ? btn('+ ' + t('addItem'), () => editItem(null), 'primary') : null));
    S.categories.forEach((cat, ci) => {
      const its = S.items.filter((i) => i.cat === cat.id);
      pane.append(h('section', { class: 'edcat' },
        h('div', { class: 'edcat-h' }, h('h3', null, bn(cat.name)),
          h('div', { class: 'tk-acts' }, btn('↑', () => move(S.categories, ci, -1), 'mini ghost', { 'aria-label': t('moveUp') }), btn('↓', () => move(S.categories, ci, 1), 'mini ghost', { 'aria-label': t('moveDown') }),
            btn('✎', () => editCategory(cat), 'mini ghost', { 'aria-label': t('edit') }),
            btn('🗑', async () => { if (await ask(t('confirmDelete'), true)) { S.items = S.items.filter((i) => i.cat !== cat.id); S.categories = S.categories.filter((c) => c !== cat); save(); render(true); } }, 'mini ghost', { 'aria-label': t('del') }))),
        its.map((it) => h('div', { class: 'edit-row' + (it.available ? '' : ' off') },
          h('span', { class: 'em' }, it.emoji), h('div', { class: 'ei' }, h('b', null, bn(it.name)), h('small', null, money(it.price) + (it.popular ? ' ★' : ''))),
          h('label', { class: 'sw', title: t('available') }, h('input', { type: 'checkbox', checked: it.available, 'aria-label': t('available') + ' ' + bn(it.name), onchange: (e) => { it.available = e.target.checked; save(); render(true); } }), h('i')),
          btn('✎', () => editItem(it), 'mini ghost', { 'aria-label': t('edit') + ' ' + bn(it.name) }),
          btn('🗑', async () => { if (await ask(t('confirmDelete'), true)) { S.items = S.items.filter((x) => x !== it); save(); render(true); } }, 'mini ghost', { 'aria-label': t('del') + ' ' + bn(it.name) })))));
    });
  }

  async function sharePayload() {
    const key = JSON.stringify(C.shareConfig(S));
    if (shareCache.key !== key) shareCache = { key, payload: await C.packText(key) };
    return shareCache.payload;
  }
  const baseUrl = () => location.origin + location.pathname;
  function qrSvg(text) {
    const qr = window.qrcode(0, 'L'); qr.addData(text, 'Byte'); qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }
  function studioTables(pane) {
    const nTables = S.brand.tables;
    const num = h('input', { type: 'number', min: 0, max: 200, value: nTables, 'aria-label': t('tablesCount'), onchange: (e) => { S.brand.tables = Math.round(C.num(e.target.value, 0, 200, 8)); save(); render(true); } });
    pane.append(h('div', { class: 'toolrow' }, fld(t('tablesCount'), num)));
    const holder = h('div', { class: 'qrs' });
    const linkBox = h('input', { readonly: true, 'aria-label': t('shareLink') });
    pane.append(fld(t('shareLink'), linkBox), h('div', { class: 'toolrow' }, btn(t('copyLink'), () => navigator.clipboard && navigator.clipboard.writeText(linkBox.value).then(() => toast(t('copied'))), 'ghost'), btn('🖨 ' + t('printQr'), () => window.print(), 'primary')), holder);
    sharePayload().then((p) => {
      const mk = (tb) => baseUrl() + '#/menu?' + (tb ? 't=' + tb + '&' : '') + 'd=' + p;
      linkBox.value = mk('');
      const cards = [];
      for (let i = 0; i <= nTables; i++) {
        const label = i === 0 ? t('pickupQr') : t('tableQr') + ' ' + nf(i);
        let svg;
        try { svg = qrSvg(mk(i || '')); } catch (e) { holder.replaceChildren(h('p', { class: 'err' }, t('qrTooBig'))); return; }
        const card = h('figure', { class: 'qrcard' }, h('div', { class: 'qrsvg' }), h('figcaption', null, h('b', null, bn(S.brand.name)), h('span', null, label), h('small', null, t('scanToOrder'))));
        card.querySelector('.qrsvg').innerHTML = svg; // generated by the QR library from our own link, no user HTML
        cards.push(card);
      }
      holder.replaceChildren(...cards);
      document.body.dataset.qrReady = '1';
    }).catch(() => holder.replaceChildren(h('p', { class: 'err' }, t('qrTooBig'))));
    pane.append(h('p', { class: 'hint' }, t('how1')));
  }

  const PRESETS = [['#0f5c55', '#e9a23b'], ['#b3261e', '#ffb703'], ['#6b3f2a', '#d98e3f'], ['#1d3557', '#f4a261'], ['#2d6a4f', '#ffd166'], ['#7b2cbf', '#ffc857'], ['#222222', '#e63946']];
  function resizeImage(file, max) {
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
        resolve(cv.toDataURL('image/webp', 0.85).startsWith('data:image/webp') ? cv.toDataURL('image/webp', 0.85) : cv.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img')); };
      img.src = url;
    });
  }
  function studioBrand(pane) {
    const b = S.brand;
    const live = () => { save(); applyChrome(); };
    const txt = (label, get, set, attrs) => fld(label, h('input', Object.assign({ value: get(), onchange: (e) => { set(C.str(e.target.value, 80)); live(); } }, attrs)));
    const two = (label, o, max) => h('div', { class: 'two' }, txt(label + ' (AR)', () => o.ar, (v) => { o.ar = v; }, { dir: 'rtl', maxlength: max }), txt(label + ' (EN)', () => o.en, (v) => { o.en = v; }, { dir: 'ltr', maxlength: max }));
    const sw = h('div', { class: 'swatches' }, PRESETS.map(([p, a]) => h('button', { type: 'button', class: 'swatch', style: 'background:linear-gradient(135deg,' + p + ' 50%,' + a + ' 50%)', 'aria-label': p + ' ' + a, onclick: () => { b.colors.primary = p; b.colors.accent = a; live(); render(true); } })));
    const logoPrev = h('div', { class: 'logo-prev' }, logoEl('lg'));
    pane.append(h('div', { class: 'form' },
      two(t('brandName'), b.name, 40), two(t('tagline'), b.tagline, 80), two(t('about'), b.about, 200),
      h('div', { class: 'two' }, logoPrev, h('div', null,
        fld(t('logoEmoji'), h('input', { value: b.logo.emoji, maxlength: 8, onchange: (e) => { b.logo.emoji = C.str(e.target.value, 8) || '🍽️'; live(); render(true); } })),
        h('div', { class: 'toolrow' },
          h('label', { class: 'btn ghost mini filebtn' }, t('uploadLogo'), h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', onchange: async (e) => { const f = e.target.files[0]; if (!f) return; try { b.logo.image = await resizeImage(f, 160); live(); render(true); } catch (x) { toast(t('importBad')); } } })),
          b.logo.image ? btn(t('removeLogo'), () => { b.logo.image = ''; live(); render(true); }, 'mini ghost') : null))),
      sw,
      h('div', { class: 'two' },
        fld(t('colorMain'), h('input', { type: 'color', value: b.colors.primary, oninput: (e) => { b.colors.primary = e.target.value; applyChrome(); }, onchange: live })),
        fld(t('colorAccent'), h('input', { type: 'color', value: b.colors.accent, oninput: (e) => { b.colors.accent = e.target.value; applyChrome(); }, onchange: live }))),
      h('div', { class: 'two' },
        txt(t('currencySym') + ' (AR)', () => b.currency.symbol.ar, (v) => { b.currency.symbol.ar = v; }, { maxlength: 12, dir: 'rtl' }),
        txt(t('currencySym') + ' (EN)', () => b.currency.symbol.en, (v) => { b.currency.symbol.en = v; }, { maxlength: 12, dir: 'ltr' })),
      h('div', { class: 'two' },
        fld(t('currencyPos'), h('select', { onchange: (e) => { b.currency.pos = e.target.value; live(); } }, h('option', { value: 'after', selected: b.currency.pos === 'after' }, t('posAfter')), h('option', { value: 'before', selected: b.currency.pos === 'before' }, t('posBefore')))),
        fld(t('decimals'), h('select', { onchange: (e) => { b.currency.decimals = +e.target.value; live(); } }, [0, 1, 2, 3].map((n) => h('option', { value: n, selected: b.currency.decimals === n }, n))))),
      h('div', { class: 'two' },
        fld(t('defLang'), h('select', { onchange: (e) => { b.lang = e.target.value; S.ui.lang = ''; live(); render(true); } }, h('option', { value: 'ar', selected: b.lang === 'ar' }, 'العربية'), h('option', { value: 'en', selected: b.lang === 'en' }, 'English'))),
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: b.arabicDigits, onchange: (e) => { b.arabicDigits = e.target.checked; live(); render(true); } }), t('arDigits'))),
      h('div', { class: 'two' },
        fld(t('taxPct'), h('input', { inputmode: 'decimal', value: b.taxPct, onchange: (e) => { b.taxPct = C.num(e.target.value, 0, 50, 0); live(); } })),
        fld(t('servicePct'), h('input', { inputmode: 'decimal', value: b.servicePct, onchange: (e) => { b.servicePct = C.num(e.target.value, 0, 50, 0); live(); } }))),
      h('div', { class: 'two' },
        fld(t('whatsapp'), h('input', { inputmode: 'tel', value: b.whatsapp, placeholder: '01012345678', maxlength: 20, onchange: (e) => { b.whatsapp = C.str(e.target.value, 20); live(); } })),
        fld(t('countryCode'), h('input', { inputmode: 'numeric', value: b.countryCode, maxlength: 5, onchange: (e) => { b.countryCode = C.str(e.target.value, 5).replace(/\D/g, '') || '20'; live(); } }))),
      fld(t('pickupMinutes'), h('input', { inputmode: 'numeric', value: b.pickupMinutes, onchange: (e) => { b.pickupMinutes = Math.round(C.num(e.target.value, 0, 240, 20)); live(); } }))));
    pane.append(h('div', { class: 'livebox' }, h('h3', null, t('liveTitle')),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!b.liveTopic, onchange: (e) => { b.liveTopic = e.target.checked ? C.newTopic() : ''; live(); liveSync(); render(true); } }), t('liveOn')),
      h('p', { class: 'hint' }, t('liveHelp')),
      b.liveTopic ? h('p', { class: 'hint' }, t('liveShareAgain')) : null));
  }

  function studioData(pane) {
    pane.append(h('p', { class: 'hint' }, t('dataNote')));
    const cfgOut = () => ({ app: 'matbakh', version: 1, brand: S.brand, categories: S.categories, items: S.items });
    const stamp = new Date().toISOString().slice(0, 10);
    const fileIn = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const raw = JSON.parse(await f.text());
        const c2 = C.sanitizeConfig(raw);
        Object.assign(S, c2);
        if (Array.isArray(raw.orders)) { S.orders = raw.orders.map(C.sanitizeOrder).filter(Boolean); if (raw.counter && typeof raw.counter.n === 'number') S.counter = { day: String(raw.counter.day || ''), n: raw.counter.n }; }
        cart = []; saveCart(); save(); applyChrome(); toast(t('importOk')); render(true);
      } catch (err) { toast(t('importBad')); }
      e.target.value = '';
    } });
    pane.append(h('div', { class: 'datagrid' },
      btn('⤓ ' + t('exportBrand'), () => download('matbakh-' + stamp + '.json', JSON.stringify(cfgOut(), null, 2), 'application/json'), 'ghost wide'),
      btn('⤓ ' + t('exportAll'), () => download('matbakh-backup-' + stamp + '.json', JSON.stringify(Object.assign(cfgOut(), { orders: S.orders, counter: S.counter }), null, 2), 'application/json'), 'ghost wide'),
      btn('⤒ ' + t('importBrand'), () => fileIn.click(), 'ghost wide'), fileIn));
    pane.append(h('h3', null, t('templates')), h('div', { class: 'tpls' }, [['cafe', 'tplCafe'], ['fast', 'tplFast'], ['bakery', 'tplBakery']].map(([k, l]) =>
      h('button', { type: 'button', class: 'tpl', onclick: async () => {
        if (!(await ask(t('confirmTemplate')))) return;
        Object.assign(S, C.sanitizeConfig(clone(TPL[k]))); S.ui.lang = ''; cart = []; saveCart(); save(); applyChrome(); render(true);
      } }, h('span', null, TPL[k].brand.logo.emoji), t(l)))));
    pane.append(h('div', { class: 'toolrow' }, btn('⚠ ' + t('resetAll'), async () => { if (await ask(t('confirmReset'), true)) { S = fresh(); cart = []; saveCart(); save(); applyChrome(); render(true); } }, 'danger')));
  }

  /* ---------- render ---------- */
  function render(keepScroll) {
    const y = window.scrollY;
    let view;
    if (loading) view = h('p', { class: 'empty' }, t('loadingMenu'));
    else if (badLink) view = h('div', { class: 'done' }, h('h1', null, t('badLink')), btn(t('openOwn'), () => { location.hash = '#/menu'; location.reload(); }, 'primary'));
    else {
      const p = route.path[0];
      if (p === 'cart') view = cartView();
      else if (p === 'done') view = doneView();
      else if (!guest && p === 'kitchen') view = kitchenView();
      else if (!guest && p === 'orders') view = ordersView();
      else if (!guest && p === 'studio') view = studioView();
      else view = menuView();
    }
    const kids = shell(view);
    if (!loading && !badLink && route.path[0] === 'menu') { const cb = cartBar(); if (cb) kids.push(cb); }
    if (guest && !loading && !badLink) kids.push(h('a', { class: 'ownlink', href: location.pathname, onclick: () => { sessionStorage.clear(); } }, t('openOwn')));
    $app.replaceChildren(...kids);
    window.scrollTo(0, keepScroll ? y : 0);
    if (!guest) { const n = S.orders.filter((o) => o.status === 'new').length; document.title = (n ? '(' + n + ') ' : '') + bn(brand().name) + ' | ' + t('menu'); }
  }

  /* ---------- boot ---------- */
  S = load();
  cart = loadCart();
  window.addEventListener('hashchange', onRoute);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const d = document.querySelector('dialog[open]'); if (d) d.querySelector('.x').click(); } });
  window.__mb = { get state() { return S; }, get guest() { return guest; } }; // read-only debug handle used by the browser tests
  onRoute();
  liveSync();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
