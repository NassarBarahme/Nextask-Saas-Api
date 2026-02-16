# How to test the API with Swagger

## 1. Start the server

```bash
npm run start:dev
```

## 2. Open Swagger in the browser

Go to: **http://localhost:3000/api**

(Use your actual port if you set `PORT` in `.env`.)

## 3. Test an endpoint

1. Find the endpoint (e.g. **POST /auth/signup**).
2. Click on it to expand.
3. Click **"Try it out"**.
4. Edit the **Request body** (Swagger shows the fields and example values).
5. Click **"Execute"**.
6. Check **Response body** and **Response code** (200 = success).

## Example: Sign up then sign in

1. **POST /auth/signup**  
   - Try it out → set `name`, `email`, `password` (e.g. `"John"`, `"test@example.com"`, `"Password123"`).  
   - Execute. You should get **201** and a message like "Please check your email to verify your account."

2. **GET /auth/verify-email**  
   - Either open the link from the email, or in Swagger set query params `email` and `otpCode` (from the email link) and Execute.  
   - Then the account is verified.

3. **POST /auth/signin**  
   - Try it out → same `email` and `password`.  
   - Execute. You should get **200** with `accessToken`, `refreshToken`, and `user`.

4. **Protected routes (refresh, logout)**  
   - Click **"Authorize"** at the top of the Swagger page.  
   - For **refresh**: use **refresh-token** and paste the `refreshToken` from signin (with `Bearer ` prefix or as Swagger asks).  
   - For **logout**: use **access-token** and paste the `accessToken`.  
   - Then call the endpoint and Execute.

## Summary

| Step | Where | What to do |
|------|--------|------------|
| Open docs | http://localhost:3000/api | Use this URL when the server is running |
| Fill data | Request body in Swagger | Use the example values or your own |
| Run request | "Execute" button | Check response code and body |
| Auth | "Authorize" (top) | Paste token for refresh / logout |

If the response code is 200 or 201 and the body looks correct, the test passed.
