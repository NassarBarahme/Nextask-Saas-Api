# دليل كتابة التستات (Unit Tests)

## 1) ليش نكتب تست؟

- نتأكد إن الكود يشتغل كما نتوقع.
- لو غيّرنا شيء لاحقاً، التست يذكّرنا إذا كسرنا سلوك قديم.
- نوثّق سلوك الدالة (التست يقرأه كشرح).

---

## 2) أين نكتب التست؟

- لكل ملف سورس (مثلاً `auth.service.ts`) نكتب ملف تست بنفس المجلد وبنفس الاسم + `.spec.ts`:
  - السورس: `auth.service.ts`
  - التست: `auth.service.spec.ts`

---

## 3) هيكل التست (البناء العام)

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { الـ Service اللي بدك تختبر } from './auth.service';
// ... باقي الاستيرادات

describe('اسم الـ Service أو الميزة', () => {
  let service: AuthService;           // المتغير اللي يحمل الـ service
  const بعضMocks = jest.fn();         // دوال وهمية نتحكم فيها

  beforeEach(async () => {
    // قبل كل تاست نجهّز البيئة
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: { ... mocks } },
        // ... باقي الـ dependencies
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  describe('اسم الدالة أو السيناريو', () => {
    it('يصف شو المفروض يصير', async () => {
      // 1) Arrange: جهّز البيانات والـ mocks
      // 2) Act: استدعِ الدالة
      // 3) Assert: تحقق من النتيجة
    });
  });
});
```

- **describe**: يجمّع مجموعة تستات (حسب الـ service أو الدالة).
- **it**: تست واحد — جملة واحدة تصف المطلوب (مثلاً: "يرمي خطأ لو الإيميل مستخدم").
- **beforeEach**: ينفّذ قبل كل `it` عشان تكون البيئة نظيفة.

---

## 4) الـ Mocks (الدوال الوهمية)

الـ Service يعتمد على Repository و Mail و Token... في التست **ما نستدعي الداتابيز أو الإيميل الحقيقي**، نعطي دوال وهمية:

```ts
const findUserByEmailMock = jest.fn();

// في الـ provider:
{
  provide: AuthRepository,
  useValue: {
    findUserByEmail: findUserByEmailMock,
    createUnverifiedUser: createUnverifiedUserMock,
  },
}
```

**كيف نتحكم بالنتيجة؟**

```ts
// ترجع null (مثلاً: ما في user)
findUserByEmailMock.mockResolvedValue(null);

// ترجع user
findUserByEmailMock.mockResolvedValue({ id: '1', email: 'test@g.com', ... });

// ترجع خطأ
findUserByEmailMock.mockRejectedValue(new BadRequestException('...'));
```

- **mockResolvedValue**: للدوال اللي ترجع Promise (async).
- **mockReturnValue**: للدوال العادية.
- **mockRejectedValue**: لو بدك الدالة ترمي خطأ.

---

## 5) خطوات كتابة تاست واحد (Arrange → Act → Assert)

### مثال: "لو الإيميل مستخدم، يرمي BadRequestException"

```ts
it('should throw BadRequestException if email already registered', async () => {
  // 1) Arrange — جهّز: الـ repository يرجع user موجود
  findUserByEmailMock.mockResolvedValue(userFactory());

  // 2) Act — استدعِ الدالة (وتوقع إنها ترمي)
  await expect(authService.signup(signUpDto)).rejects.toThrow(BadRequestException);
  await expect(authService.signup(signUpDto)).rejects.toThrow('Email already registered');

  // 3) Assert — تأكد إن createUnverifiedUser ما انستدعى
  expect(createUnverifiedUserMock).not.toHaveBeenCalled();
});
```

### مثال: "يرجع رسالة نجاح ويرسل إيميل"

```ts
it('should return success message', async () => {
  // 1) Arrange
  findUserByEmailMock.mockResolvedValue(null);
  createUnverifiedUserMock.mockResolvedValue(userFactory());

  // 2) Act
  const result = await authService.signup(signUpDto);

  // 3) Assert
  expect(result.message).toBe('Please check your email to verify your account.');
  expect(sendVerificationEmailMock).toHaveBeenCalledWith(signUpDto.email, expect.any(String));
});
```

---

## 6) أشياء تستخدمها كثيراً (Jest)

| ماتريد تتحقق منه | الاستخدام |
|------------------|-----------|
| القيمة تساوي شيء | `expect(x).toBe(5)` أو `expect(result.message).toBe('...')` |
| القيمة تشبه object | `expect(result).toMatchObject({ accessToken: '...', user: { id: '1' } })` |
| الدالة انستدعت | `expect(mock).toHaveBeenCalled()` |
| الدالة انستدعت بمعطيات معينة | `expect(mock).toHaveBeenCalledWith(email, expect.any(String))` |
| الدالة ما انستدعت | `expect(mock).not.toHaveBeenCalled()` |
| الدالة ترمي خطأ | `await expect(service.method()).rejects.toThrow(BadRequestException)` |
| الدالة ترمي ورسالة الخطأ | `await expect(service.method()).rejects.toThrow('نص الرسالة')` |

---

## 7) Mock لملف كامل (مثلاً فحص إيميل)

لو الـ service يستورد دالة من ملف ثاني (مثل `validateRealEmail`) وتريد تتحكم بنتيجتها بدون ما تشغّل الكود الحقيقي:

```ts
jest.mock('src/common/utils/email-validation.util', () => ({
  validateRealEmail: jest.fn().mockResolvedValue({ valid: true }),
}));
```

هيك كل استدعاء لـ `validateRealEmail` في التست يرجع `{ valid: true }` بدون ما يفتح شبكة أو يتحقق من الدومين فعلياً.

---

## 8) تشغيل التستات

```bash
npm test              # كل التستات
npm run test:watch    # تشغيل مع إعادة تشغيل عند حفظ الملف
npm run test:cov      # تقرير تغطية (أي سطر انغطّي بتست)
```

---

## 9) ملخص خطوات لما تضيف تاست جديد

1. افتح الملف `.spec.ts` تبع الـ service (أو انشئ واحد إذا ما موجود).
2. تأكد إن كل الـ dependencies (Repository, Mail, …) معطاة كـ **mocks** في `providers`.
3. فكّر بالسيناريو: "لو صار X، المفروض يصير Y".
4. اكتب `it('يصف السيناريو', async () => { ... })`.
5. جوه الـ `it`: **Arrange** (mocks + بيانات) → **Act** (استدعاء الدالة) → **Assert** (expect).
6. شغّل `npm test` وتأكد إن التاست يعدي.

لو حابب نطبّق نفس الخطوات على دالة معينة (مثلاً signin أو verifyEmail) نقدر نكتب معاً التاست خطوة خطوة.
