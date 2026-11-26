/* Starter templates. Everything here is editable in the app (Studio > Menu / Brand). */
(function (root) {
  'use strict';
  const c = (id, ar, en) => ({ id, name: { ar, en } });
  const i = (id, cat, ar, en, price, emoji, extra) => Object.assign({ id, cat, name: { ar, en }, desc: { ar: '', en: '' }, price, emoji, available: true, popular: false }, extra || {});
  const d = (ar, en) => ({ desc: { ar, en } });

  const cafe = {
    brand: {
      name: { ar: 'مطبخ', en: 'Matbakh' },
      tagline: { ar: 'أكل بيتي على أصوله', en: 'Home cooking, done right' },
      about: { ar: 'أهلاً بيك! اختار طلبك وابعته واحنا نجهزه.', en: 'Welcome! Pick your order and send it, we will get it ready.' },
      logo: { emoji: '🍲', image: '' },
      colors: { primary: '#0f5c55', accent: '#e9a23b' },
      currency: { symbol: { ar: 'ج.م', en: 'EGP' }, pos: 'after', decimals: 0 },
      lang: 'ar', arabicDigits: false, taxPct: 0, servicePct: 0, whatsapp: '', countryCode: '20', tables: 8, pickupMinutes: 20,
    },
    categories: [c('c1', 'الفطار', 'Breakfast'), c('c2', 'الأطباق الرئيسية', 'Mains'), c('c3', 'سندويتشات', 'Sandwiches'), c('c4', 'المشروبات', 'Drinks'), c('c5', 'الحلويات', 'Sweets')],
    items: [
      i('i1', 'c1', 'فول بالزيت الحار', 'Ful medames', 35, '🫘', Object.assign({ popular: true }, d('مع عيش بلدي وسلطة', 'With baladi bread and salad'))),
      i('i2', 'c1', 'طعمية', 'Ta\u2019meya plate', 30, '🧆', d('٦ أقراص مقرمشة', '6 crispy pieces')),
      i('i3', 'c1', 'شكشوكة', 'Shakshuka', 55, '🍳', d('بيض بصوص الطماطم', 'Eggs in tomato sauce')),
      i('i4', 'c2', 'كشري', 'Koshary', 45, '🍝', Object.assign({ popular: true }, d('بالدقة والشطة', 'With garlic vinegar and chili'))),
      i('i5', 'c2', 'ملوخية بالفراخ', 'Molokhia with chicken', 85, '🍲', d('مع رز أبيض', 'With white rice')),
      i('i6', 'c2', 'نص فرخة مشوية', 'Half grilled chicken', 120, '🍗', d('بطاطس وسلطة', 'Fries and salad')),
      i('i7', 'c2', 'كفتة مشوية', 'Kofta grill', 110, '🍢', d('نص كيلو مع الطحينة', 'With tahini and bread')),
      i('i8', 'c3', 'شاورما فراخ', 'Chicken shawarma', 65, '🌯', Object.assign({ popular: true }, d('ثوم وبطاطس', 'Garlic sauce and fries'))),
      i('i9', 'c3', 'برجر لحم', 'Beef burger', 90, '🍔', d('جبنة شيدر وصوص خاص', 'Cheddar and house sauce')),
      i('i10', 'c3', 'بطاطس مقلية', 'French fries', 30, '🍟'),
      i('i11', 'c4', 'شاي', 'Tea', 15, '🍵'),
      i('i12', 'c4', 'قهوة تركي', 'Turkish coffee', 25, '☕'),
      i('i13', 'c4', 'عصير مانجو', 'Mango juice', 40, '🥭', { popular: true }),
      i('i14', 'c4', 'ليمون بالنعناع', 'Lemon mint', 30, '🍋'),
      i('i15', 'c4', 'مياه', 'Water', 8, '💧'),
      i('i16', 'c5', 'أم علي', 'Om Ali', 50, '🥧', Object.assign({ popular: true }, d('سخنة من الفرن', 'Hot from the oven'))),
      i('i17', 'c5', 'بسبوسة', 'Basbousa', 30, '🍰'),
      i('i18', 'c5', 'كنافة بالقشطة', 'Kunafa with cream', 45, '🥮'),
    ],
  };

  const fast = {
    brand: {
      name: { ar: 'برجر هاوس', en: 'Burger House' },
      tagline: { ar: 'سريع وسخن', en: 'Fast and hot' },
      about: { ar: 'اطلب واستلم من الفرع.', en: 'Order ahead and pick up at the counter.' },
      logo: { emoji: '🍔', image: '' },
      colors: { primary: '#b3261e', accent: '#ffb703' },
      currency: { symbol: { ar: 'ج.م', en: 'EGP' }, pos: 'after', decimals: 0 },
      lang: 'en', arabicDigits: false, taxPct: 14, servicePct: 0, whatsapp: '', countryCode: '20', tables: 0, pickupMinutes: 15,
    },
    categories: [c('c1', 'برجر', 'Burgers'), c('c2', 'جانبية', 'Sides'), c('c3', 'مشروبات', 'Drinks')],
    items: [
      i('i1', 'c1', 'كلاسيك', 'Classic burger', 95, '🍔', { popular: true }),
      i('i2', 'c1', 'دبل تشيز', 'Double cheese', 135, '🍔'),
      i('i3', 'c1', 'برجر دجاج مقرمش', 'Crispy chicken burger', 100, '🍗'),
      i('i4', 'c2', 'بطاطس', 'Fries', 35, '🍟', { popular: true }),
      i('i5', 'c2', 'حلقات بصل', 'Onion rings', 40, '🧅'),
      i('i6', 'c3', 'كولا', 'Cola', 20, '🥤'),
      i('i7', 'c3', 'ميلك شيك', 'Milkshake', 55, '🥛'),
    ],
  };

  const bakery = {
    brand: {
      name: { ar: 'فرن وقهوة', en: 'Fourn & Coffee' },
      tagline: { ar: 'مخبوزات طازة كل صبح', en: 'Fresh bakes every morning' },
      about: { ar: 'اطلب مسبقاً واستلم من غير طابور.', en: 'Order ahead and skip the line.' },
      logo: { emoji: '🥐', image: '' },
      colors: { primary: '#6b3f2a', accent: '#d98e3f' },
      currency: { symbol: { ar: '$', en: '$' }, pos: 'before', decimals: 2 },
      lang: 'en', arabicDigits: false, taxPct: 0, servicePct: 0, whatsapp: '', countryCode: '20', tables: 0, pickupMinutes: 10,
    },
    categories: [c('c1', 'مخبوزات', 'Bakes'), c('c2', 'قهوة', 'Coffee')],
    items: [
      i('i1', 'c1', 'كرواسون زبدة', 'Butter croissant', 2.5, '🥐', { popular: true }),
      i('i2', 'c1', 'خبز العجين المخمر', 'Sourdough loaf', 6, '🍞'),
      i('i3', 'c1', 'مافن شوكولاتة', 'Chocolate muffin', 3, '🧁'),
      i('i4', 'c2', 'لاتيه', 'Latte', 3.75, '☕', { popular: true }),
      i('i5', 'c2', 'إسبريسو', 'Espresso', 2.5, '☕'),
      i('i6', 'c2', 'كابتشينو', 'Cappuccino', 3.5, '☕'),
    ],
  };

  root.MB_TEMPLATES = { cafe, fast, bakery };
  if (typeof module === 'object' && module.exports) module.exports = root.MB_TEMPLATES;
})(typeof self !== 'undefined' ? self : this);
