# دليل المشروع — Nextask API

ملخص شامل لكل ملف، المنطق فيه، وكيف الملفات مترابطة. مناسب لشخص يقرأ المشروع ويتعلم منه.

---

## 1. مسار الطلب من البداية للنهاية (Request Flow)

```
المتصفح/العميل
      │
      ▼
   main.ts          ← يشغّل التطبيق ويطبّق عالمياً: ValidationPipe + ExceptionFilter + TransformInterceptor
      │
      ▼
   AppModule        ← يجمع الموديولات ويطبّق AccessTokenGuard على كل المسارات
      │
      ▼
   AccessTokenGuard  ← يقرر: هل المسار عام (Public) أو فيه verify-email؟ → يسمح. وإلا يتحقق من JWT.
      │
      ▼ (إذا محمي)
   AccessTokenStrategy  ← يفتك التوكن من الـ Header ويحققه، يضع الـ payload في request.user
      │
      ▼
   AuthController   ← يستقبل الطلب، يقرأ Body/Query، يستدعي AuthService
      │
      ▼
   AuthService      ← ينفّذ المنطق (تسجيل، تحقق، إيميل، توكنات)، يستدعي Repository و MailService و TokenService
      │
      ├──► AuthRepository   ← يقرأ/يكتب من الداتابيز (Prisma)
      ├──► MailService      ← يرسل الإيميلات
      └──► TokenService    ← يوقّع الـ JWT (access + refresh)
      │
      ▼
   الاستجابة ترجع للعميل (إما عبر TransformInterceptor تغلّفها بـ { success, data } أو كما هي إن كانت فيها success)
```

---

## 2. الجذر: main.ts و AppModule

### `src/main.ts`
- **الدور:** تشغيل تطبيق NestJS.
- **المنطق:**
  - ينشئ التطبيق من `AppModule`.
  - **ValidationPipe** عالمي: يتحقق من الـ DTOs (class-validator)، يرفض حقول زائدة إذا `forbidNonWhitelisted: true`، ويحوّل الأنواع (`transform: true`).
  - **HttpExceptionFilter** عالمي: أي `HttpException` تُمسك ويُعاد منها رد موحد بصيغة `{ statusCode, timestamp, path, message }`.
  - **TransformInterceptor** عالمي: يغلّف الردود الناجحة بـ `{ success: true, data }` ما لم يكن الرد أصلاً فيه `success: true` (مثل verify-email).
- **الترابط:** يستورد `AppModule` و `TransformInterceptor` و `HttpExceptionFilter` فقط؛ باقي الربط داخل الموديولات.

### `src/app.module.ts`
- **الدور:** تجميع كل الموديولات وتطبيق الحماية الافتراضية.
- **المنطق:**
  - **imports:** `AuthModule`, `PrismaModule`, `ConfigModule.forRoot({ isGlobal: true })` (قراءة `.env`).
  - **providers:** `APP_GUARD` مع `AccessTokenGuard` — يعني **كل** مسار محمي بـ JWT إلا ما يُستثنى.
- **الترابط:** الـ Guard يعيش في Auth لكن يُطبّق من هنا على مستوى التطبيق بالكامل.

---

## 3. موديول Auth — الملفات والمنطق والترابط

### `src/modules/auth/auth.module.ts`
- **الدور:** تعريف موديول المصادقة وتوفير كل ما يلزم للـ Controller والـ Service.
- **المنطق:**
  - **imports:** PrismaModule (داتابيز)، ConfigModule، MailModule (إيميل)، JwtModule (توقيع التوكنات من env).
  - **providers:** AuthService, AuthRepository, TokenService, AccessTokenStrategy, RefreshTokenStrategy.
  - **controllers:** AuthController.
  - **exports:** AuthService, TokenService (ليستخدما من موديولات أخرى لاحقاً إذا احتجت).
