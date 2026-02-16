# Why emails are not sending / how to fix

## 1. Set MAIL_USER and MAIL_PASS in .env

In your project root, in `.env`, add:

```env
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-password-or-app-password
```

If these are missing or wrong, the API will return **500** with a message like:  
`Mail not configured. Set MAIL_USER and MAIL_PASS in .env ...`

---

## 2. Gmail: use an App Password (recommended)

If you use **Gmail**, the normal account password often does not work for SMTP. You need an **App Password**:

1. Turn on **2-Step Verification** for your Google account (if not already).
2. Go to: https://myaccount.google.com/apppasswords  
   (or search: Google App Passwords)
3. Create an App Password for “Mail” (or “Other” and name it “Nextask”).
4. Copy the 16-character password (no spaces).
5. In `.env` set:
   ```env
   MAIL_USER=your-gmail@gmail.com
   MAIL_PASS=xxxx xxxx xxxx xxxx
   ```
   (you can paste with or without spaces)

Restart the server after changing `.env`.

---

## 3. Other providers (Outlook, Yahoo, etc.)

- Use the SMTP settings for your provider (host, port, secure).
- The code is set for **Gmail** (`smtp.gmail.com`, port 465). For another provider you would change `mail.module.ts` (host/port) and still use `MAIL_USER` and `MAIL_PASS`.

---

## 4. Check the server response

- If signup returns **201** and the message “Please check your email to verify your account” but you receive **no email**:
  - Check spam/junk.
  - Confirm `MAIL_USER` is correct and `MAIL_PASS` is the App Password (for Gmail).
- If you get **500** with “Failed to send verification email” or “Mail not configured”:
  - Fix `MAIL_USER` and `MAIL_PASS` in `.env` as above, then restart the server.

---

## Summary

| Problem              | Fix                                                                 |
|----------------------|---------------------------------------------------------------------|
| No email sent        | Set `MAIL_USER` and `MAIL_PASS` in `.env`                          |
| Gmail not working    | Use a Gmail **App Password**, not your normal Gmail password        |
| 500 mail error       | Check env vars, restart server, read the error message in the log  |
