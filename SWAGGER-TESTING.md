# Swagger Testing Guide

This guide gives you a complete flow to test the API through Swagger and Postman.

## 1. Start the server

```powershell
cd c:\Users\HP\Downloads\Nextask-API-nassar\Nextask-API-nassar
npm run start:dev
```

## 2. Open Swagger

Open:

```text
http://localhost:3000/api
```

If you changed the port in `.env`, use that port instead.

## 3. Recommended test flow

### A. Sign up

Use `POST /auth/signup` with:

```json
{
  "name": "John",
  "email": "test@example.com",
  "password": "Password123"
}
```

Expected result:

- Status `201`
- Message: `Please check your email to verify your account.`

### B. Verify account

Open the verification link from the email or call:

```text
GET /auth/verify-email?email=test@example.com&otpCode=YOUR_OTP
```

### C. Sign in

Use `POST /auth/signin` with:

```json
{
  "email": "test@example.com",
  "password": "Password123"
}
```

Expected result:

- Status `200`
- Contains `accessToken` and `refreshToken`

### D. Refresh token

Use `POST /auth/refresh` with:

```json
{
  "refreshToken": "PASTE_REFRESH_TOKEN_HERE"
}
```

### E. Logout

Use `POST /auth/logout` with:

```json
{
  "accessToken": "PASTE_ACCESS_TOKEN_HERE"
}
```

### F. Forgot password

Use `POST /auth/forgot-password` with:

```json
{
  "email": "test@example.com"
}
```

### G. Reset password

Use `POST /auth/reset-password` with:

```json
{
  "email": "test@example.com",
  "otpCode": "12345678",
  "newPassword": "NewPassword123"
}
```

## 4. Swagger tips

- Click `Try it out` for any endpoint.
- Fill the JSON body or query params.
- Click `Execute` and inspect the response.
- For refresh/logout, use the `Authorize` button if required by your setup.

## 5. Postman version

Base URL:

```text
http://localhost:3000
```

Example requests:

- `POST /auth/signup`
- `POST /auth/signin`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

## 6. Common issues

- `500` or SMTP errors: check your email credentials in `.env`
- `404` on verification link: check `API_PUBLIC_URL`
- `401` on sign in: make sure the account is verified
- `EADDRINUSE`: another process is using port `3000`
