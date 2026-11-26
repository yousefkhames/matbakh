const test = require('node:test');
const assert = require('node:assert');
const C = require('../js/core.js');
const TPL = require('../js/data.js');
const I18N = require('../js/i18n.js');

const brand = () => C.sanitizeConfig(JSON.parse(JSON.stringify(TPL.cafe))).brand;

test('money formatting: after/before, decimals, Arabic digits', () => {
  const cur = { symbol: { ar: 'ج.م', en: 'EGP' }, pos: 'after', decimals: 0 };
  assert.strictEqual(C.fmtMoney(45, cur, 'en', false), '45 EGP');
  assert.strictEqual(C.fmtMoney(45, cur, 'ar', true), '٤٥ ج.م');
  assert.strictEqual(C.fmtMoney(45, cur, 'ar', false), '45 ج.م');
  assert.strictEqual(C.fmtMoney(3.5, { symbol: { ar: '$', en: '$' }, pos: 'before', decimals: 2 }, 'en', false), '$ 3.50');
});

test('totals use integer minor units (no float drift)', () => {
  const t = C.cartTotals([{ price: 0.1, qty: 3 }, { price: 0.2, qty: 1 }], 0, 0, 2);
  assert.strictEqual(t.total, 0.5);
  const t2 = C.cartTotals([{ price: 100, qty: 2 }], 14, 12, 0);
  assert.deepStrictEqual(t2, { sub: 200, service: 24, tax: 31, total: 255 });
});

test('phone normalization for wa.me', () => {
  assert.strictEqual(C.normalizePhone('01012345678', '20'), '201012345678');
  assert.strictEqual(C.normalizePhone('+20 101 234 5678', '20'), '201012345678');
  assert.strictEqual(C.normalizePhone('0020 101 234 5678', '20'), '201012345678');
  assert.strictEqual(C.normalizePhone('', '20'), '');
  assert.ok(C.waLink('201012345678', 'a b\nc').startsWith('https://wa.me/201012345678?text=a%20b%0Ac'));
});

test('order code round trip and text builder', () => {
  const o = { id: 'o1', type: 'table', table: '4', name: 'منى', phone: '0101', note: 'بدون بصل', createdAt: 1700000000000,
    lines: [{ name: { ar: 'كشري', en: 'Koshary' }, price: 45, qty: 2, note: 'شطة' }], totals: { sub: 90, service: 0, tax: 0, total: 90 } };
  const code = C.encodeOrder(o);
  const d = C.decodeOrder('some text\n' + code + '\nmore');
  assert.strictEqual(d.origin, 'o1'); assert.strictEqual(d.table, '4'); assert.strictEqual(d.name, 'منى');
  assert.strictEqual(d.lines[0].qty, 2); assert.strictEqual(d.lines[0].name.ar, 'كشري'); assert.strictEqual(d.totals.total, 90);
  const txt = C.orderText(o, brand(), 'ar', false);
  assert.ok(txt.includes('كشري') && txt.includes(code) && txt.includes('90'));
  assert.throws(() => C.decodeOrder('hello'));
  assert.throws(() => C.decodeOrder('MB1.!!!'));
  assert.throws(() => C.decodeOrder('MB1.' + C.bytesToB64url(new TextEncoder().encode('{"v":2}'))));
});

test('decodeOrder clamps hostile values', () => {
  const evil = { v: 1, id: 'x', ty: 'pickup', n: 'a'.repeat(500), l: [['<img onerror=1>', 'x', -5, 9999, 'n']], tt: [1e99, 'x'] };
  const d = C.decodeOrder('MB1.' + C.bytesToB64url(new TextEncoder().encode(JSON.stringify(evil))));
  assert.strictEqual(d.name.length, 40); assert.strictEqual(d.lines[0].price, 0); assert.strictEqual(d.lines[0].qty, 99); assert.ok(d.totals.sub <= 1e9);
});

test('share payload compresses and round-trips', async () => {
  const cfg = C.shareConfig({ brand: brand(), categories: C.sanitizeConfig(TPL.cafe).categories, items: C.sanitizeConfig(TPL.cafe).items });
  const json = JSON.stringify(cfg);
  const p = await C.packText(json);
  assert.ok(p[0] === 'z' && p.length < json.length);
  assert.strictEqual(await C.unpackText(p), json);
  assert.ok(/^[A-Za-z0-9_-]+$/.test(p));
  await assert.rejects(() => C.unpackText('q123'));
});

