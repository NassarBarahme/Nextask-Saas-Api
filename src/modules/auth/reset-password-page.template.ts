/**
 * HTML page for reset-password link. User opens GET /auth/reset-password?email=...&otpCode=...
 * and sees a form to enter new password; submit POSTs to /auth/reset-password.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getResetPasswordPageHtml(email: string, otpCode: string): string {
  const emailEscaped = escapeHtml(email);
  const otpEscaped = escapeHtml(otpCode);
  const hasParams = Boolean(email && otpCode);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Reset password - Nextask</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 400px; margin: 40px auto; padding: 20px; }
    h1 { color: #333; }
    .field { margin-bottom: 12px; }
    label { display: block; margin-bottom: 4px; color: #555; }
    input[type="text"], input[type="password"] { width: 100%; padding: 8px; box-sizing: border-box; }
    button { background: #2196F3; color: white; border: none; padding: 12px 24px; font-size: 16px; cursor: pointer; border-radius: 4px; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .msg { margin-top: 12px; padding: 10px; border-radius: 4px; }
    .msg.success { background: #e8f5e9; color: #2e7d32; }
    .msg.error { background: #ffebee; color: #c62828; }
    .hint { font-size: 12px; color: #777; margin-top: 4px; }
  </style>
</head>
<body>
  <h1>Reset password</h1>
  ${!hasParams ? '<p class="msg error">Incomplete link. Open the link from the email (click the button).</p>' : ''}
  <div class="field">
    <label>Email</label>
    <input type="text" id="email" value="${emailEscaped}" readonly />
  </div>
  <div class="field">
    <label>Code (from email)</label>
    <input type="text" id="otpCode" value="${otpEscaped}" readonly />
    <span class="hint">You can copy this and use it with POST /auth/reset-password if you prefer.</span>
  </div>
  <div class="field">
    <label>New password</label>
    <input type="password" id="newPassword" placeholder="At least 8 characters" minlength="8" />
  </div>
  <div class="field">
    <label>Confirm new password</label>
    <input type="password" id="confirmPassword" placeholder="Repeat password" minlength="8" />
  </div>
  <div id="msg"></div>
  <button type="button" id="submitBtn" ${!hasParams ? 'disabled' : ''}>Reset password</button>

  <script>
    document.getElementById('submitBtn').onclick = function() {
      var email = document.getElementById('email').value.trim();
      var otpCode = document.getElementById('otpCode').value.trim();
      var newPassword = document.getElementById('newPassword').value;
      var confirmPassword = document.getElementById('confirmPassword').value;
      var msgEl = document.getElementById('msg');
      var btn = document.getElementById('submitBtn');

      if (!email || !otpCode) {
        msgEl.className = 'msg error';
        msgEl.textContent = 'Email and code are required.';
        return;
      }
      if (newPassword.length < 8) {
        msgEl.className = 'msg error';
        msgEl.textContent = 'Password must be at least 8 characters.';
        return;
      }
      if (newPassword !== confirmPassword) {
        msgEl.className = 'msg error';
        msgEl.textContent = 'Passwords do not match.';
        return;
      }

      btn.disabled = true;
      msgEl.textContent = 'Sending...';
      msgEl.className = 'msg';

      fetch('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, otpCode: otpCode, newPassword: newPassword })
      })
        .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
        .then(function(result) {
          if (result.ok) {
            msgEl.className = 'msg success';
            msgEl.textContent = 'Password updated. You can sign in now.';
          } else {
            msgEl.className = 'msg error';
            msgEl.textContent = result.data.message || 'Reset failed. Code may have expired.';
            btn.disabled = false;
          }
        })
        .catch(function() {
          msgEl.className = 'msg error';
          msgEl.textContent = 'Network error. Try again.';
          btn.disabled = false;
        });
    };
  </script>
</body>
</html>
  `.trim();
}
