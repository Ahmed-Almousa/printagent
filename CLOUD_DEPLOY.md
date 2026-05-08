# نشر التطبيق على الإنترنت (رابط دائم 24/7)

## المتطلبات
- حساب GitHub (مجاني)
- إنترنت سريع على أي كمبيوتر آخر

---

## الطريقة 1: Render.com (الأسهل)

1. ارفع المجلد `D:\printerapp` إلى GitHub
2. افتح https://render.com
3. سجل بحساب Google أو GitHub
4. اضغط **"New +"** → **"Web Service"**
5. اختر المستودع من GitHub
6. املأ:
   - **Name**: `erp-system`
   - **Runtime**: `Node`
   - **Build Command**: `cd client && npm install && npm run build && cd ../server && npm install`
   - **Start Command**: `cd server && node index.js`
7. تحت **Advanced** → أضف:
   - **Disk**: `erp_data` (1GB) ← هذا يخلي SQLite يحفظ البيانات
8. اضغط **"Create Web Service"**

⚠️ بعد 15 دقيقة من عدم الاستخدام، التطبيق ينام. يستيقظ عند أول زيارة (يأخذ 30 ثانية).

**الرابط:** `https://erp-system.onrender.com`

---

## الطريقة 2: Fly.io (أفضل لل SQLite)

تحتاج تثبيت Fly CLI على كمبيوتر آخر:

```bash
# على كمبيوتر عنده إنترنت سريع:
iwr https://fly.io/install.ps1 -UseBasicParsing | iex

fly auth login   # يفتح المتصفح
cd printerapp    # المجلد بعد نسخه
fly launch       # ينشئ التطبيق
fly volumes create erp_data --size 1 --region ams
fly volumes create erp_uploads --size 1 --region ams
fly deploy
```

**الرابط:** `https://erp-system.fly.dev`

---

## الطريقة 3: localtunnel (فوري - مجاني)

بدون حساب ولا رفع:

```
D:\printerapp> tunnel.bat
```

سيظهر رابط مثل: `https://xxx.loca.lt`
أرسله للموظفين. الرابط يتغير كل تشغيل.

---

## ملفات النشر الجاهزة

| الملف | الوظيفة |
|-------|---------|
| `Dockerfile` | لبناء التطبيق في حاوية (يستخدمه Render و Fly) |
| `fly.toml` | إعدادات Fly.io |
| `.dockerignore` | استثناء الملفات غير الضرورية |
