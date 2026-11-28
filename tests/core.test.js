const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const M = require('../core.js'), C = require('../menu-core.js');
const menu = C.normalize(new Function('window', fs.readFileSync(path.join(__dirname, '../menu-data.js'), 'utf8') + ';return window.MENU_DATA')({}));
const mk = () => M.makeOrder('abc123', 4, [{ item: 'i1', qty: 2, note: 'سكر زيادة' }, { item: 'i3', qty: 1 }], 1700000000000, 'ملاحظة', true);
test('order code round-trips with Arabic text', () => {
  const o = mk(); const back = M.decode('hello ' + M.encode(o) + ' bye'); assert.deepEqual(back, o);
});
test('decode rejects garbage, empty and tampered codes', () => {
  ['', 'MB1.', 'MB1.@@@', 'MB1.' + Buffer.from('{"a":1}').toString('base64'), 'MB1.' + Buffer.from('[1,2,3,4,5,[]]').toString('base64')].forEach((c) => assert.equal(M.decode(c), null, c));
});
test('quantities are clamped and bad lines dropped', () => {
  const o = M.makeOrder('x', 500, [{ item: 'a', qty: 0 }, { item: 'b', qty: 1000 }, { item: 'c', qty: 3 }], 1, '', false); assert.equal(o.lines.length, 1); assert.equal(o.table, 99);
});
test('totals use menu prices only and flag unknown items', () => {
  assert.equal(M.totals(menu, mk()).total, 40 * 2 + 35); const o = M.makeOrder('y', 1, [{ item: 'zzz', qty: 1 }], 1); assert.equal(M.totals(menu, o).unknown, 1);
});
test('order text carries demo tag, table and code in both languages', () => {
  const ar = M.orderText(menu, mk(), 'ar', 'مقهى'), en = M.orderText(menu, mk(), 'en', 'Cafe');
  assert.match(ar, /\[طلب تجريبي\]/); assert.match(ar, /الطاولة: 4/); assert.match(en, /\[DEMO order\]/); assert.match(en, /Table: 4/); assert.ok(en.includes(M.encode(mk())));
});
test('kitchen import is idempotent per order id', () => {
  const a = M.addIncoming([], mk(), 5); assert.ok(a.ok); assert.equal(a.list[0].status, 'new'); assert.equal(M.addIncoming(a.list, mk(), 6).error, 'dup');
});
test('status advances to served and stops; elapsed from timestamps', () => {
  let o = { status: 'new', receivedAt: 0 }; o.status = M.advance(o); assert.equal(o.status, 'preparing'); o.status = 'served'; assert.equal(M.advance(o), 'served'); assert.equal(M.elapsedMin({ receivedAt: 0 }, 150000), 2);
});
test('table url', () => { assert.equal(M.tableUrl('https://x.io/m', 3), 'https://x.io/m/#/t/3'); assert.equal(M.tableUrl('https://x.io/m/#/t/1', 2), 'https://x.io/m/#/t/2'); });
test('config ships demo and without a phone number', () => {
  const c = new Function('window', fs.readFileSync(path.join(__dirname, '../config.js'), 'utf8') + ';return window.MATBAKH_CONFIG')({}); assert.equal(c.demo, true); assert.equal(c.whatsapp, '');
});
