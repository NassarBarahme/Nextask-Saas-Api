# Project Guide — Nextask API

A concise overview of each file, what it does, and how the pieces connect together.

---

## 1. Request flow from start to finish

```
Browser / Client
      │
      ▼
   main.ts          ← Starts the app and applies global middleware: ValidationPipe + ExceptionFilter + TransformInterceptor
      │
      ▼
   AppModule        ← Combines modules and applies AccessTokenGuard to all routes by default
      │
      ▼
   AccessTokenGuard ← Decides whether the route is public (such as verify-email) or protected by JWT
      │
      ▼ (if protected)
   AccessTokenStrategy ← Reads the token from the header and validates it, then attaches the payload to request.user
      │
      ▼
   AuthController   ← Receives the request, reads Body/Query, and calls AuthService
      │
      ▼
   AuthService      ← Executes business logic (signup, verification, email, tokens), and calls Repository, MailService, and TokenService
      │
      ├──► AuthRepository   ← Reads/writes from the database through Prisma
      ├──► MailService      ← Sends emails
      └──► TokenService     ← Signs JWT access and refresh tokens
      │
      ▼
   The response is returned to the client, either as a wrapped response via TransformInterceptor or as-is when already wrapped
```

---

## 2. Root: main.ts and AppModule

### `src/main.ts`

- **Role:** Starts the NestJS application.
- **Behavior:**
  - Creates the app from `AppModule`.
  - Applies a global `ValidationPipe` to validate DTOs, reject unknown fields when `forbidNonWhitelisted: true`, and transform input types when enabled.
  - Applies a global `HttpExceptionFilter` so thrown HTTP errors are returned in a consistent format.
  - Applies a global `TransformInterceptor` so successful responses are wrapped as `{ success: true, data }` unless already wrapped.
- **Connection:** Imports `AppModule`, `TransformInterceptor`, and `HttpExceptionFilter`; other wiring is handled inside modules.

### `src/app.module.ts`

- **Role:** Combines all modules and applies default protection.
- **Behavior:**
  - Imports `AuthModule`, `PrismaModule`, and `ConfigModule.forRoot({ isGlobal: true })`.
  - Registers `APP_GUARD` with `AccessTokenGuard`, meaning all routes are protected by JWT except explicitly public ones.
- **Connection:** The guard lives in Auth but is applied globally from this module.

---

## 3. Auth module: files, logic, and relationships

### `src/modules/auth/auth.module.ts`

- **Role:** Defines the authentication module and supplies the needed services.
- **Behavior:**
  - Imports `PrismaModule`, `ConfigModule`, `MailModule`, and `JwtModule`.
  - Provides `AuthService`, `AuthRepository`, `TokenService`, `AccessTokenStrategy`, and `RefreshTokenStrategy`.
  - Registers `AuthController`.
  - Exports `AuthService` and `TokenService` for future reuse.
- **Connection:** The controller depends on `AuthService`; the service depends on repository, token service, and mail service.

### `src/modules/auth/auth.controller.ts`

- **Role:** Receives HTTP requests and delegates work to the service.
- **Behavior (for each endpoint):**
  - `POST /auth/signup` — public. Body: `CreateUserDto`. Calls `authService.signup()`.
  - `POST /auth/signin` — public. Body: `SigninDto`. Calls `authService.signin()`.
  - `POST /auth/refresh` — protected by `RefreshTokenGuard`. Extracts `sub` and refresh token and calls `authService.refreshTokens()`.
  - `POST /auth/logout` — protected by `AccessTokenGuard`. Extracts the user ID and calls `authService.logout()`.
  - `POST /auth/resend-verification` — public. Body: `ResendVerificationDto`. Calls `authService.resendVerificationEmail()`.
  - `POST /auth/forgot-password` — public. Body: `ForgotPasswordDto`. Calls `authService.forgotPassword()`.
  - `POST /auth/reset-password` — public. Body: `ResetPasswordDto`. Calls `authService.resetPassword()`.
  - `GET /auth/verify-email` — public. Query: `email`, `otpCode`. Verifies the account and returns an HTML page for success or failure.
- **Connection:** Depends on `AuthService` and `ConfigService`; it does not interact directly with the database or mail layer.

### `src/modules/auth/auth.service.ts`

- **Role:** Contains the core authentication business logic.
- **Behavior summary:**
  - `signup`: validates the email, checks for duplicates, hashes the password, generates an OTP with expiry, stores a pending user, and sends a verification email.
  - `resendVerificationEmail`: verifies the user is still pending, generates a new OTP, updates the pending user, and resends the verification email.
  - `verifyEmail`: checks the pending record, validates expiry and OTP, creates the user with organization and membership, and deletes the pending record.
  - `signin`: if the user exists, validates the password and builds tokens. If only a pending user exists and the password is correct, it activates the account and signs in.
  - `refreshTokens`: validates the refresh token and issues new access and refresh tokens.
  - `logout`: clears the refresh token on the user record.
  - `forgotPassword`: generates an OTP for the user and sends a reset email.
  - `resetPassword`: validates the OTP and updates the password.
