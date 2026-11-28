/* MIT · Copyright (c) 2026 Yousef Khames · UI strings as [Arabic, English]. */
(function (root) {
  'use strict';
  Object.assign(root.Kit.dict, {
    title: ['مطبخ', 'matbakh'], menu: ['القائمة', 'Menu'], kitchen: ['شاشة المطبخ', 'Kitchen'], tables: ['بطاقات الطاولات', 'Table cards'],
    search: ['ابحث في القائمة', 'Search the menu'], all: ['الكل', 'All'], soldOut: ['نفد', 'Sold out'], noPrice: ['اسأل عن السعر', 'Ask for the price'],
    demoBanner: ['وضع تجريبي: الأصناف والأسعار والطلبات عينات وهمية.', 'Demo mode: items, prices and orders are fictional samples.'], demoTag: ['تجريبي', 'Demo'],
    table: ['طاولة {n}', 'Table {n}'], noTable: ['بدون رقم طاولة', 'No table number'], add: ['أضف', 'Add'],
    bag: ['طلبك', 'Your order'], bagEmpty: ['لم تضف شيئًا بعد.', 'Nothing added yet.'], items: ['{n} صنف', '{n} items'],
    total: ['الإجمالي حسب القائمة', 'Total (menu prices)'], totalNote: ['السعر النهائي يؤكده المكان.', 'The venue confirms the final price.'],
    note: ['ملاحظة للطلب (اختياري)', 'Order note (optional)'], itemNote: ['ملاحظة', 'Note'], remove: ['حذف', 'Remove'],
    prepare: ['جهّز الطلب في واتساب', 'Prepare order in WhatsApp'], copy: ['انسخ الطلب', 'Copy order'], copied: ['تم النسخ', 'Copied'],
    howSend: ['فتح واتساب يجهّز مسودة فقط. اضغط إرسال بنفسك. الطلب غير مؤكد حتى يرد المكان.', 'Opening WhatsApp only prepares a draft. Press send yourself. The order is not confirmed until the venue replies.'],
    noWa: ['رقم واتساب المكان غير مضبوط. انسخ الطلب وأرسله يدويًا.', 'The venue WhatsApp number is not set. Copy the order and send it yourself.'],
    longMsg: ['الرسالة طويلة جدًا لرابط واتساب. انسخها وأرسلها يدويًا.', 'The message is too long for a WhatsApp link. Copy it and send it yourself.'],
    close: ['إغلاق', 'Close'], clearBag: ['فرّغ الطلب', 'Clear order'],
    kTitle: ['شاشة المطبخ', 'Kitchen screen'], kHelp: ['الصق رسالة الطلب أو كوده هنا. كل طلب يُستورد مرة واحدة. البيانات محفوظة على هذا الجهاز فقط.', 'Paste the order message or its code here. Each order imports once. Data stays on this device only.'],
    kPaste: ['الصق الطلب هنا', 'Paste the order here'], kImport: ['استورد الطلب', 'Import order'], kBad: ['لم أجد كود طلب صالح.', 'No valid order code found.'],
    kDup: ['هذا الطلب مستورد من قبل.', 'This order was already imported.'], kDone: ['تم استيراد الطلب', 'Order imported'],
    s_new: ['جديد', 'New'], s_preparing: ['قيد التحضير', 'Preparing'], s_ready: ['جاهز', 'Ready'], s_served: ['تم التقديم', 'Served'],
    next: ['الخطوة التالية', 'Next step'], cancel: ['إلغاء الطلب', 'Cancel order'], min: ['{n} د', '{n} min'], waiting: ['منذ {n} دقيقة', '{n} min ago'],
    unknownItem: ['صنف غير موجود في قائمة هذا الجهاز', 'Item not in this device menu'], clearServed: ['إخلاء المقدَّم', 'Clear served'],
    clearDemo: ['حذف الطلبات التجريبية', 'Clear demo orders'], noOrders: ['لا توجد طلبات.', 'No orders.'], confirmDel: ['متابعة؟', 'Continue?'],
    orderTotal: ['إجمالي القائمة', 'Menu total'], priceCheck: ['بعض الأصناف بدون سعر أو غير معروفة، راجع الإجمالي يدويًا.', 'Some items are unpriced or unknown. Check the total manually.'],
    blocked: ['بيانات الطلبات غير قابلة للقراءة ولن يتم الكتابة فوقها حتى تمسحها.', 'Stored orders are unreadable and will not be overwritten until you reset them.'], reset: ['مسح بيانات الطلبات', 'Reset order data'],
    tHelp: ['الصق رابط الصفحة المنشورة ثم اطبع بطاقات الطاولات. جرّب المسح قبل الطباعة.', 'Paste the published page link, then print the table cards. Test-scan before printing.'],
    tUrl: ['رابط الصفحة المنشورة', 'Published page link'], tCount: ['عدد الطاولات: {n} (من config.js)', 'Tables: {n} (from config.js)'], print: ['طباعة', 'Print'],
    scanOrder: ['امسح لعرض القائمة وجهّز طلبك', 'Scan to see the menu and prepare your order'],
    qrLocal: ['هذا الرابط محلي ولن يعمل للضيوف.', 'This is a local link and will not work for guests.'], lang: ['EN', 'عربي']
  });
})(globalThis);
