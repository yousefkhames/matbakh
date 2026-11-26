/* Matbakh core: pure logic, no DOM. Works in the browser (window.MB) and in Node (tests). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MB = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const HEX = /^#[0-9a-fA-F]{6}$/;
  const ID = /^[a-zA-Z0-9_-]{1,24}$/;
  const STATUS = ['new', 'preparing', 'ready', 'done', 'cancelled'];

  function uid(prefix) {
    return (prefix || 'x') + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  }
  function str(v, max) {
    return (typeof v === 'string' ? v : v == null ? '' : String(v)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max || 200);
  }
  function num(v, min, max, dflt) {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    if (!isFinite(n)) return dflt;
    return Math.min(max, Math.max(min, n));
  }
  function bi(v, max) {
    v = v && typeof v === 'object' ? v : {};
    return { ar: str(v.ar, max), en: str(v.en, max) };
  }

  /* ---------- money ---------- */
  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  function toArabicDigits(s) {
    return String(s).replace(/[0-9]/g, (d) => AR_DIGITS[+d]).replace(/\./g, '٫');
  }
  function fmtNumber(n, decimals, arabic) {
    let s = Number(n).toFixed(decimals);
    if (decimals > 0 && /\.0+$/.test(s) && false) s = s.replace(/\.0+$/, '');
    return arabic ? toArabicDigits(s) : s;
  }
  // cur: {symbol:{ar,en}, pos:'after'|'before', decimals:0..3}
  function fmtMoney(n, cur, lang, arabicDigits) {
    const sym = (cur.symbol && (cur.symbol[lang] || cur.symbol.en || cur.symbol.ar)) || '';
    const body = fmtNumber(n, cur.decimals, lang === 'ar' && arabicDigits);
    if (!sym) return body;
    return cur.pos === 'before' ? sym + ' ' + body : body + ' ' + sym;
  }

  /* ---------- cart / totals (integer minor units to avoid float drift) ---------- */
  function cartTotals(lines, taxPct, servicePct, decimals) {
    const f = Math.pow(10, decimals == null ? 2 : decimals);
    let sub = 0;
    for (const l of lines) sub += Math.round(l.price * f) * l.qty;
    const service = Math.round((sub * (servicePct || 0)) / 100);
    const tax = Math.round(((sub + service) * (taxPct || 0)) / 100);
    return { sub: sub / f, service: service / f, tax: tax / f, total: (sub + service + tax) / f };
  }

  /* ---------- phone / whatsapp ---------- */
  function normalizePhone(raw, cc) {
    let d = String(raw || '').replace(/[^\d+]/g, '');
    if (!d) return '';
    if (d.startsWith('+')) return d.slice(1).replace(/\D/g, '');
    d = d.replace(/\D/g, '');
    if (d.startsWith('00')) return d.slice(2);
    cc = String(cc || '').replace(/\D/g, '');
    if (d.startsWith('0') && cc) return cc + d.slice(1);
    return d;
  }
  /* ---------- live relay (ntfy.sh, optional) ---------- */
  const LIVE_HOST = 'https://ntfy.sh/';
  function newTopic() {
    const a = new Uint8Array(16); (typeof crypto !== 'undefined' ? crypto : require('crypto').webcrypto).getRandomValues(a);
    return 'mb' + Array.from(a, (x) => (x % 36).toString(36)).join('');
  }
  function liveUrl(topic, suffix) { return LIVE_HOST + topic + (suffix || ''); }

  function waLink(phone, text) {
    return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(text);
  }

  /* ---------- base64url / compression ---------- */
  function bytesToB64url(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlToBytes(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function pipeBytes(bytes, stream) {
    const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await res.arrayBuffer());
  }
  async function packText(text) {
    const raw = new TextEncoder().encode(text);
    if (typeof CompressionStream !== 'undefined') {
      try {
        const z = await pipeBytes(raw, new CompressionStream('deflate-raw'));
        if (z.length < raw.length) return 'z' + bytesToB64url(z);
      } catch (e) { /* fall through */ }
    }
    return 'j' + bytesToB64url(raw);
  }
  async function unpackText(s) {
    const kind = s[0];
    const bytes = b64urlToBytes(s.slice(1));
    if (kind === 'j') return new TextDecoder().decode(bytes);
    if (kind === 'z') {
      if (typeof DecompressionStream === 'undefined') throw new Error('no-decompress');
      return new TextDecoder().decode(await pipeBytes(bytes, new DecompressionStream('deflate-raw')));
    }
    throw new Error('bad-payload');
  }

  /* ---------- config sanitizing (branding + menu). Used for import and shared links ---------- */
  function sanitizeBrand(b) {
    b = b && typeof b === 'object' ? b : {};
    const cur = b.currency && typeof b.currency === 'object' ? b.currency : {};
    const sym = bi(cur.symbol, 12);
    const logo = b.logo && typeof b.logo === 'object' ? b.logo : {};
    const img = typeof logo.image === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo.image) && logo.image.length < 120000 ? logo.image : '';
    return {
      name: bi(b.name, 40),
      tagline: bi(b.tagline, 80),
      about: bi(b.about, 200),
      logo: { emoji: str(logo.emoji, 8) || '🍽️', image: img },
      colors: {
        primary: HEX.test(b.colors && b.colors.primary) ? b.colors.primary : '#0f5c55',
        accent: HEX.test(b.colors && b.colors.accent) ? b.colors.accent : '#e9a23b',
      },
      currency: { symbol: sym.en || sym.ar ? sym : { ar: 'ج.م', en: 'EGP' }, pos: cur.pos === 'before' ? 'before' : 'after', decimals: Math.round(num(cur.decimals, 0, 3, 0)) },
      lang: b.lang === 'en' ? 'en' : 'ar',
      arabicDigits: !!b.arabicDigits,
      taxPct: num(b.taxPct, 0, 50, 0),
      servicePct: num(b.servicePct, 0, 50, 0),
      whatsapp: str(b.whatsapp, 20),
      liveTopic: /^[a-z0-9]{12,40}$/.test(String(b.liveTopic || '')) ? String(b.liveTopic) : '',
      countryCode: str(b.countryCode, 5).replace(/\D/g, '') || '20',
      tables: Math.round(num(b.tables, 0, 200, 8)),
      pickupMinutes: Math.round(num(b.pickupMinutes, 0, 240, 20)),
    };
  }

  function sanitizeConfig(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('not-object');
    const brand = sanitizeBrand(raw.brand);
    if (!brand.name.ar && !brand.name.en) throw new Error('no-name');
    const seen = new Set();
    const mk = (id, prefix) => {
      id = ID.test(String(id)) && !seen.has(id) ? String(id) : uid(prefix);
      seen.add(id);
      return id;
    };
    const categories = (Array.isArray(raw.categories) ? raw.categories : []).slice(0, 40).map((c) => ({
      id: mk(c && c.id, 'c'),
      name: bi(c && c.name, 40),
    })).filter((c) => c.name.ar || c.name.en);
    const catIds = new Set(categories.map((c) => c.id));
    const rawCats = Array.isArray(raw.categories) ? raw.categories : [];
    const idMap = {};
    rawCats.slice(0, 40).forEach((c, i) => { if (c && categories[i]) idMap[c.id] = categories[i].id; });
    const items = [];
    for (const it of (Array.isArray(raw.items) ? raw.items : []).slice(0, 400)) {
      if (!it || typeof it !== 'object') continue;
      const name = bi(it.name, 60);
      if (!name.ar && !name.en) continue;
      let cat = catIds.has(it.cat) ? it.cat : idMap[it.cat];
      if (!cat) cat = categories[0] && categories[0].id;
      if (!cat) continue;
      items.push({
        id: mk(it.id, 'i'),
        cat,
        name,
        desc: bi(it.desc, 160),
        price: num(it.price, 0, 1000000, 0),
        emoji: str(it.emoji, 8) || '🍽️',
        available: it.available !== false,
        popular: !!it.popular,
      });
    }
    return { brand, categories, items };
  }

  // Drop empty strings, empty objects and default flags so the shared link (and its QR code) stays small.
  function prune(v, key) {
    if (Array.isArray(v)) return v.map((x) => prune(x));
    if (v && typeof v === 'object') {
      const o = {};
      for (const k of Object.keys(v)) {
        const p = prune(v[k], k);
        if (p === undefined) continue;
        o[k] = p;
      }
      return Object.keys(o).length ? o : undefined;
    }
    if (v === '' || v === false && key !== 'available') return undefined;
    if (key === 'available' && v === true) return undefined;
    return v;
  }
  function shareConfig(state) {
    const b = JSON.parse(JSON.stringify(state.brand));
    b.logo.image = '';
    return prune({ brand: b, categories: state.categories, items: state.items });
  }

  /* ---------- orders ---------- */
  function lineName(l, lang) {
    return (l.name && (l.name[lang] || l.name.en || l.name.ar)) || '';
  }
  function dayKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function nextOrderNo(counter, now) {
    const day = dayKey(now);
    const n = counter && counter.day === day ? counter.n + 1 : 1;
    return { no: n, counter: { day, n } };
  }

  // Compact code embedded in WhatsApp messages so the kitchen can import the order with one paste.
  function encodeOrder(o) {
    const c = {
      v: 1, id: o.id, ty: o.type, tb: o.table || '', n: o.name || '', p: o.phone || '', nt: o.note || '', ts: o.createdAt,
      l: o.lines.map((l) => [l.name.ar, l.name.en, l.price, l.qty, l.note || '']),
      tt: [o.totals.sub, o.totals.service, o.totals.tax, o.totals.total],
    };
    return 'MB1.' + bytesToB64url(new TextEncoder().encode(JSON.stringify(c)));
  }
  function decodeOrder(code) {
    const m = /MB1\.([A-Za-z0-9_-]+)/.exec(String(code || ''));
    if (!m) throw new Error('no-code');
    let c;
    try { c = JSON.parse(new TextDecoder().decode(b64urlToBytes(m[1]))); } catch (e) { throw new Error('bad-code'); }
    if (!c || c.v !== 1 || !Array.isArray(c.l) || !c.l.length || c.l.length > 100) throw new Error('bad-code');
    const lines = c.l.map((l) => ({
      name: { ar: str(l[0], 60), en: str(l[1], 60) },
      price: num(l[2], 0, 1000000, 0),
      qty: Math.round(num(l[3], 1, 99, 1)),
      note: str(l[4], 100),
    }));
    const tt = Array.isArray(c.tt) ? c.tt : [];
    const sub = lines.reduce((s, l) => s + l.price * l.qty, 0);
    return {
      origin: str(c.id, 30),
      type: c.ty === 'table' ? 'table' : 'pickup',
      table: str(c.tb, 6),
      name: str(c.n, 40),
      phone: str(c.p, 20),
      note: str(c.nt, 200),
      createdAt: typeof c.ts === 'number' ? c.ts : Date.now(),
      lines,
      totals: { sub: num(tt[0], 0, 1e9, sub), service: num(tt[1], 0, 1e9, 0), tax: num(tt[2], 0, 1e9, 0), total: num(tt[3], 0, 1e9, sub) },
    };
  }

  const MSG = {
    en: { hello: 'New order', table: 'Table', pickup: 'Pickup', name: 'Name', phone: 'Phone', note: 'Note', sub: 'Subtotal', service: 'Service', tax: 'Tax', total: 'Total', code: 'Order code (paste it in Matbakh kitchen to import)' },
    ar: { hello: 'طلب جديد', table: 'طاولة', pickup: 'استلام', name: 'الاسم', phone: 'الموبايل', note: 'ملاحظات', sub: 'المجموع', service: 'الخدمة', tax: 'الضريبة', total: 'الإجمالي', code: 'كود الطلب (الصقه في شاشة المطبخ لاستيراده)' },
  };
  function orderText(o, brand, lang, arabicDigits) {
    const m = MSG[lang] || MSG.en;
    const money = (n) => fmtMoney(n, brand.currency, lang, arabicDigits);
    const rname = brand.name[lang] || brand.name.en || brand.name.ar;
    const out = [];
    out.push('*' + m.hello + '* - ' + rname);
    out.push(o.type === 'table' ? m.table + ' ' + o.table : m.pickup);
    if (o.name) out.push(m.name + ': ' + o.name);
    if (o.phone) out.push(m.phone + ': ' + o.phone);
    out.push('');
    for (const l of o.lines) out.push(l.qty + ' x ' + lineName(l, lang) + ' = ' + money(l.price * l.qty) + (l.note ? ' (' + l.note + ')' : ''));
    out.push('');
    if (o.totals.service) out.push(m.service + ': ' + money(o.totals.service));
    if (o.totals.tax) out.push(m.tax + ': ' + money(o.totals.tax));
    out.push('*' + m.total + ': ' + money(o.totals.total) + '*');
    if (o.note) out.push(m.note + ': ' + o.note);
    out.push('');
    out.push(m.code + ':');
    out.push(encodeOrder(o));
    return out.join('\n');
  }

  function readyText(o, brand, lang) {
    const rname = brand.name[lang] || brand.name.en || brand.name.ar;
    return lang === 'ar'
      ? 'أهلاً ' + (o.name || '') + '، طلبك رقم ' + o.no + ' جاهز للاستلام من ' + rname + ' 🍽️'
      : 'Hi ' + (o.name || '') + ', your order #' + o.no + ' is ready for pickup at ' + rname + ' 🍽️';
  }
  function confirmText(o, brand, lang) {
    const rname = brand.name[lang] || brand.name.en || brand.name.ar;
    return lang === 'ar'
      ? 'أهلاً ' + (o.name || '') + '، استلمنا طلبك رقم ' + o.no + ' في ' + rname + '. هيكون جاهز في حدود ' + brand.pickupMinutes + ' دقيقة.'
      : 'Hi ' + (o.name || '') + ', we got your order #' + o.no + ' at ' + rname + '. It will be ready in about ' + brand.pickupMinutes + ' minutes.';
  }

  const NEXT = { new: 'preparing', preparing: 'ready', ready: 'done' };
  const PREV = { preparing: 'new', ready: 'preparing', done: 'ready', cancelled: 'new' };

  function stats(orders, fromTs) {
    const live = orders.filter((o) => o.status === 'done' && o.createdAt >= fromTs);
    const sales = live.reduce((s, o) => s + o.totals.total, 0);
    const top = {};
    for (const o of live) for (const l of o.lines) {
      const k = l.name.en || l.name.ar;
      top[k] = top[k] || { name: l.name, qty: 0, amount: 0 };
      top[k].qty += l.qty;
      top[k].amount += l.qty * l.price;
    }
    return { count: live.length, sales, avg: live.length ? sales / live.length : 0, top: Object.values(top).sort((a, b) => b.qty - a.qty).slice(0, 5) };
  }

  function csvCell(v) {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // block spreadsheet formula injection
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function ordersCsv(orders, lang) {
    const rows = [['no', 'date', 'type', 'table', 'name', 'phone', 'status', 'items', 'subtotal', 'service', 'tax', 'total', 'note']];
    for (const o of orders) {
      rows.push([o.no, new Date(o.createdAt).toISOString(), o.type, o.table, o.name, o.phone, o.status,
        o.lines.map((l) => l.qty + 'x ' + lineName(l, lang)).join('; '), o.totals.sub, o.totals.service, o.totals.tax, o.totals.total, o.note]);
    }
    return '\ufeff' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  }

  function sanitizeOrder(o) {
    if (!o || typeof o !== 'object' || !Array.isArray(o.lines) || !o.lines.length) return null;
    const lines = o.lines.slice(0, 100).map((l) => ({
      name: bi(l.name, 60), price: num(l.price, 0, 1e6, 0), qty: Math.round(num(l.qty, 1, 99, 1)), note: str(l.note, 100),
    }));
    const t = o.totals || {};
    return {
      id: str(o.id, 30) || uid('o'), no: Math.round(num(o.no, 0, 1e6, 0)), origin: str(o.origin, 30),
      type: o.type === 'table' ? 'table' : 'pickup', table: str(o.table, 6), name: str(o.name, 40), phone: str(o.phone, 20), note: str(o.note, 200),
      status: STATUS.includes(o.status) ? o.status : 'new', createdAt: num(o.createdAt, 0, 8.64e15, Date.now()),
      updatedAt: num(o.updatedAt, 0, 8.64e15, Date.now()), lines,
      totals: { sub: num(t.sub, 0, 1e9, 0), service: num(t.service, 0, 1e9, 0), tax: num(t.tax, 0, 1e9, 0), total: num(t.total, 0, 1e9, 0) },
    };
  }

  return {
    STATUS, NEXT, PREV, uid, str, num, bi, fmtMoney, fmtNumber, toArabicDigits, cartTotals, normalizePhone, waLink, newTopic, liveUrl,
    bytesToB64url, b64urlToBytes, packText, unpackText, sanitizeBrand, sanitizeConfig, sanitizeOrder, shareConfig,
    dayKey, nextOrderNo, encodeOrder, decodeOrder, orderText, readyText, confirmText, lineName, stats, ordersCsv, csvCell,
  };
});
