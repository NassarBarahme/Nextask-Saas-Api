# Testing Guide (Unit Tests)

## 1) Why write tests?

- We confirm that the code behaves as expected.
- If we change something later, the tests remind us if we broke an old behavior.
- We document the behavior of a function in a way that is easy to understand.

---

## 2) Where should tests be written?

- For each source file (for example `auth.service.ts`), we create a test file in the same folder with the same name plus `.spec.ts`:
  - Source: `auth.service.ts`
  - Test: `auth.service.spec.ts`

---

## 3) Test structure (general pattern)

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
// ... other imports

describe('AuthService', () => {
  let service: AuthService;
  const someMocks = jest.fn();

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: { ...mocks } },
        // ... other dependencies
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('signup', () => {
    it('should behave as expected', async () => {
      // 1) Arrange: prepare data and mocks
      // 2) Act: call the function
      // 3) Assert: verify the result
    });
  });
});
```

- **describe**: groups related tests (by service or function).
- **it**: a single test case that describes the expected behavior.
- **beforeEach**: runs before each test to keep the environment clean.

---

## 4) Mocks

The service depends on the repository, mail service, token service, and so on. In tests, we do not call the real database or email system; we provide fake implementations:

```ts
const findUserByEmailMock = jest.fn();

// inside providers
{
  provide: AuthRepository,
  useValue: {
    findUserByEmail: findUserByEmailMock,
    createPendingUser: createPendingUserMock,
  },
}
```

**How do we control the behavior?**

```ts
// returns null (for example, no user exists)
findUserByEmailMock.mockResolvedValue(null);

// returns a user
findUserByEmailMock.mockResolvedValue({ id: '1', email: 'test@g.com', ... });

// throws an error
findUserByEmailMock.mockRejectedValue(new BadRequestException('...'));
```

- **mockResolvedValue**: for functions that return a Promise.
- **mockReturnValue**: for regular functions.
- **mockRejectedValue**: when you want the function to throw an error.

---

## 5) Writing one test (Arrange → Act → Assert)

### Example: "If the email is already registered, throw BadRequestException"

```ts
it('should throw BadRequestException if email already registered', async () => {
  // 1) Arrange — the repository returns an existing user
  findUserByEmailMock.mockResolvedValue(userFactory());

  // 2) Act — call the method and expect it to throw
  await expect(authService.signup(signUpDto)).rejects.toThrow(
    BadRequestException,
  );
  await expect(authService.signup(signUpDto)).rejects.toThrow(
    'Email already registered',
  );

  // 3) Assert — ensure the creation method was not called
  expect(createPendingUserMock).not.toHaveBeenCalled();
});
```

### Example: "Return a success message and send an email"

```ts
it('should return success message', async () => {
  // 1) Arrange
  findUserByEmailMock.mockResolvedValue(null);
  createPendingUserMock.mockResolvedValue(userFactory());

  // 2) Act
  const result = await authService.signup(signUpDto);

  // 3) Assert
  expect(result.message).toBe(
    'Please check your email to verify your account.',
  );
  expect(sendVerificationEmailMock).toHaveBeenCalledWith(
    signUpDto.email,
    expect.any(String),
  );
});
```

---

## 6) Common Jest assertions

| What you want to verify                       | Usage                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| A value equals something                      | `expect(x).toBe(5)` or `expect(result.message).toBe('...')`               |
| An object matches a shape                     | `expect(result).toMatchObject({ accessToken: '...', user: { id: '1' } })` |
| A function was called                         | `expect(mock).toHaveBeenCalled()`                                         |
| A function was called with specific arguments | `expect(mock).toHaveBeenCalledWith(email, expect.any(String))`            |
| A function was not called                     | `expect(mock).not.toHaveBeenCalled()`                                     |
| A function throws an error                    | `await expect(service.method()).rejects.toThrow(BadRequestException)`     |
| A function throws a specific message          | `await expect(service.method()).rejects.toThrow('error message')`         |

---

## 7) Mocking an entire module (for example email validation)

If the service imports a helper such as `validateRealEmail` and you want to control its result without running the real implementation:

```ts
jest.mock('src/common/utils/email-validation.util', () => ({
  validateRealEmail: jest.fn().mockResolvedValue({ valid: true }),
}));
```

This makes every call to `validateRealEmail` return `{ valid: true }` without opening the network or validating the actual domain.

---

## 8) Running tests

```bash
npm test              # all tests
npm run test:watch    # run and restart on file changes
npm run test:cov      # coverage report
```

---

## 9) Summary of the steps for adding a new test

1. Open the `.spec.ts` file for the service, or create one if it does not exist.
2. Make sure all dependencies (Repository, Mail, etc.) are provided as mocks in `providers`.
3. Think about the scenario: "If X happens, Y should happen".
4. Write `it('describes the scenario', async () => { ... })`.
5. Inside the `it`, follow **Arrange** (mocks + data) → **Act** (call the function) → **Assert** (expect).
6. Run `npm test` and verify the test passes.

If you want, we can apply the same approach to a specific function such as `signin` or `verifyEmail` step by step.