- **الترابط:** الـ Controller يعتمد على AuthService؛ الـ Service يعتمد على AuthRepository و TokenService و MailService؛ الـ Strategies تعتمد على ConfigService.

### `src/modules/auth/auth.controller.ts`
- **الدور:** استقبال طلبات HTTP وتوجيهها للـ Service وإرجاع النتيجة.
- **المنطق (كل endpoint):**
  - **POST /auth/signup** — عام. Body: CreateUserDto. يستدعي `authService.signup()`.
  - **POST /auth/signin** — عام. Body: SigninDto. يستدعي `authService.signin()`.
  - **POST /auth/refresh** — محمي بـ RefreshTokenGuard. يستخرج من الـ decorator الـ `sub` والـ refreshToken ويستدعي `authService.refreshTokens()`.
  - **POST /auth/logout** — محمي بـ AccessTokenGuard. يستخرج userId ويستدعي `authService.logout()`.
  - **POST /auth/resend-verification** — عام. Body: ResendVerificationDto. يستدعي `authService.resendVerificationEmail()`.
  - **POST /auth/forgot-password** — عام. Body: ForgotPasswordDto. يستدعي `authService.forgotPassword()`.
  - **POST /auth/reset-password** — عام. Body: ResetPasswordDto. يستدعي `authService.resetPassword()`.
  - **GET /auth/verify-email** — عام (ومسموح من الـ Guard حتى بدون توكن). Query: VerifyEmailQueryDto. يستدعي `authService.verifyEmail()` ثم إن وُجد `VERIFY_SUCCESS_REDIRECT_URL` يعمل redirect، وإلا يرجع JSON.
- **الترابط:** يعتمد على AuthService و ConfigService فقط؛ لا يتعامل مع الداتابيز أو الإيميل مباشرة.

### `src/modules/auth/auth.service.ts`
- **الدور:** كل منطق الأعمال للمصادقة (تسجيل، تفعيل، دخول، تحديث توكن، نسيت/إعادة باسورد).
- **المنطق المختصر:**
  - **signup:** يتحقق من الإيميل الحقيقي (validateRealEmail)، يتأكد أن الإيميل غير مسجّل في User، يشفّر الباسورد، يولد OTP ومدة انتهاء، يكتب في PendingUser، يرسل إيميل تفعيل.
  - **resendVerificationEmail:** يتأكد أن الحساب ليس في User وأنه موجود في PendingUser، يولد OTP جديد، يحدّث PendingUser، يرسل إيميل تفعيل من جديد.
  - **verifyEmail:** يقرأ من PendingUser، يتحقق من الانتهاء والـ OTP، ينقل المستخدم إلى User (مع Organization و Membership) عبر `createUserWithOrganization`، ثم يحذف من PendingUser.
  - **signin:** إن وُجد في User يتحقق من الباسورد ثم يبني التوكنات والرد. إن وُجد في PendingUser فقط والباسورد صحيح يفعّل الحساب (نقل + حذف من المؤقت) ثم يسجّل دخوله.
  - **refreshTokens:** يتحقق من الـ refresh token ويولّد access و refresh جديدين ويرجع نفس شكل رد الدخول.
  - **logout:** يفرغ refreshToken في User.
  - **forgotPassword:** إن الإيميل في User يولد OTP ويحدّث User ويرسل إيميل استعادة باسورد.
  - **resetPassword:** يتحقق من OTP وانتهاء الصلاحية ثم يحدّث الباسورد ويمسح OTP.
- **دوال مساعدة داخلية:** `getCurrentMembership(user)` لاختيار العضوية النشطة أو الأولى، `buildAuthResponse(...)` لبناء شكل رد الدخول الموحد.
- **الترابط:** يستدعي AuthRepository لكل عمليات الداتابيز، MailService للإيميل، TokenService للتوكنات، و validateRealEmail من common/utils قبل التسجيل.

