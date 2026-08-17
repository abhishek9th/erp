// Pure attendance math + normalization of CyberVidya's response.
// Kept framework-free so it's trivially testable.

export const THRESHOLD = 0.75;

export interface CourseAttendance {
  course: string;
  attended: number;
  total: number;
}

export interface CourseResult extends CourseAttendance {
  percent: number; // 0..100
  /** How many *future* classes you can skip and stay >= threshold. */
  canSkip: number;
  /** If below threshold: classes you must attend in a row to reach it. 0 if already ok. */
  mustAttend: number;
  safe: boolean;
}

/** floor(attended / p - total) — never negative. */
export function classesCanSkip(attended: number, total: number, p = THRESHOLD): number {
  if (total === 0) return 0;
  return Math.max(0, Math.floor(attended / p - total));
}

/** ceil((p*total - attended) / (1 - p)) — 0 once you're at/above the threshold. */
export function classesMustAttend(attended: number, total: number, p = THRESHOLD): number {
  const needed = Math.ceil((p * total - attended) / (1 - p));
  return Math.max(0, needed);
}

export function evaluate(c: CourseAttendance, p = THRESHOLD): CourseResult {
  const percent = c.total === 0 ? 0 : (c.attended / c.total) * 100;
  const safe = percent >= p * 100;
  return {
    ...c,
    percent,
    safe,
    canSkip: safe ? classesCanSkip(c.attended, c.total, p) : 0,
    mustAttend: safe ? 0 : classesMustAttend(c.attended, c.total, p),
  };
}

export function overall(courses: CourseAttendance[], p = THRESHOLD): CourseResult {
  const attended = courses.reduce((s, c) => s + c.attended, 0);
  const total = courses.reduce((s, c) => s + c.total, 0);
  return evaluate({ course: "Overall", attended, total }, p);
}

// --- Normalize the ERP payload into CourseAttendance[] --------------------
// CyberVidya's exact JSON isn't finalized yet (STUB 3 in the proxy). This
// walks common shapes: an array of subjects each carrying present/total-ish
// fields under a variety of key names. Adjust once you have a real payload.
const PRESENT_KEYS = ["presentClasses", "present", "attended", "attendedClasses", "totalPresent"];
const TOTAL_KEYS = ["totalClasses", "total", "held", "deliveredClasses", "totalDelivered"];
const NAME_KEYS = ["courseName", "subject", "subjectName", "course", "name"];

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) if (obj[k] != null) return obj[k];
  return undefined;
}

export function normalize(raw: unknown): CourseAttendance[] {
  // Find the first array of objects anywhere in the payload.
  const list = findCourseArray(raw);
  return list
    .map((row) => {
      const attended = Number(pick(row, PRESENT_KEYS) ?? NaN);
      const total = Number(pick(row, TOTAL_KEYS) ?? NaN);
      const course = String(pick(row, NAME_KEYS) ?? "Course");
      return { course, attended, total };
    })
    .filter((c) => Number.isFinite(c.attended) && Number.isFinite(c.total) && c.total > 0);
}

function findCourseArray(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw) && raw.every((x) => typeof x === "object")) {
    return raw as Record<string, unknown>[];
  }
  if (raw && typeof raw === "object") {
    for (const v of Object.values(raw as Record<string, unknown>)) {
      const found = findCourseArray(v);
      if (found.length) return found;
    }
  }
  return [];
}