- **Helper functions:** `getCurrentMembership(user)` chooses the active or first membership; `buildAuthResponse(...)` builds the standard auth response shape.
- **Connection:** Calls `AuthRepository` for database work, `MailService` for emails, `TokenService` for tokens, and `validateRealEmail` from the common utils before registration.

### `src/modules/auth/auth.repository.ts`

- **Role:** Database access layer for auth-related operations.
- **Behavior (key methods):**
  - `findUserByEmail` / `findUserById`: read users together with memberships and organization data.
  - `updateRefreshToken`: update or clear the refresh token.
  - `updateOtpCode` / `updatePasswordAndClearOtp`: handle password reset for verified users.
  - `createPendingUser` / `findPendingUser` / `deletePendingUser`: manage the temporary pending-user table and log failures when cleanup fails.
  - `createUserWithOrganization`: inside a transaction, creates the user, organization, membership, and updates `activeOrganizationId`; uses `slug.util` to create a unique organization slug.
- **Connection:** Depends only on `PrismaService` and imports `generateSlug` / `generateUniqueSlug` from the common utils.

### `src/modules/auth/guards/access-token.guard.ts`

- **Role:** Determines whether a request needs JWT authentication.
- **Behavior:** If the route is listed in `PUBLIC_PATHS` or decorated with `@Public()`, the request is allowed. Otherwise it invokes the JWT strategy.
- **Connection:** Depends on `Reflector`, the `Public` decorator metadata, and the auth constants file.

### `src/modules/auth/guards/refresh-token.guard.ts`

- **Role:** Protects the refresh endpoint.
- **Behavior:** Uses the `jwt-refresh` strategy.
- **Connection:** Works alongside `RefreshTokenStrategy`.

### `src/modules/auth/strategies/access-token.strategy.ts`

- **Role:** Extracts and validates the JWT from the `Authorization` header.
- **Behavior:** Reads the token, validates it with `JWT_ACCESS_SECRET`, and attaches the payload to `request.user`.
- **Connection:** Uses `ConfigService` for the secret; the guard invokes this strategy.

### `src/modules/auth/strategies/refresh-token.strategy.ts`

- **Role:** Validates the refresh token and exposes the payload to the controller.
- **Behavior:** Reads the token, validates it with `JWT_REFRESH_SECRET`, and returns the payload plus the raw token to the controller.
- **Connection:** Used by `RefreshTokenGuard` for `POST /auth/refresh`.

### `src/modules/auth/token/token.service.ts`

- **Role:** Creates access and refresh tokens.
- **Behavior:** Uses `JwtService` with secrets and expiration values from configuration.
- **Connection:** Called only from `AuthService`.

### `src/modules/auth/token/token.payload.ts`

- **Role:** Defines the token payload shape such as `sub`, `email`, `role`, and `orgId`.
- **Connection:** Imported by `AuthService` and `TokenService`.

### `src/modules/auth/decorators/public.decorator.ts`

- **Role:** Marks a route as public, so no JWT is required.
- **Behavior:** Sets `IS_PUBLIC_KEY` metadata. `AccessTokenGuard` reads this metadata and allows the request.
- **Connection:** Used on controller handlers and classes.

### `src/modules/auth/decorators/get-current-user.decorator.ts`

- **Role:** Extracts the current user from `request.user`.
- **Behavior:** Uses `createParamDecorator` to read a property from the request object; if a key is provided, it returns that specific field.
- **Connection:** Used in the controller for refresh and logout flows.

### `src/modules/auth/auth.constants.ts`

- **Role:** Stores OTP expiry constants and public route lists.
- **Behavior:** Defines `OTP_VERIFICATION_EXPIRY_MS`, `OTP_PASSWORD_RESET_EXPIRY_MS`, and `PUBLIC_PATHS`.
- **Connection:** Imported by `AuthService` and `AccessTokenGuard`.

### `src/modules/auth/auth.types.ts`

- **Role:** Defines the shape of a pending-user record used during verification.
- **Connection:** Imported by `AuthService` when handling pending-user records.

### DTOs inside `src/modules/auth/dto/`

- `create-user.dto.ts`: defines `name`, `email`, and `password` with validation rules.
- `signin.dto.ts`: defines `email` and `password` for sign-in.
- `forgot-password.dto.ts` / `reset-password.dto.ts`: define password recovery fields.
- `resend-verification.dto.ts`: defines the email field for resending verification.
- `verify-email-query.dto.ts`: defines `email` and `otpCode` for query-string validation.
- **Connection:** The controller passes them to the service; `ValidationPipe` validates them before reaching the controller.

---

## 4. Mail module