### `src/modules/auth/auth.repository.ts`
- **الدور:** طبقة الوصول للداتابيز — كل التعامل مع Prisma يمر من هنا داخل Auth.
- **المنطق (أهم الدوال):**
  - **findUserByEmail / findUserById:** قراءة User مع memberships والمنظمة.
  - **updateRefreshToken:** تحديث أو مسح refreshToken.
  - **updateOtpCode / updatePasswordAndClearOtp:** لنسيت الباسورد (User موثّق).
  - **createPendingUser / findPendingUser / deletePendingUser:** الجدول المؤقت (PendingUser)؛ الحذف مع Logger عند الفشل.
  - **createUserWithOrganization:** داخل transaction: إنشاء User، Organization، Membership، وتحديث activeOrganizationId؛ يستخدم slug.util لـ slug المنظمة.
- **الترابط:** يعتمد على PrismaService فقط؛ يستورد generateSlug و generateUniqueSlug من common/utils.

### `src/modules/auth/guards/access-token.guard.ts`
- **الدور:** يحدد هل الطلب يحتاج JWT أم لا.
- **المنطق:** إذا المسار من `PUBLIC_PATHS` (مثل verify-email) أو الـ handler/class عليه `@Public()` يسمح بالطلب. وإلا يستدعي استراتيجية JWT (passport 'jwt').
- **الترابط:** يعتمد على Reflector و decorator الـ Public و auth.constants (PUBLIC_PATHS).

### `src/modules/auth/guards/refresh-token.guard.ts`
- **الدور:** حماية مسار refresh فقط — يتحقق من توكن refresh.
- **المنطق:** يستخدم استراتيجية 'jwt-refresh'.
- **الترابط:** يعمل مع RefreshTokenStrategy.

### `src/modules/auth/strategies/access-token.strategy.ts`
- **الدور:** استخراج JWT من الـ Header والتحقق منه.
- **المنطق:** يقرأ التوكن من `Authorization: Bearer ...`، يتحقق بالـ JWT_ACCESS_SECRET، ويمرر الـ payload إلى `request.user`.
- **الترابط:** ConfigService للـ secret؛ الـ Guard يستدعي هذه الاستراتيجية.

### `src/modules/auth/strategies/refresh-token.strategy.ts`
- **الدور:** التحقق من refresh token وتمرير الـ payload + نص التوكن للـ controller.
- **المنطق:** يقرأ التوكن من الـ Header، يتحقق بـ JWT_REFRESH_SECRET، ويرجع للـ Guard/Controller الـ payload مع refreshToken.
- **الترابط:** يُستخدم من RefreshTokenGuard عند POST /auth/refresh.

### `src/modules/auth/token/token.service.ts`
- **الدور:** توليد access و refresh tokens.
- **المنطق:** يستخدم JwtService مع secrets من Config (ACCESS_TOKEN_SECRET / REFRESH_TOKEN_SECRET) ومدد انتهاء (مثلاً 10m و 7d).
- **الترابط:** يُستدعى من AuthService فقط.

### `src/modules/auth/token/token.payload.ts`
- **الدور:** تعريف شكل الـ payload داخل التوكن (sub, email, role, orgId).
- **الترابط:** يُستورد في AuthService و TokenService.

### `src/modules/auth/decorators/public.decorator.ts`
- **الدور:** وضع علامة على route أنه عام (لا يحتاج JWT).
- **المنطق:** SetMetadata(IS_PUBLIC_KEY, true). الـ AccessTokenGuard يقرأها ويسمح بالطلب.
- **الترابط:** يُستخدم على الـ controller؛ الـ Guard يتحقق منه.

### `src/modules/auth/decorators/get-current-user.decorator.ts`
- **الدور:** استخراج بيانات المستخدم الحالي من request.user (اللي وضعتها الاستراتيجية).
- **المنطق:** createParamDecorator يقرأ من request.user؛ إذا مرّرت له مفتاح (مثل 'sub' أو 'refreshToken') يرجع ذلك الحقل فقط.
- **الترابط:** يُستخدم في الـ controller للـ refresh و logout.