test('sanitizeConfig rejects junk and repairs fields', () => {
  assert.throws(() => C.sanitizeConfig(null));
  assert.throws(() => C.sanitizeConfig({ brand: {} }));
  const c = C.sanitizeConfig({ brand: { name: { en: 'X' }, colors: { primary: 'red', accent: '#123456' }, logo: { image: 'javascript:alert(1)' }, tables: 9999, taxPct: -4 },
    categories: [{ id: 'a b', name: { en: 'Cat' } }, { id: 'a b', name: { en: 'Dup' } }],
    items: [{ id: 'q', cat: 'missing', name: { en: 'Soup' }, price: 'abc' }, { cat: 'a b', name: { en: 'Tea' }, price: '12,5' }, { name: {} }] });
  assert.strictEqual(c.brand.colors.primary, '#0f5c55'); assert.strictEqual(c.brand.colors.accent, '#123456');
  assert.strictEqual(c.brand.logo.image, ''); assert.strictEqual(c.brand.tables, 200); assert.strictEqual(c.brand.taxPct, 0);
  assert.strictEqual(new Set(c.categories.map((x) => x.id)).size, 2);
  assert.strictEqual(c.items.length, 2); assert.strictEqual(c.items[0].price, 0); assert.strictEqual(c.items[1].price, 12.5);
  assert.ok(c.items.every((i) => c.categories.some((k) => k.id === i.cat)));
});

test('order numbers restart each day', () => {
  const a = C.nextOrderNo({ day: '', n: 0 }, new Date(2026, 0, 1, 10).getTime());
  assert.strictEqual(a.no, 1);
  const b = C.nextOrderNo(a.counter, new Date(2026, 0, 1, 22).getTime());
  assert.strictEqual(b.no, 2);
  const c = C.nextOrderNo(b.counter, new Date(2026, 0, 2, 9).getTime());
  assert.strictEqual(c.no, 1);
});

test('status flow and stats', () => {
  assert.strictEqual(C.NEXT.new, 'preparing'); assert.strictEqual(C.NEXT.ready, 'done'); assert.strictEqual(C.PREV.ready, 'preparing');
  const mk = (st, q) => ({ status: st, createdAt: 1000, totals: { total: 10 * q }, lines: [{ name: { ar: 'a', en: 'Tea' }, qty: q, price: 10 }] });
  const s = C.stats([mk('done', 2), mk('done', 1), mk('new', 5), mk('cancelled', 3)], 0);
  assert.strictEqual(s.count, 2); assert.strictEqual(s.sales, 30); assert.strictEqual(s.avg, 15); assert.strictEqual(s.top[0].qty, 3);
});

test('csv escapes quotes and blocks formula injection', () => {
  const o = C.sanitizeOrder({ id: 'a', no: 1, type: 'pickup', name: '=cmd|x', note: 'he said "hi", ok', status: 'done', createdAt: 1, lines: [{ name: { en: 'Tea' }, qty: 1, price: 5 }], totals: { total: 5 } });
  const csv = C.ordersCsv([o], 'en');
  assert.ok(csv.includes("'=cmd|x")); assert.ok(csv.includes('"he said ""hi"", ok"'));
});

test('sanitizeOrder drops empty orders and bad status', () => {
  assert.strictEqual(C.sanitizeOrder({ lines: [] }), null);
  assert.strictEqual(C.sanitizeOrder({ status: 'hacked', lines: [{ name: { en: 'a' }, qty: 1, price: 1 }] }).status, 'new');
});

test('i18n: every English key exists in Arabic and vice versa, none empty', () => {
  const en = Object.keys(I18N.en), ar = Object.keys(I18N.ar);
  assert.deepStrictEqual(en.sort(), ar.sort());
  for (const k of en) { assert.ok(I18N.en[k] && I18N.ar[k], k); }
});

test('templates are all valid configs', () => {
  for (const k of Object.keys(TPL)) { const c = C.sanitizeConfig(JSON.parse(JSON.stringify(TPL[k]))); assert.ok(c.items.length > 3, k); assert.strictEqual(c.items.length, TPL[k].items.length, k); }
});

test('ready/confirm WhatsApp texts mention order number in both languages', () => {
  const b = brand(); const o = { no: 7, name: 'Sara' };
  assert.ok(C.readyText(o, b, 'en').includes('#7')); assert.ok(C.readyText(o, b, 'ar').includes('7'));
  assert.ok(C.confirmText(o, b, 'en').includes('20 minutes'));
});

test('shared config prunes defaults but keeps sold-out flags and restores on load', async () => {
  const c = C.sanitizeConfig(JSON.parse(JSON.stringify(TPL.cafe)));
  c.items[1].available = false;
  const sc = C.shareConfig(c);
  assert.strictEqual(sc.items[1].available, false);
  assert.ok(!('available' in sc.items[0]) && !('image' in sc.brand.logo));
  const back = C.sanitizeConfig(JSON.parse(await C.unpackText(await C.packText(JSON.stringify(sc)))));
  assert.strictEqual(back.items[1].available, false); assert.strictEqual(back.items[0].available, true);
  assert.strictEqual(back.items[0].name.ar, c.items[0].name.ar); assert.strictEqual(back.brand.currency.symbol.en, 'EGP');
});
