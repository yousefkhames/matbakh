/* MIT · Copyright (c) 2026 Yousef Khames · matbakh core: order codes, totals and kitchen board logic (browser and Node). */
(function (root) {
  'use strict';
  const STATUS = ['new', 'preparing', 'ready', 'served'];
  const PREFIX = 'MB1.';
  const b64 = {
    enc: (s) => (typeof Buffer !== 'undefined' ? Buffer.from(s, 'utf8').toString('base64') : btoa(String.fromCharCode(...new TextEncoder().encode(s)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    dec: (s) => { const p = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4); return typeof Buffer !== 'undefined' ? Buffer.from(p, 'base64').toString('utf8') : new TextDecoder().decode(Uint8Array.from(atob(p), (c) => c.charCodeAt(0))); }
  };
  const cleanQty = (n) => { n = Math.floor(Number(n)); return n >= 1 && n <= 99 ? n : 0; };
  function makeOrder(id, table, lines, ts, note, demo) {
    return { id: String(id), table: Math.max(0, Math.min(99, Math.floor(Number(table)) || 0)), ts: Number(ts) || 0, note: String(note || '').slice(0, 200), demo: !!demo,
      lines: lines.map((l) => ({ item: String(l.item).slice(0, 40), qty: cleanQty(l.qty), note: String(l.note || '').slice(0, 120) })).filter((l) => l.qty) };
  }
  function encode(o) { return PREFIX + b64.enc(JSON.stringify([o.id, o.table, o.ts, o.note, o.demo ? 1 : 0, o.lines.map((l) => [l.item, l.qty, l.note])])); }
  function decode(code) {
    const m = String(code || '').match(/MB1\.([A-Za-z0-9_-]+)/); if (!m) return null;
    try {
      const a = JSON.parse(b64.dec(m[1])); if (!Array.isArray(a) || a.length < 6 || !Array.isArray(a[5])) return null;
      const o = makeOrder(a[0], a[1], a[5].map((l) => ({ item: l[0], qty: l[1], note: l[2] })), a[2], a[3], a[4] === 1);
      return o.lines.length && o.id ? o : null;
    } catch (e) { return null; }
  }
  function priceOf(menu, id) { const it = menu.items.find((i) => i.id === id); return it ? it : null; }
  function totals(menu, order) {
    let total = 0, unknown = 0, unpriced = 0;
    order.lines.forEach((l) => { const it = priceOf(menu, l.item); if (!it) unknown++; else if (it.price === null) unpriced++; else total += it.price * l.qty; });
    return { total: Math.round(total * 100) / 100, unknown, unpriced };
  }
  function orderText(menu, order, lang, shopName) {
    const L = lang === 'en';
    const lines = order.lines.map((l) => { const it = priceOf(menu, l.item); const n = it ? (it.name[lang] || it.name.ar || it.name.en) : l.item; return l.qty + ' × ' + n + (l.note ? ' (' + l.note + ')' : ''); });
    const t = totals(menu, order);
    return [(order.demo ? (L ? '[DEMO order] ' : '[طلب تجريبي] ') : '') + (L ? 'New order' : 'طلب جديد') + (shopName ? ' - ' + shopName : ''),
      (order.table ? (L ? 'Table: ' : 'الطاولة: ') + order.table : ''), ...lines,
      t.unknown || t.unpriced ? '' : (L ? 'Total (menu prices): ' : 'الإجمالي حسب القائمة: ') + t.total + (menu.currency ? ' ' + menu.currency : ''),
      order.note ? (L ? 'Note: ' : 'ملاحظة: ') + order.note : '', (L ? 'Order code: ' : 'كود الطلب: ') + encode(order)].filter(Boolean).join('\n');
  }
  function advance(o) { const i = STATUS.indexOf(o.status); return i >= 0 && i < STATUS.length - 1 ? STATUS[i + 1] : o.status; }
  function elapsedMin(o, now) { return Math.max(0, Math.floor((now - o.receivedAt) / 60000)); }
  function addIncoming(list, order, now) {
    if (list.some((o) => o.id === order.id)) return { ok: false, error: 'dup' };
    return { ok: true, list: list.concat([Object.assign({}, order, { status: 'new', receivedAt: now })]) };
  }
  function tableUrl(base, n) { const u = String(base || '').split('#')[0].replace(/\/?$/, '/'); return u + '#/t/' + n; }
  const api = { STATUS, makeOrder, encode, decode, totals, orderText, advance, elapsedMin, addIncoming, tableUrl };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.MatCore = api;
})(globalThis);