### `src/modules/auth/auth.constants.ts`
- **الدور:** ثوابت زمن OTP ومسارات عامة.
- **المنطق:** OTP_VERIFICATION_EXPIRY_MS، OTP_PASSWORD_RESET_EXPIRY_MS، PUBLIC_PATHS.
- **الترابط:** يُستورد في AuthService و AccessTokenGuard.

### `src/modules/auth/auth.types.ts`
- **الدور:** تعريف نوع PendingUserRecord (الحقول المستخدمة في منطق التفعيل).
- **الترابط:** يُستورد في AuthService عند التعامل مع سجل PendingUser.

### DTOs في `src/modules/auth/dto/`
- **create-user.dto.ts:** name, email, password مع تحقق (طول، إيميل، حرف كبير في الباسورد).
- **signin.dto.ts:** email, password.
- **forgot-password.dto.ts / reset-password.dto.ts:** حقول نسيت/إعادة الباسورد.
- **resend-verification.dto.ts:** email.
- **verify-email-query.dto.ts:** email, otpCode للـ query.
- **الترابط:** الـ Controller يمرّرها للـ Service؛ الـ ValidationPipe يتحقق منها قبل وصول الطلب للـ controller.

---

## 4. موديول Mail

### `src/modules/mail/mail.module.ts`
- **الدور:** تهيئة إرسال البريد وتوفير MailService.
- **المنطق:** MailerModule.forRootAsync مع Config (SMTP من MAIL_USER و MAIL_PASS)، و exports لـ MailService.
- **الترابط:** AuthModule يستورد MailModule ليستخدم MailService.

### `src/modules/mail/mail.service.ts`
- **الدور:** إرسال إيميلات التفعيل واستعادة الباسورد.
- **المنطق:** getBaseUrl() من API_PUBLIC_URL أو APP_URL؛ sendVerificationEmail يبني رابط التفعيل ويستخدم قالب التحقق؛ sendForgotPasswordEmail يبني رابط استعادة ويستخدم قالب نسيت الباسورد.
- **الترابط:** يُستدعى من AuthService فقط؛ القوالب في templates/.

### `src/modules/mail/templates/verification.template.ts`
- **الدور:** HTML إيميل تفعيل الحساب (زر + رابط).
- **الترابط:** MailService يستدعي getVerificationEmailHtml(verificationLink).

### `src/modules/mail/templates/forgot-password.template.ts`
- **الدور:** HTML إيميل استعادة كلمة المرور.
- **الترابط:** MailService يستدعي getForgotPasswordEmailHtml(resetLink).

---

## 5. موديول Prisma

### `src/modules/prisma/prisma.module.ts`
- **الدور:** توفير PrismaService للموديولات.
- **المنطق:** يعلن PrismaService كـ provider ويصدّره.
- **الترابط:** AuthModule (وغيره) يستورد PrismaModule.

### `src/modules/prisma/prisma.service.ts`
- **الدور:** عميل Prisma المتصل بقاعدة البيانات.
- **المنطق:** يمتد من PrismaClient، يستخدم adapter مع DATABASE_URL.
- **الترابط:** AuthRepository (وكل repository لاحق) يحقن PrismaService.

### `prisma/schema.prisma`
- **الدور:** تعريف الجداول والعلاقات.
- **أهم النماذج هنا:** PendingUser (مؤقت التسجيل)، User، Organization، Membership؛ والباقي (Item, Order, …) للميزات الأخرى.
- **الترابط:** الكود المولد في src/generated/prisma يُستورد من PrismaService و AuthRepository.

---

## 6. Common — مشترك بين الموديولات

### `src/exception-filter/http-exception.filter.ts`
- **الدور:** توحيد شكل ردود الأخطاء (HttpException).
- **المنطق:** يمسك الاستثناء ويبني JSON فيه statusCode, timestamp, path, message.
- **الترابط:** مُطبّق عالمياً من main.ts.

