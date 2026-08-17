import { useState } from "react";
import { login, verifyOtp, fetchAttendance } from "./lib/api";
import { normalize, evaluate, overall, type CourseResult } from "./lib/attendance";
import { CourseCard } from "./components/CourseCard";

type Stage = "login" | "otp" | "loading" | "dashboard";

export default function App() {
  const [stage, setStage] = useState<Stage>("login");
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [context, setContext] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [results, setResults] = useState<CourseResult[]>([]);
  const [total, setTotal] = useState<CourseResult | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const r = await login(userName, password);
    if (r.ok && r.otpRequired) {
      setContext(r.context ?? null);
      setStage("otp");
    } else {
      setError(r.message || "Login failed");
    }
  }

  async function handleOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const r = await verifyOtp(userName, otp, context);
    if (!r.ok || !r.sid) {
      setError(r.message || "OTP verification failed");
      return;
    }
    setStage("loading");
    try {
      const raw = await fetchAttendance(r.sid);
      const courses = normalize(raw).map((c) => evaluate(c));
      setResults(courses);
      setTotal(overall(courses.map((c) => ({ course: c.course, attended: c.attended, total: c.total }))));
      setStage("dashboard");
    } catch (err) {
      setError((err as Error).message);
      setStage("otp");
    }
  }

  return (
    <div className="wrap">
      <header>
        <h1>KIET Attendance</h1>
        <p className="sub">Stay above 75% — know exactly where you stand.</p>
      </header>

      {error && <div className="error">{error}</div>}

      {stage === "login" && (
        <form className="card form" onSubmit={handleLogin}>
          <label>
            Username / Enrollment No.
            <input value={userName} onChange={(e) => setUserName(e.target.value)} autoFocus />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button type="submit">Send OTP</button>
          <p className="hint">An OTP will be sent to your registered email.</p>
        </form>
      )}

      {stage === "otp" && (
        <form className="card form" onSubmit={handleOtp}>
          <label>
            Enter the OTP sent to your email
            <input value={otp} onChange={(e) => setOtp(e.target.value)} autoFocus inputMode="numeric" />
          </label>
          <button type="submit">Verify &amp; Load</button>
        </form>
      )}

      {stage === "loading" && <div className="card">Loading your attendance…</div>}

      {stage === "dashboard" && (
        <>
          {total && <CourseCard result={total} highlight />}
          <div className="grid">
            {results.map((r) => (
              <CourseCard key={r.course} result={r} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
