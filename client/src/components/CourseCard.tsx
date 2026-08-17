import type { CourseResult } from "../lib/attendance";

export function CourseCard({ result, highlight }: { result: CourseResult; highlight?: boolean }) {
  const pct = result.percent.toFixed(1);
  return (
    <div className={`card course ${highlight ? "highlight" : ""} ${result.safe ? "ok" : "bad"}`}>
      <div className="course-head">
        <span className="course-name">{result.course}</span>
        <span className="pct">{pct}%</span>
      </div>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${Math.min(100, result.percent)}%` }} />
        <div className="bar-mark" title="75% line" />
      </div>
      <div className="meta">
        {result.attended} / {result.total} classes
      </div>
      {result.safe ? (
        <div className="verdict good">
          You can skip <strong>{result.canSkip}</strong> more class{result.canSkip === 1 ? "" : "es"}.
        </div>
      ) : (
        <div className="verdict warn">
          Attend <strong>{result.mustAttend}</strong> more in a row to reach 75%.
        </div>
      )}
    </div>
  );
}