### `src/common/Interceptor/TransformInterceptor.ts`
- **الدور:** توحيد شكل الردود الناجحة.
- **المنطق:** إن الرد ليس فيه بالفعل success: true يغلّفه بـ { success: true, data }.
- **الترابط:** مُطبّق عالمياً من main.ts.

### `src/common/utils/slug.util.ts`
- **الدور:** تحويل اسم لـ slug وضمان أن يكون فريداً.
- **المنطق:** generateSlug (نص نظيف)، generateUniqueSlug (مع دالة تحقق وجود).
- **الترابط:** AuthRepository يستخدمه عند إنشاء المنظمة.

### `src/common/utils/email-validation.util.ts`
- **الدور:** التحقق أن الإيميل "حقيقي" قبل التسجيل (تقليل الضغط على PendingUser).
- **المنطق:** validateRealEmail يتحقق من النطاق (غير مؤقت + وجود سجلات MX).
- **الترابط:** AuthService يستدعيه في بداية signup.

### `src/common/constants/disposable-email-domains.ts`
- **الدور:** قائمة نطاقات الإيميلات المؤقتة/الوهمية.
- **الترابط:** email-validation.util يتحقق منها.

---

## 7. مخطط الترابط بين الملفات (من يستدعي من)

```
main.ts
  └── AppModule
        ├── ConfigModule (global)
        ├── PrismaModule → PrismaService
        ├── AuthModule
        │     ├── AuthController ──► AuthService
        │     │                         ├── AuthRepository ──► PrismaService
        │     │                         ├── MailService (من MailModule)
        │     │                         ├── TokenService
        │     │                         └── validateRealEmail (common)
        │     ├── AccessTokenGuard ──► Reflector, PUBLIC_PATHS, AccessTokenStrategy
        │     ├── RefreshTokenGuard ──► RefreshTokenStrategy
        │     ├── AccessTokenStrategy ──► ConfigService (JWT secret)
        │     ├── RefreshTokenStrategy ──► ConfigService
        │     └── TokenService ──► JwtService, ConfigService
        │
        └── APP_GUARD: AccessTokenGuard

MailModule
  └── MailService ──► MailerService, ConfigService, templates

AuthRepository ──► PrismaService, slug.util
```

---

## 8. ملخص سريع لمسار المستخدم

| الخطوة | المسار | الملف الرئيسي | ماذا يحدث |
|--------|--------|----------------|-----------|
| تسجيل | POST /auth/signup | AuthController → AuthService | فحص إيميل حقيقي، كتابة PendingUser، إرسال إيميل |
| تفعيل | GET /auth/verify-email | AuthController → AuthService → AuthRepository | نقل PendingUser → User، حذف من PendingUser، اختياري: redirect |
| دخول | POST /auth/signin | AuthController → AuthService | إن وُجد في User: تحقق باسورد وتوكنات. إن وُجد في PendingUser فقط وباسورد صحيح: تفعيل ثم دخول |
| تحديث توكن | POST /auth/refresh | AuthController → AuthService | التحقق من refresh token وإصدار access و refresh جديدين |
| تسجيل خروج | POST /auth/logout | AuthController → AuthService → AuthRepository | مسح refreshToken |
| إعادة إرسال التفعيل | POST /auth/resend-verification | AuthController → AuthService | OTP جديد في PendingUser وإرسال إيميل |
| نسيت الباسورد | POST /auth/forgot-password | AuthController → AuthService | OTP في User وإرسال إيميل |
| إعادة تعيين الباسورد | POST /auth/reset-password | AuthController → AuthService | التحقق من OTP وتحديث الباسورد |

بهذا يكون عندك خريطة واضحة لكل ملف وشغله وكيف مربوط مع الباقي؛ لو ركّزت على مسار واحد (مثلاً signup → verify-email → signin) وتبعته من الـ controller للـ repository تقدر تفهم كل المشروع بسرعة.
