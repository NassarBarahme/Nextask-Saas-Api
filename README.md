# Nextask API

> **Backend API** for **Nextask** — a B2B business management platform that unifies retail, wholesale, and logistics in one system.

Built with **NestJS 11** + **TypeScript** + **PostgreSQL** + **Prisma 7**, featuring a complete authentication system (signup, email verification, JWT, password recovery) and interactive documentation via **Swagger**.

---

## Table of Contents

- [Overview](#overview)
- [Current Features](#current-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Running the Project](#running-the-project)
- [API Endpoints](#api-endpoints)
- [Authentication Flow](#authentication-flow)
- [Response Format](#response-format)
- [Swagger](#swagger)
- [Testing](#testing)
- [Security](#security)
- [Scheduled Tasks](#scheduled-tasks)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Additional Docs](#additional-docs)

---

## Overview

**Nextask** is a platform for managing B2B operations between organizations. The current API provides the authentication and identity layer, with a database schema ready for future features:

| Entity | Description |
|--------|-------------|
| **User** | System user (email, password, verification status) |
| **Organization** | Company/org (retail, wholesale, or logistics) |
| **Membership** | User membership in an organization with a role |
| **Item** | Organization products (price, stock, barcode) |
| **Order** | Orders between buyer, seller, and delivery company |
| **OrderItem** | Order line items |

On **first account verification**, the system automatically creates:
- An organization named `{User's Name}'s Org`
- A membership with the **OWNER** role
- Links the user to the org as `activeOrganizationId`

---

## Current Features

### Auth Module (Complete)

- User signup with real email validation
- Account verification via email link (8-digit OTP)
- Sign in with **Access Token** + **Refresh Token** issuance
- Token refresh
- Logout (invalidates Refresh Token)
- Resend verification email
- Forgot password / reset password
- HTML pages for email verification and password reset
- Automatic deletion of unverified accounts after 24 hours

### Infrastructure

- Global JWT protection (with public route exceptions)
- Rate limiting (10 requests/minute)
- Helmet for secure HTTP headers
- Unified success and error response shapes
- Swagger UI at `/api`
- Unit tests for `AuthService`

### DB Schema (Ready — No Controllers Yet)

`Item`, `Order`, and `OrderItem` tables with relations and enums are defined in Prisma and ready for future development.

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [NestJS 11](https://nestjs.com/) | Backend framework |
| [TypeScript 5.9](https://www.typescriptlang.org/) | Programming language |
| [Prisma 7](https://www.prisma.io/) | ORM + Migrations |
| [PostgreSQL](https://www.postgresql.org/) | Database |
| [Passport JWT](https://www.passportjs.org/) | Token authentication |
| [bcrypt](https://www.npmjs.com/package/bcrypt) | Password hashing |
| [@nestjs-modules/mailer](https://www.npmjs.com/package/@nestjs-modules/mailer) | Email sending (SMTP) |
| [@nestjs/swagger](https://docs.nestjs.com/openapi/introduction) | API documentation |
| [@nestjs/throttler](https://docs.nestjs.com/security/rate-limiting) | Rate limiting |
| [@nestjs/schedule](https://docs.nestjs.com/techniques/task-scheduling) | Cron jobs |
| [Jest](https://jestjs.io/) | Testing |
| [Helmet](https://helmetjs.github.io/) | HTTP security headers |

---

## Project Structure

```
Nextask-API-nassar/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Migration files
├── src/
│   ├── main.ts                # Entry point + Swagger + Pipes/Filters
│   ├── app.module.ts          # Module assembly + global Guards
│   ├── common/
│   │   ├── Interceptor/       # TransformInterceptor
│   │   ├── constants/         # Disposable email domain list
│   │   └── utils/             # slug, email validation
│   ├── exception-filter/      # HttpExceptionFilter
│   ├── generated/prisma/      # Prisma Client (auto-generated)
│   └── modules/
│       ├── auth/              # Auth (Controller, Service, Repository, Guards, DTOs)
│       ├── mail/              # Email sending + templates
│       └── prisma/            # PrismaService
├── test/                      # E2E tests
├── env.example                # Environment variable template
├── PROJECT-GUIDE.md           # Detailed per-file guide (Arabic)
├── MAIL-SETUP.md              # Email setup
├── SWAGGER-TESTING.md         # Testing API via Swagger
├── TESTING-GUIDE.md           # Unit test writing guide
└── VERIFY-EMAIL-404.md        # Fix verify-email 404 issues
```

---

## Prerequisites

- **Node.js** 18+ (20+ recommended)
- **npm** 9+
- **PostgreSQL** 14+ (local or cloud)
- **Gmail** account with App Password (or another SMTP provider) for sending emails

---

## Installation & Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd Nextask-API-nassar
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp env.example .env
```

Edit `.env` with the correct values (see [Environment Variables](#environment-variables)).

### 4. Set up the database

```bash
npx prisma generate
npx prisma migrate deploy
```

### 5. Start the server

```bash
npm run start:dev
```

Server runs at: `http://localhost:3000` (or the port set in `PORT`).

---

## Environment Variables

Copy from `env.example` and fill in the values:

```env
# ——— Public API URL (required for email links) ———
# ⚠️ Must be the API URL (NestJS) — NOT the frontend URL
API_PUBLIC_URL=http://localhost:3000
APP_URL=                          # Optional fallback for API_PUBLIC_URL

# ——— Email ———
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-gmail-app-password

# ——— JWT ———
JWT_ACCESS_SECRET=your-super-secret-access-key
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_REFRESH_EXPIRATION=7d

# ——— Database ———
DATABASE_URL=postgresql://user:password@localhost:5432/nextask

# ——— Port ———
PORT=3000

# ——— Optional: email MX check ———
# SKIP_EMAIL_MX_CHECK=true   # Disable MX check (useful in development)
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Yes | Access Token signing key |
| `JWT_REFRESH_SECRET` | Yes | Refresh Token signing key |
| `MAIL_USER` | Yes* | SMTP email (*for signup & password reset) |
| `MAIL_PASS` | Yes* | SMTP password (Gmail App Password) |
| `API_PUBLIC_URL` | Yes* | Base URL for email links (*no `/auth` suffix) |
| `PORT` | No | Server port (default: 3000) |
| `SKIP_EMAIL_MX_CHECK` | No | Set to `true` to disable MX validation |

> **Gmail:** Use an [App Password](https://myaccount.google.com/apppasswords), not your regular account password. See `MAIL-SETUP.md`.

---

## Database

### Main Models

```
User ──────< Membership >────── Organization
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
                  Item           Order (buyer)   Order (seller/delivery)
                    │               │
                    └─────< OrderItem
```

### Enums

| Enum | Values |
|------|--------|
| `OrgType` | `RETAIL`, `WHOLESALE`, `LOGISTICS` |
| `Role` | `OWNER`, `ADMIN`, `MANAGER`, `MEMBER` |
| `OrderStatus` | `PENDING` → `DELIVERED` / `CANCELLED` |
| `PaymentStatus` | `UNPAID`, `PARTIAL`, `PAID`, `REFUNDED` |

### Useful Prisma Commands

```bash
npx prisma generate          # Generate Prisma Client
npx prisma migrate dev       # Create new migration (development)
npx prisma migrate deploy    # Apply migrations (production)
npx prisma studio            # Visual database browser
```

---

## Running the Project

| Command | Description |
|---------|-------------|
| `npm run start` | Standard start |
| `npm run start:dev` | Start with hot reload |
| `npm run start:debug` | Start with debugger |
| `npm run start:prod` | Run from `dist/` (after `npm run build`) |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

---

## API Endpoints

Base URL: `http://localhost:3000`

### Auth — Public routes (no JWT required)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/signup` | Register a new user |
| `POST` | `/auth/signin` | Sign in |
| `POST` | `/auth/refresh` | Refresh tokens |
| `POST` | `/auth/logout` | Log out |
| `POST` | `/auth/resend-verification` | Resend verification email |
| `POST` | `/auth/forgot-password` | Request password reset OTP |
| `POST` | `/auth/reset-password` | Set a new password |
| `GET` | `/auth/verify-email` | Verify account (email link → HTML page) |
| `GET` | `/auth/reset-password` | HTML page for password reset |
| `GET` | `/auth/verification-base-url` | Check the URL used in email links |
| `POST` | `/auth/test-send-email` | Test email sending (development) |

### Request Examples

#### Sign up

```http
POST /auth/signup
Content-Type: application/json

{
  "name": "John",
  "email": "john@example.com",
  "password": "Password123"
}
```

**Password requirements:** minimum 6 characters + at least one uppercase letter (A-Z).

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Please check your email to verify your account."
  }
}
```

#### Sign in

```http
POST /auth/signin
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "Password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "name": "John",
      "email": "john@example.com",
      "role": "OWNER",
      "orgId": "org-uuid"
    }
  }
}
```

#### Refresh tokens

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Log out

```http
POST /auth/logout
Content-Type: application/json

{
  "accessToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Forgot password

```http
POST /auth/forgot-password
Content-Type: application/json

{
  "email": "john@example.com"
}
```

#### Reset password

```http
POST /auth/reset-password
Content-Type: application/json

{
  "email": "john@example.com",
  "otpCode": "12345678",
  "newPassword": "NewPassword123"
}
```

---

## Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant API as Nextask API
    participant DB as PostgreSQL
    participant Mail as SMTP

    U->>API: POST /auth/signup
    API->>API: validateRealEmail()
    API->>DB: createUnverifiedUser()
    API->>Mail: sendVerificationEmail()
    API-->>U: "Check your email"

    U->>API: GET /auth/verify-email?email&otpCode
    API->>DB: createOrganizationAndMembership()
    API-->>U: HTML success page

    U->>API: POST /auth/signin
    API->>DB: verify password
    API->>API: generate JWT tokens
    API-->>U: accessToken + refreshToken + user

    U->>API: POST /auth/refresh
    API->>API: verify refresh token
    API-->>U: new tokens

    U->>API: POST /auth/logout
    API->>DB: clear refreshToken
    API-->>U: "Logged out"
```

### OTP Expiry

| Type | Duration |
|------|----------|
| Email verification | 15 minutes |
| Password reset | 10 minutes |
| Unverified account deletion | 24 hours |

### Token Expiry

| Token | Default Duration |
|-------|------------------|
| Access Token | 10 minutes |
| Refresh Token | 7 days |

---

## Response Format

### Success (most routes)

```json
{
  "success": true,
  "data": { ... }
}
```

### Error (HttpException)

```json
{
  "statusCode": 400,
  "timestamp": "2026-06-26T12:00:00.000Z",
  "path": "/auth/signup",
  "message": "Email already registered"
}
```

### Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created (signup) |
| `400` | Bad request / invalid data |
| `401` | Unauthorized (wrong credentials / OTP) |
| `403` | Forbidden (invalid token / no membership) |
| `429` | Too many requests (rate limit) |
| `500` | Server error (e.g. email send failure) |

---

## Swagger

After starting the server, open:

```
http://localhost:3000/api
```

- Try any endpoint directly from the browser
- Use **Authorize** to enter tokens
- See `SWAGGER-TESTING.md` for detailed steps

---

## Testing

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# E2E tests
npm run test:e2e
```

Current tests cover `AuthService` (signup, signin, verify, refresh, logout, forgot/reset password).

See `TESTING-GUIDE.md` for writing new tests.

---

## Security

| Mechanism | Details |
|-----------|---------|
| **JWT** | Separate Access + Refresh keys |
| **bcrypt** | Password hashing (cost: 10) |
| **Refresh Token** | Stored hashed in DB |
| **Helmet** | Secure HTTP headers |
| **Rate Limiting** | 10 requests / 60 seconds |
| **ValidationPipe** | whitelist + forbidNonWhitelisted |
| **Email Validation** | Rejects disposable emails + MX check (in production) |
| **OTP** | Random 8-digit code with expiry |

### Protected Routes

`AccessTokenGuard` is applied to **all** routes by default. Public routes are marked with `@Public()`.

---

## Scheduled Tasks

| Task | Schedule | Description |
|------|----------|-------------|
| `UnverifiedUsersCleaner` | Daily at 3:00 AM | Deletes `isVerified: false` accounts older than 24 hours |

---

## Deployment

### General Steps

1. Set environment variables on the server (`DATABASE_URL`, `JWT_*`, `MAIL_*`, `API_PUBLIC_URL`)
2. Run migrations:
   ```bash
   npx prisma migrate deploy
   ```
3. Build the project:
   ```bash
   npm run build
   ```
4. Start:
   ```bash
   npm run start:prod
   ```

### Important Notes

- `API_PUBLIC_URL` **must** point to the deployed API URL (not the frontend)
- Verify with: `GET /auth/verification-base-url`
- Use HTTPS in production
- Use strong random values for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`

### Suggested Platforms

Railway, Render, Fly.io, AWS, DigitalOcean, VPS

---

## Troubleshooting

### Email not received

1. Confirm `MAIL_USER` and `MAIL_PASS` in `.env`
2. Gmail: use an App Password
3. Try: `POST /auth/test-send-email` with `{ "email": "your@email.com" }`
4. Check your spam folder
5. See `MAIL-SETUP.md`

### Verification link returns 404

**Cause:** `API_PUBLIC_URL` points to the wrong URL (e.g. a frontend Vercel deployment).

**Fix:**
```bash
GET /auth/verification-base-url
```
Make sure `verificationBaseUrl` matches your actual API URL.

See `VERIFY-EMAIL-404.md`.

### "Account not verified" on sign in

Open the verification link from your email, or use:
```http
POST /auth/resend-verification
{ "email": "your@email.com" }
```

### "Mail not configured"

Add `MAIL_USER` and `MAIL_PASS` to `.env` and restart the server.

### Database connection failure

- Check `DATABASE_URL`
- Ensure PostgreSQL is running
- Run `npx prisma migrate deploy`

### Rate Limit (429)

Limit is 10 requests per minute. Wait a minute or adjust the setting in `app.module.ts`.

---

## Additional Docs

| File | Content |
|------|---------|
| [PROJECT-GUIDE.md](./PROJECT-GUIDE.md) | Detailed per-file and request flow guide |
| [MAIL-SETUP.md](./MAIL-SETUP.md) | Gmail SMTP setup |
| [SWAGGER-TESTING.md](./SWAGGER-TESTING.md) | Testing API via Swagger |
| [TESTING-GUIDE.md](./TESTING-GUIDE.md) | Writing unit tests |
| [VERIFY-EMAIL-404.md](./VERIFY-EMAIL-404.md) | Fixing verify-email 404 issues |

---

## License

UNLICENSED — private project.

---

## Contributing

The project is under active development. The Auth module is complete; Items and Orders modules are planned (schema is ready).
