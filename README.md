# بنك الأفكار — نسخة Vercel + Supabase

هذه النسخة مجهزة للعمل على الإنترنت بدون SQLite محلي. الواجهة وطلبات الموظفين والأفكار تعمل من خلال **Express**، والبيانات تحفظ في **Supabase PostgreSQL**، ويمكن نشر التطبيق على **Vercel**.

## ما الذي تم تعديله؟

- استبدال قاعدة `SQLite / ideas.db` بقاعدة **Supabase**.
- طلب تسجيل الموظف يبقى بانتظار موافقة الأدمن.
- الأدمن يستطيع الموافقة أو الرفض من لوحة الإدارة.
- الموظف المعتمد يستطيع إرسال الأفكار ومشاهدة أفكاره.
- تقييم الأفكار وحالاتها وملاحظات اللجنة تبقى محفوظة في Supabase.
- العبارة الموحدة في الواجهات: **معاً .. نصنع فرقاً أفضل**.
- إبقاء إرسال Telegram اختيارياً.
- حذف `better-sqlite3` لتجنب مشاكل الاستضافة والملفات المؤقتة.
- ملف `app.js` هو تطبيق Express الذي يكتشفه Vercel تلقائياً.

## 1) إنشاء قاعدة Supabase

1. أنشئ مشروعاً جديداً في Supabase.
2. افتح **SQL Editor**.
3. افتح الملف `supabase-schema.sql` الموجود داخل المشروع.
4. انسخ محتواه بالكامل وشغّله مرة واحدة.

## 2) معلومات Supabase المطلوبة

من مشروع Supabase خذ:

- `SUPABASE_URL`: رابط المشروع.
- `SUPABASE_SECRET_KEY`: المفتاح السري للخادم الذي يبدأ غالباً بـ `sb_secret_...`.

**مهم:** لا تضع `SUPABASE_SECRET_KEY` داخل JavaScript الموجود في مجلد `public` ولا تشاركه مع أي شخص. يوضع فقط في متغيرات البيئة على Vercel أو في ملف `.env` المحلي.

## 3) متغيرات البيئة

على Vercel أضف القيم التالية من **Project Settings > Environment Variables**:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=اختر_كلمة_مرور_قوية
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxx
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

Telegram اختياري؛ اترك حقليه فارغين إذا لا تريد إشعارات Telegram.

## 4) النشر على Vercel

### الطريقة الأسهل عبر GitHub

1. ارفع هذا المجلد إلى مستودع GitHub.
2. في Vercel اختر **Add New Project** ثم استورد المستودع.
3. لا تحتاج Build Command أو Output Directory خاص؛ Vercel يكتشف Express تلقائياً.
4. أضف متغيرات البيئة المذكورة أعلاه.
5. اضغط Deploy.
6. بعد انتهاء النشر ستحصل على رابط `*.vercel.app`.

### الصفحات

- دخول الموظفين: `/`
- لوحة الأدمن: `/admin.html`
- لوحة أفكار الموظف: `/dashboard.html`

## 5) التشغيل محلياً قبل النشر

أنشئ ملف `.env` اعتماداً على `.env.example` وضع بيانات Supabase الحقيقية، ثم:

```bash
npm install
npm start
```

ثم افتح:

`http://localhost:3000`

## ملاحظة الأمان

في الإنتاج غيّر كلمة مرور الأدمن الافتراضية إلى كلمة قوية من خلال متغير `ADMIN_PASSWORD`. لا ترفع ملف `.env` إلى GitHub.