### `src/modules/mail/mail.module.ts`

- **Role:** Configures mail sending and provides `MailService`.
- **Behavior:** Uses `MailerModule.forRootAsync` with SMTP credentials from the environment config and exports `MailService`.
- **Connection:** `AuthModule` imports this module so auth can send verification and password-reset emails.

### `src/modules/mail/mail.service.ts`

- **Role:** Sends verification and password-reset emails.
- **Behavior:** Uses the public base URL from `API_PUBLIC_URL` or `APP_URL`; builds the verification link and password reset link using the related templates.
- **Connection:** Called from `AuthService` only; the templates live in the templates folder.

### `src/modules/mail/templates/verification.template.ts`

- **Role:** Renders the HTML verification email.
- **Connection:** Used by `MailService`.

### `src/modules/mail/templates/forgot-password.template.ts`

- **Role:** Renders the HTML password-reset email.
- **Connection:** Used by `MailService`.

---

## 5. Prisma module

### `src/modules/prisma/prisma.module.ts`

- **Role:** Provides `PrismaService` to other modules.
- **Behavior:** Declares `PrismaService` as a provider and exports it.
- **Connection:** `AuthModule` and other modules import this module.

### `src/modules/prisma/prisma.service.ts`

- **Role:** Prisma client connected to the database.
- **Behavior:** Extends `PrismaClient` and uses the database URL from the environment.
- **Connection:** Injected into `AuthRepository` and any future repositories.

### `prisma/schema.prisma`

- **Role:** Defines the database schema and relationships.
- **Key models:** `PendingUser`, `User`, `Organization`, and `Membership`; the rest such as `Item`, `Order`, and `OrderItem` are prepared for future features.
- **Connection:** The generated Prisma client under `src/generated/prisma` is consumed by `PrismaService` and `AuthRepository`.

---

## 6. Common helpers shared across modules

### `src/exception-filter/http-exception.filter.ts`

- **Role:** Standardizes the format of error responses for HTTP exceptions.
- **Behavior:** Catches exceptions and returns a JSON payload with `statusCode`, `timestamp`, `path`, and `message`.
- **Connection:** Applied globally from `main.ts`.

### `src/common/Interceptor/TransformInterceptor.ts`

- **Role:** Standardizes the shape of successful responses.
- **Behavior:** Wraps responses as `{ success: true, data }` unless the response already has `success: true`.
- **Connection:** Applied globally from `main.ts`.

### `src/common/utils/slug.util.ts`

- **Role:** Converts names to slugs and ensures they are unique.
- **Behavior:** `generateSlug` creates a clean slug; `generateUniqueSlug` checks for collisions.
- **Connection:** Used by `AuthRepository` when creating an organization.

### `src/common/utils/email-validation.util.ts`

- **Role:** Verifies that an email address looks real before registration.
- **Behavior:** `validateRealEmail` checks the domain and DNS records.
- **Connection:** Called by `AuthService` at the start of sign-up.

### `src/common/constants/disposable-email-domains.ts`

- **Role:** Stores a list of disposable or temporary email domains.
- **Connection:** Used by the email validation utility.

---

## 7. Dependency map between files

```
main.ts
  └── AppModule
        ├── ConfigModule (global)
        ├── PrismaModule → PrismaService
        ├── AuthModule
        │     ├── AuthController ──► AuthService
        │     │                         ├── AuthRepository ──► PrismaService
        │     │                         ├── MailService (from MailModule)
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

## 8. Quick summary of the user flow

| Step                | Route                            | Main file                                           | What happens                                                            |
| ------------------- | -------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| Sign up             | `POST /auth/signup`              | `AuthController` → `AuthService`                    | Validates email, creates a pending user, and sends a verification email |
| Verify              | `GET /auth/verify-email`         | `AuthController` → `AuthService` → `AuthRepository` | Moves the pending user to a real user and removes the pending record    |
| Sign in             | `POST /auth/signin`              | `AuthController` → `AuthService`                    | Verifies credentials and returns access/refresh tokens                  |
| Refresh token       | `POST /auth/refresh`             | `AuthController` → `AuthService`                    | Validates the refresh token and issues new tokens                       |
| Logout              | `POST /auth/logout`              | `AuthController` → `AuthService` → `AuthRepository` | Clears the refresh token                                                |
| Resend verification | `POST /auth/resend-verification` | `AuthController` → `AuthService`                    | Generates a new OTP and sends a new verification email                  |
| Forgot password     | `POST /auth/forgot-password`     | `AuthController` → `AuthService`                    | Generates an OTP and sends a reset email                                |
| Reset password      | `POST /auth/reset-password`      | `AuthController` → `AuthService`                    | Validates OTP and updates the password                                  |

This gives you a clear map of each file, what it does, and how it connects to the rest. If you follow a single path such as `signup → verify-email → signin`, you can understand the core flow of the project quickly.
