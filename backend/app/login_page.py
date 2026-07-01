"""HTML for the fake login page."""

LOGIN_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Prelegal — Sign in</title>
<style>
  body { margin:0; font-family:system-ui,-apple-system,sans-serif;
         background:#f7f7f8; display:flex; min-height:100vh;
         align-items:center; justify-content:center; }
  .card { background:#fff; padding:40px 48px; border-radius:8px;
          box-shadow:0 2px 12px rgba(3,33,71,.08); width:380px; }
  h1 { color:#032147; margin:0 0 4px; font-size:24px; font-weight:600; }
  p.sub { color:#888; margin:0 0 24px; font-size:14px; }
  label { display:block; font-size:13px; color:#032147; margin-bottom:6px;
          font-weight:500; }
  input { width:100%; box-sizing:border-box; padding:10px 12px;
          border:1px solid #d4d4d8; border-radius:6px; font-size:14px;
          margin-bottom:16px; outline:none; }
  input:focus { border-color:#209dd7; }
  button { width:100%; background:#209dd7; color:#fff; border:0;
           padding:12px; border-radius:6px; font-size:15px; font-weight:500;
           cursor:pointer; }
  button:hover { background:#1b8bc0; }
  .accent { color:#ecad0a; }
</style>
</head>
<body>
  <form class="card" method="post" action="/api/auth/login">
    <h1>Sign in to <span class="accent">Prelegal</span></h1>
    <p class="sub">Enter any email and password to continue.</p>
    <label for="email">Email</label>
    <input id="email" name="email" type="email" required autocomplete="email">
    <label for="password">Password</label>
    <input id="password" name="password" type="password" required autocomplete="current-password">
    <button type="submit">Continue</button>
  </form>
</body>
</html>
"""