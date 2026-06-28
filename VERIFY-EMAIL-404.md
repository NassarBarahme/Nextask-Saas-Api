# If the verification button in the email opens a 404 / DEPLOYMENT_NOT_FOUND

## Cause

The link inside the email is built from the environment variable used by the server. If `API_PUBLIC_URL` or `APP_URL` points to the wrong address (for example a deleted Vercel deployment or an incorrect host), clicking the button opens that URL and you get a 404.

## Verify the URL being used

After starting the API locally or on the server, open the following in your browser or Postman:

```
GET https://your-real-api-host/auth/verification-base-url
```

Example for a local setup:

```
GET http://localhost:3000/auth/verification-base-url
```

The response should look like this:

```json
{ "verificationBaseUrl": "https://...." }
```

- If the returned URL is a Vercel URL, a broken URL, or something that returns 404, that is the problem.
- `verificationBaseUrl` must match the same host used by the API that the app uses for sign-in.

## Fix

1. Identify where the API is actually running (localhost, Railway, Render, VPS, etc.).
2. In the same environment (same `.env` file or deployment settings), set:
   ```env
   API_PUBLIC_URL=https://your-real-api-host
   ```
   Do not add `/auth` at the end — only the base URL, such as:
   - `http://localhost:3000`
   - `https://your-api.railway.app`
   - `https://api.yourdomain.com`
3. Do not set the frontend URL here — only the NestJS API URL.
4. Restart the API or redeploy it, then test again with a new signup and click the email button.

After fixing it, calling `/auth/verification-base-url` should return the same host that your API uses for authentication flows.
