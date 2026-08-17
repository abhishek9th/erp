// ---------------------------------------------------------------------------
// CyberVidya API client
// ---------------------------------------------------------------------------
// All calls go to the college's ERP. This module owns the one tricky part:
// CyberVidya's Angular frontend AES-encrypts the credentials in the browser
// before POSTing them to /api/auth/encrypt/login. We replicate that here so the
// React app never has to touch the key or your raw password.
//
//  ┌─────────────────────────────────────────────────────────────────────────┐
//  │  HOW TO FILL IN THE STUBS BELOW (do this once, from your own session):    │
//  │                                                                           │
//  │  1. Log in at https://kiet.cybervidya.net/login with DevTools open.       │
//  │  2. In the Console, dump the encryption key candidates:                   │
//  │                                                                           │
//  │     (async () => {                                                        │
//  │       const src = document.querySelector('script[src*="main-es2015"]').src;│
//  │       const js  = await (await fetch(src)).text();                        │
//  │       const u   = re => [...new Set(js.match(re) || [])];                 │
//  │       console.log('CRYPTO', u(/CryptoJS\.[A-Za-z.]+|mode\.[A-Z]+|pad\.[A-Za-z0-9]+/g));│
//  │       console.log('KEYS',   u(/["'][A-Za-z0-9+\/=]{16,44}["']/g).slice(0,40));│
//  │     })();                                                                 │
//  │                                                                           │
//  │  3. In the Network tab, complete a real login (through the OTP), then     │
//  │     right-click the `login` and the otp/verify requests →                 │
//  │     Copy → "Copy as fetch". Those give you the exact bodies + the header  │
//  │     that carries the Bearer token, plus the attendance endpoint path.     │
//  └─────────────────────────────────────────────────────────────────────────┘

import CryptoJS from "crypto-js";

const BASE = "https://kiet.cybervidya.net/api";

// === STUB 1: encryption params ============================================
// Replace with the values you find in main-es2015.*.js. CyberVidya installs
// typically use AES-CBC with a static key (and sometimes a static IV). If the
// bundle shows `CryptoJS.AES.encrypt(text, key)` with a *string* key, it's
// actually OpenSSL-style (key is a passphrase, salted) — leave IV null in that
// case and pass the passphrase as AES_KEY.
const AES_KEY = process.env.CV_AES_KEY || "REPLACE_WITH_KEY_FROM_BUNDLE";
const AES_IV = process.env.CV_AES_IV || ""; // "" => passphrase/OpenSSL mode

function encryptCredential(plaintext) {
  if (AES_KEY === "REPLACE_WITH_KEY_FROM_BUNDLE") {
    throw new Error(
      "AES key not configured. Fill AES_KEY in server/cybervidya.js (see header)."
    );
  }
  if (AES_IV) {
    // Static-key + static-IV, CBC/Pkcs7 (most common explicit setup)
    const encrypted = CryptoJS.AES.encrypt(
      CryptoJS.enc.Utf8.parse(plaintext),
      CryptoJS.enc.Utf8.parse(AES_KEY),
      {
        iv: CryptoJS.enc.Utf8.parse(AES_IV),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }
    );
    return encrypted.toString(); // base64
  }
  // Passphrase mode (OpenSSL salted) — CryptoJS default
  return CryptoJS.AES.encrypt(plaintext, AES_KEY).toString();
}

async function cv(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

// === Step 1: submit credentials -> triggers email OTP =====================
// The real body shape comes from your "Copy as fetch". CyberVidya commonly
// wraps the encrypted string as { userName, password } or a single { data }.
export async function login(userName, password) {
  const body = {
    userName: encryptCredential(userName),
    password: encryptCredential(password),
  };
  return cv("/auth/encrypt/login", { method: "POST", body });
}

// === STUB 2: verify the emailed OTP -> returns Bearer token ===============
// Replace the path/body with your captured request. The token usually comes
// back at json.data.token or json.token.
export async function verifyOtp(userName, otp, loginContext = {}) {
  const body = {
    userName: encryptCredential(userName),
    otp,
    ...loginContext, // any txn id / ref the login step returned
  };
  const r = await cv("/auth/verify-otp", { method: "POST", body });
  const token = r.json?.data?.token || r.json?.token || null;
  return { ...r, token };
}

// === STUB 3: fetch attendance with the Bearer token =======================
// Replace with the real attendance endpoint. Return the raw json; the frontend
// normalizes it (see client/src/lib/attendance.ts::normalize).
export async function getAttendance(token) {
  return cv("/attendance/student/detail", { method: "GET", token });
}
