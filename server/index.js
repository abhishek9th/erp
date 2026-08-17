// Express proxy between the React dashboard and kiet.cybervidya.net.
// Holds the AES key + the Bearer token so the frontend never sees either.
import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { login, verifyOtp, getAttendance } from "./cybervidya.js";

const app = express();
app.use(cors()); // dev: allow the Vite origin
app.use(express.json());

const PORT = process.env.PORT || 8787;

// 1) username + password  ->  triggers the email OTP
app.post("/api/login", async (req, res) => {
  const { userName, password } = req.body || {};
  if (!userName || !password) {
    return res.status(400).json({ error: "userName and password required" });
  }
  try {
    const r = await login(userName, password);
    // Pass through whatever context the OTP step needs (txn id, etc.)
    res.status(r.ok ? 200 : r.status).json({
      ok: r.ok,
      otpRequired: r.ok,
      message: r.json?.message || r.json?.error?.reason,
      context: r.json?.data ?? null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2) otp code  ->  returns nothing to the client except "logged in";
//    the Bearer token is kept server-side, keyed by a short-lived session id.
const sessions = new Map(); // sid -> { token, ts }

app.post("/api/verify-otp", async (req, res) => {
  const { userName, otp, context } = req.body || {};
  if (!userName || !otp) {
    return res.status(400).json({ error: "userName and otp required" });
  }
  try {
    const r = await verifyOtp(userName, otp, context || {});
    if (!r.token) {
      return res
        .status(r.status || 401)
        .json({ ok: false, message: r.json?.error?.reason || "OTP failed" });
    }
    const sid = randomUUID();
    sessions.set(sid, { token: r.token, ts: Date.now() });
    res.json({ ok: true, sid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3) attendance for a logged-in session
app.get("/api/attendance", async (req, res) => {
  const sid = req.header("x-session-id");
  const session = sid && sessions.get(sid);
  if (!session) return res.status(401).json({ error: "not logged in" });
  try {
    const r = await getAttendance(session.token);
    res.status(r.ok ? 200 : r.status).json(r.json);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// drop sessions older than 6h
setInterval(() => {
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  for (const [sid, s] of sessions) if (s.ts < cutoff) sessions.delete(sid);
}, 30 * 60 * 1000);

app.listen(PORT, () => console.log(`proxy on http://localhost:${PORT}`));
