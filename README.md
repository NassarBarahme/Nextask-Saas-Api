# Nextask API

> **Backend API** for **Nextask** — a B2B business management platform that unifies retail, wholesale, and logistics in one system.

Built with **NestJS 11** + **TypeScript** + **PostgreSQL** + **Prisma 7**, featuring a complete authentication system (signup, email verification, JWT, password recovery) and interactive documentation via **Swagger**.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your environment file:
   ```bash
   copy env.example .env
   ```
3. Set your database and email values inside `.env`.
4. Run Prisma and start the server:
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   npm run start:dev
   ```
5. Open Swagger at:
   ```text
   http://localhost:3000/api
   ```

## Swagger & Testing Flow

- Use `POST /auth/signup` to create a new account.
- Open the verification link from the email to activate the account.
- Use `POST /auth/signin` to receive tokens.
- Use `POST /auth/refresh` and `POST /auth/logout` for token management.
- Use `POST /auth/forgot-password` and `POST /auth/reset-password` for recovery flow.

Example signup request:

```json
{
  "name": "John",
  "email": "user@example.com",
  "password": "Password123"
}
```

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

| Entity           | Description                                        |
| ---------------- | -------------------------------------------------- |
| **User**         | System user (email, password, verification status) |
| **Organization** | Company/org (retail, wholesale, or logistics)      |
| **Membership**   | User membership in an organization with a role     |
| **Item**         | Organization products (price, stock, barcode)      |
| **Order**        | Orders between buyer, seller, and delivery company |
| **OrderItem**    | Order line items                                   |

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

| Technology                                                                     | Purpose               |
| ------------------------------------------------------------------------------ | --------------------- |
| [NestJS 11](https://nestjs.com/)                                               | Backend framework     |
| [TypeScript 5.9](https://www.typescriptlang.org/)                              | Programming language  |
| [Prisma 7](https://www.prisma.io/)                                             | ORM + Migrations      |
| [PostgreSQL](https://www.postgresql.org/)                                      | Database              |
| [Passport JWT](https://www.passportjs.org/)                                    | Token authentication  |
| [bcrypt](https://www.npmjs.com/package/bcrypt)                                 | Password hashing      |
| [@nestjs-modules/mailer](https://www.npmjs.com/package/@nestjs-modules/mailer) | Email sending (SMTP)  |
| [@nestjs/swagger](https://docs.nestjs.com/openapi/introduction)                | API documentation     |
| [@nestjs/throttler](https://docs.nestjs.com/security/rate-limiting)            | Rate limiting         |
| [@nestjs/schedule](https://docs.nestjs.com/techniques/task-scheduling)         | Cron jobs             |
| [Jest](https://jestjs.io/)                                                     | Testing               |
| [Helmet](https://helmetjs.github.io/)                                          | HTTP security headers |

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
├── PROJECT-GUIDE.md           # Detailed per-file guide (English)
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

| Variable              | Required | Description                                    |
| --------------------- | -------- | ---------------------------------------------- |
| `DATABASE_URL`        | Yes      | PostgreSQL connection string                   |
| `JWT_ACCESS_SECRET`   | Yes      | Access Token signing key                       |
| `JWT_REFRESH_SECRET`  | Yes      | Refresh Token signing key                      |
| `MAIL_USER`           | Yes\*    | SMTP email (\*for signup & password reset)     |
| `MAIL_PASS`           | Yes\*    | SMTP password (Gmail App Password)             |
| `API_PUBLIC_URL`      | Yes\*    | Base URL for email links (\*no `/auth` suffix) |
| `PORT`                | No       | Server port (default: 3000)                    |
| `SKIP_EMAIL_MX_CHECK` | No       | Set to `true` to disable MX validation         |

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

| Enum            | Values                                  |
| --------------- | --------------------------------------- |
| `OrgType`       | `RETAIL`, `WHOLESALE`, `LOGISTICS`      |
| `Role`          | `OWNER`, `ADMIN`, `MANAGER`, `MEMBER`   |
| `OrderStatus`   | `PENDING` → `DELIVERED` / `CANCELLED`   |
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

### Development mode

```bash
npm run start:dev
```

### Production build

```bash
npm run build
npm run start:prod
```

---

## API Endpoints

### Auth endpoints

- `POST /auth/signup`
- `POST /auth/signin`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/resend-verification`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /auth/verify-email`
- `GET /auth/verification-base-url`

---

## Authentication Flow

1. User signs up.
2. User verifies email with OTP.
3. User signs in and receives access/refresh tokens.
4. Access token is used for protected routes.
5. Refresh token can be used to obtain new tokens.

---

## Response Format

Successful responses are wrapped in:

```json
{
  "success": true,
  "data": {}
}
```

---

## Swagger

Swagger UI is available at:

```text
http://localhost:3000/api
```

---

## Testing

See [SWAGGER-TESTING.md](SWAGGER-TESTING.md) for a step-by-step testing guide.

---

## Security

- JWT-based authentication
- Rate limiting
- Helmet security headers

---

## Scheduled Tasks

The app includes scheduled cleanup for unverified users.

---

## Deployment

Deploy using any Node.js-compatible host and set your environment variables.

---

## Troubleshooting

- If your verification link returns 404, ensure `API_PUBLIC_URL` points to the API server.
- If port `3000` is busy, change `PORT` in `.env`.
- If email sending fails, verify your SMTP credentials.

---

## Additional Docs

- [PROJECT-GUIDE.md](PROJECT-GUIDE.md)
- [MAIL-SETUP.md](MAIL-SETUP.md)
- [TESTING-GUIDE.md](TESTING-GUIDE.md)
- [VERIFY-EMAIL-404.md](VERIFY-EMAIL-404.md)
