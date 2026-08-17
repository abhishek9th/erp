// Thin client for our own Node proxy (NOT CyberVidya directly).
const PROXY = import.meta.env.VITE_PROXY_URL || "http://localhost:8787";

export interface LoginResult {
  ok: boolean;
  otpRequired?: boolean;
  message?: string;
  context?: unknown;
}

export async function login(userName: string, password: string): Promise<LoginResult> {
  const r = await fetch(`${PROXY}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName, password }),
  });
  return r.json();
}

export async function verifyOtp(
  userName: string,
  otp: string,
  context: unknown
): Promise<{ ok: boolean; sid?: string; message?: string }> {
  const r = await fetch(`${PROXY}/api/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName, otp, context }),
  });
  return r.json();
}

export async function fetchAttendance(sid: string): Promise<unknown> {
  const r = await fetch(`${PROXY}/api/attendance`, {
    headers: { "x-session-id": sid },
  });
  if (!r.ok) throw new Error((await r.json())?.error || "failed to load attendance");
  return r.json();
}
