# لو ضغط على زر التفعيل في الإيميل وطلع 404 DEPLOYMENT_NOT_FOUND

## السبب
الرابط اللي **داخل الإيميل** مبني من متغير البيئة على السيرفر. لو فيه `API_PUBLIC_URL` أو `APP_URL` يشيرون لرابط غلط (مثلاً Vercel أو deployment محذوف)، الضغط على الزر يفتح ذلك الرابط فيصير 404.

## التحقق من الرابط المستخدم
بعد ما تشغّل الـ API (محلي أو على السيرفر)، افتح في المتصفح أو Postman:

```
GET https://عنوان-الـAPI-الحقيقي/auth/verification-base-url
```

مثال لو الـ API على جهازك:
```
GET http://localhost:3000/auth/verification-base-url
```

الرد يكون مثل:
```json
{ "verificationBaseUrl": "https://...." }
```

- لو طلع رابط **Vercel** أو رابط ما يفتح أو يعطي 404 → هذا هو سبب المشكلة.
- لازم `verificationBaseUrl` يكون **نفس عنوان الـ API** اللي تستخدمه لتسجيل الدخول (نفس الـ host).

## الحل
1. حدد **أين الـ API شغال فعلاً** (localhost، Railway، Render، VPS، إلخ).
2. على **نفس البيئة** (نفس الـ .env أو إعدادات الـ deployment)، ضع:
   ```env
   API_PUBLIC_URL=https://عنوان-الـAPI-الحقيقي
   ```
   بدون `/auth` في الآخر — فقط أساس الرابط، مثل:
   - `http://localhost:3000`
   - `https://your-api.railway.app`
   - `https://api.yourdomain.com`
3. **لا** تضع رابط الفرونتند (Vercel للتطبيق) هنا — فقط رابط الـ **API** (NestJS).
4. أعد تشغيل الـ API أو أعد النشر، ثم جرّب تسجيل مستخدم جديد واضغط الزر في الإيميل مرة ثانية.

بعد التصحيح، استدعاء `/auth/verification-base-url` يجب يرجع نفس العنوان اللي تفتح منه الـ API وتعمل منه تسجيل الدخول.
