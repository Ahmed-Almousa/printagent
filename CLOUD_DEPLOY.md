# نشر التطبيق على الإنترنت (رابط دائم 24/7)

## المتطلبات
- حساب GitHub (مجاني)
- المشروع مرفوع بالفعل على `github.com/Ahmed-Almousa/printagent`

---

## الطريقة 1: Render.com (موصى بها - مع PostgreSQL)

يستخدم `render.yaml` (Blueprint) لنشر الخدمة تلقائياً مع PostgreSQL:

1. افتح https://dashboard.render.com
2. سجل بحساب GitHub
3. اضغط **"New +"** → **"Blueprint"**
4. اختر المستودع **`Ahmed-Almousa/printagent`**
5. Render سيقرأ `render.yaml` وينشئ تلقائياً:
   - **Web Service** (`erp-system`) مع Docker
   - **PostgreSQL Database** (`erp-db`) ← البيانات محفوظة بشكل دائم
6. اضغط **"Apply"**
7. انتظر 5-10 دقائق حتى يكتمل البناء

**الرابط:** `https://erp-system.onrender.com`

### أو يدوياً (بدون Blueprint):
1. **PostgreSQL**: New + PostgreSQL → name: `erp-db` → Free plan → Create
2. **Web Service**: New + Web Service → اختر المستودع
   - **Runtime**: `Docker`
   - **Name**: `erp-system`
   - أضف Environment Variable: `DATABASE_URL` ← انسخها من PostgreSQL dashboard
3. Create Web Service

⚠️ بعد 15 دقيقة من عدم الاستخدام، الخدمة تنام. تستيقظ عند أول زيارة (تأخذ 30 ثانية). لكن **قاعدة البيانات PostgreSQL لا تنام** — البيانات محفوظة بشكل دائم.

---

## الطريقة 2: Fly.io (بديل)

تحتاج تثبيت Fly CLI على كمبيوتر آخر:

```bash
iwr https://fly.io/install.ps1 -UseBasicParsing | iex
fly auth login
cd printerapp
fly launch
fly deploy
```

**الرابط:** `https://erp-system.fly.dev`

---

## الطريقة 3: localtunnel (فوري - مجاني - مؤقت)

بدون حساب ولا رفع:

```
D:\printerapp> tunnel.bat
```

سيظهر رابط مثل: `https://xxx.loca.lt`
أرسله للموظفين. الرابط يتغير كل تشغيل والبيانات غير دائمة.

---

## ملفات النشر الجاهزة

| الملف | الوظيفة |
|-------|---------|
| `Dockerfile` | بناء التطبيق في حاوية Docker |
| `render.yaml` | إعدادات Render التلقائية (Blueprint) |
| `fly.toml` | إعدادات Fly.io |
| `.dockerignore` | استثناء الملفات غير الضرورية من الحاوية |
