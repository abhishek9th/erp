# KIET Attendance Portal

A personal dashboard that logs into **KIET CyberVidya** (`kiet.cybervidya.net`) on your
behalf, fetches your attendance, and tells you:

- your **current attendance %**
- how many classes you can still **safely skip** while staying ≥ 75%
- if you're below 75%, how many classes you must **attend in a row** to climb back

> This tool only ever uses **your own credentials** to read **your own data**. Nothing is
> stored server-side; the session token lives only in memory for the life of the request.

---

## ⭐ Recommended: the userscript (fully automatic, zero config)

You said it best — *"I just log into CyberVidya and it fetches everything."* That's the
[`userscript/kiet-attendance.user.js`](userscript/kiet-attendance.user.js) version.

It runs **on the CyberVidya page itself**, so it needs **no login rebuild, no encryption
key, no OTP handling, and no proxy**. You log in exactly as you always do; the script rides
on your real session, watches the site's own network calls, and pops a panel showing your
%, classes you can skip, and classes you need. Nothing is hardcoded — it auto-discovers the
attendance data.

**Install (once):**

1. Add the **Tampermonkey** extension to your browser (Chrome/Edge/Firefox).
2. Open [`userscript/kiet-attendance.user.js`](userscript/kiet-attendance.user.js), click
   **Raw** on GitHub — Tampermonkey offers to install it. Click **Install**.
3. Go to `kiet.cybervidya.net`, log in normally, and open your attendance page. A panel
   appears top-right with everything computed.

That's the whole thing. The Vite app + Node proxy below is an **alternative** for people who
want a standalone dashboard instead of an on-page panel — it's more work because it has to
reimplement the encrypted login.

---

## Alternative: standalone dashboard (Vite app + Node proxy)

### Why a backend proxy?

CyberVidya's frontend is an Angular app that:

1. **AES-encrypts your credentials in the browser** before `POST /api/auth/encrypt/login`
   (this is the "locked" bit — the key ships inside the site's own JS bundle), and
2. blocks direct browser calls from other origins (CORS).

So a tiny Node/Express proxy sits between the React dashboard and CyberVidya. It holds the
AES key, performs the encrypt → login → OTP → attendance flow, and never exposes your
password to the frontend.

## Auth flow

```
React app                Node proxy                     kiet.cybervidya.net
   │  user/pass ───────────▶ │                                    │
   │                         │ AES-encrypt creds ────────────────▶│  /api/auth/encrypt/login
   │                         │                              (email OTP sent)
   │  ◀── "otp required" ────│                                    │
   │  otp code ────────────▶ │                                    │
   │                         │ verify OTP ───────────────────────▶│  /api/auth/<verify-otp>
   │                         │  ◀────────────── Bearer token ─────│
   │                         │ GET attendance (Bearer) ──────────▶│  /api/<attendance>
   │  ◀── attendance json ───│                                    │
   ▼                                                              
 compute % + skips + needed
```

## What's still stubbed

Two things must be filled in from a real logged-in session (see
[`server/cybervidya.js`](server/cybervidya.js)):

1. `AES_KEY` / encryption params — read from `main-es2015.*.js`.
2. The exact **OTP-verify** and **attendance** endpoint paths + response shapes.

Capture them from your own DevTools (Network tab → "Copy as fetch") while logging in — see
the top of `server/cybervidya.js` for the one-liner that dumps the key candidates.

## Run it

```bash
# terminal 1 — proxy
cd server && npm install && npm start        # http://localhost:8787

# terminal 2 — dashboard
cd client && npm install && npm run dev       # http://localhost:5173
```

## The math

Let `a` = attended, `t` = total held, threshold `p = 0.75`.

| Question | Formula |
|---|---|
| Current % | `a / t × 100` |
| Classes you can still skip | `floor(a / p − t)` |
| Classes to attend to reach 75% (if below) | `ceil((p·t − a) / (1 − p))` = `ceil(3t − 4a)` |

See [`client/src/lib/attendance.ts`](client/src/lib/attendance.ts).
