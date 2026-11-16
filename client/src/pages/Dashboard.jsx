import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { ErrorBanner, Loading, Empty } from "../App.jsx";

/* FR 30, 33: the centralised dashboard. */
export default function Dashboard() {
  const [data, setData] = useState(null);
  const [chart, setChart] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.get("/dashboard"), api.get("/dashboard/chart?weeks=8")])
      .then(([d, c]) => {
        setData(d);
        setChart(c.chart);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBanner error={error} />;
  if (!data) return <Loading />;

  const { deadlines, workload, completion } = data;

  return (
    <>
      <h2>Dashboard</h2>

      <div className="stats">
        <Stat label="Open assignments" value={workload.openAssignments} />
        <Stat label="Hours outstanding" value={workload.hoursOutstanding} />
        <Stat label="Study hours a week" value={workload.weeklyStudyHours} />
        <Stat label="Completed" value={`${completion.percent}%`} />
      </div>

      {workload.weekIsFeasible === false && (
        <div className="warn">
          The work due in the next seven days needs {workload.hoursDueThisWeek} hours, but
          you have only {workload.weeklyStudyHours} hours declared as free. Consider adding
          availability or re-prioritising.
        </div>
      )}

      <section className="card">
        <h3>What to work on next</h3>
        <p className="hint">Most urgent first.</p>
        {deadlines.length === 0 ? (
          <Empty>No open assignments. Add one on the Assignments page.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Priority</th>
                <th>Assignment</th>
                <th>Course</th>
                <th>Due</th>
                <th>Effort</th>
                <th>Weight</th>
              </tr>
            </thead>
            <tbody>
              {deadlines.map((d) => (
                <tr key={d.taskId}>
                  <td>
                    <Score value={d.priorityScore} />
                  </td>
                  <td>{d.title}</td>
                  <td className="muted">{d.course}</td>
                  <td>
                    <Due days={d.daysRemaining} />
                  </td>
                  <td>{d.estimatedHours}h</td>
                  <td>{d.gradeWeight}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h3>Progress over the last eight weeks</h3>
        <BarChart data={chart} />
      </section>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

export function Score({ value }) {
  const band = value >= 70 ? "high" : value >= 45 ? "mid" : "low";
  return <span className={`score ${band}`}>{Math.round(value)}</span>;
}

export function Due({ days }) {
  if (days < 0) return <span className="due overdue">{Math.abs(days)}d overdue</span>;
  if (days === 0) return <span className="due overdue">today</span>;
  if (days <= 3) return <span className="due soon">in {days}d</span>;
  return <span className="due">in {days}d</span>;
}

/* Small inline chart. Plain SVG keeps the dependency list short. */
function BarChart({ data }) {
  if (!data.length) return <Empty>No history yet.</Empty>;
  const max = Math.max(1, ...data.map((d) => Math.max(d.created, d.completed)));
  const W = 560, H = 160, pad = 28;
  const bw = (W - pad * 2) / data.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img"
         aria-label="Tasks created and completed per week">
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#cbd2db" />
      {data.map((d, i) => {
        const x = pad + i * bw;
        const hC = ((H - pad * 2) * d.created) / max;
        const hD = ((H - pad * 2) * d.completed) / max;
        return (
          <g key={d.weekStarting}>
            <rect x={x + bw * 0.15} y={H - pad - hC} width={bw * 0.3} height={hC} fill="#9db4d8" />
            <rect x={x + bw * 0.52} y={H - pad - hD} width={bw * 0.3} height={hD} fill="#2f6f4f" />
            <text x={x + bw / 2} y={H - pad + 14} textAnchor="middle" fontSize="9" fill="#6b7585">
              {d.weekStarting.slice(5)}
            </text>
          </g>
        );
      })}
      <rect x={W - 150} y={8} width={10} height={10} fill="#9db4d8" />
      <text x={W - 135} y={17} fontSize="10" fill="#2b3445">created</text>
      <rect x={W - 78} y={8} width={10} height={10} fill="#2f6f4f" />
      <text x={W - 63} y={17} fontSize="10" fill="#2b3445">completed</text>
    </svg>
  );
}
