import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { ErrorBanner, Loading, Empty } from "../App.jsx";
import { Score, Due } from "./Dashboard.jsx";

/* FR 11-15 and FR 23: assignments, their effort and weight, status and priority. */
export default function Assignments() {
  const [courses, setCourses] = useState([]);
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    courseId: "", title: "", dueDate: "", estimatedHours: 2, gradeWeight: 10,
  });

  const load = async () => {
    try {
      const [{ courses }, { tasks }] = await Promise.all([
        api.get("/courses"),
        api.get("/priority"),      // already ranked (FR 21)
      ]);
      setCourses(courses);
      const { assignments } = await api.get("/assignments");
      const rank = new Map(tasks.map((t, i) => [t.taskId, i]));
      setItems(
        assignments.sort(
          (a, b) => (rank.get(a.taskId) ?? 999) - (rank.get(b.taskId) ?? 999)
        )
      );
      if (!form.courseId && courses.length) setForm((f) => ({ ...f, courseId: courses[0].courseId }));
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function add(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/assignments", {           // FR 11, 13, 14
        ...form,
        courseId: Number(form.courseId),
        estimatedHours: Number(form.estimatedHours),
        gradeWeight: Number(form.gradeWeight),
      });
      setForm({ ...form, title: "", dueDate: "" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const act = (fn) => async (...args) => {
    setError(null);
    try {
      await fn(...args);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const setStatus = act((id, status) => api.patch(`/assignments/${id}/status`, { status }));
  const setEffort = act((id, h) => api.patch(`/assignments/${id}/effort`, { estimatedHours: Number(h) }));
  const setWeight = act((id, w) => api.patch(`/assignments/${id}/weight`, { gradeWeight: Number(w) }));
  const override = act((id, score) => api.put(`/priority/${id}`, { score: Number(score) }));
  const clearOverride = act((id) => api.del(`/priority/${id}`));
  const remove = act((id) => api.del(`/assignments/${id}`));

  const codeOf = (courseId) =>
    courses.find((c) => c.courseId === courseId)?.code || "-";

  const shown = (items || []).filter(
    (a) => !filter || String(a.courseId) === filter
  );

  return (
    <>
      <h2>Assignments</h2>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <section className="card">
        <h3>Add an assignment</h3>
        {courses.length === 0 ? (
          <Empty>Add a course first. Every assignment belongs to one.</Empty>
        ) : (
          <form className="row" onSubmit={add}>
            <select value={form.courseId} onChange={set("courseId")} required>
              {courses.map((c) => (
                <option key={c.courseId} value={c.courseId}>{c.code}</option>
              ))}
            </select>
            <input
              placeholder="Title"
              value={form.title}
              onChange={set("title")}
              required
              style={{ flex: 2 }}
            />
            <input type="date" value={form.dueDate} onChange={set("dueDate")} required />
            <input
              type="number" min="0" step="0.5" title="Estimated hours"
              value={form.estimatedHours} onChange={set("estimatedHours")} style={{ width: 90 }}
            />
            <input
              type="number" min="0" max="100" title="Grade weight %"
              value={form.gradeWeight} onChange={set("gradeWeight")} style={{ width: 90 }}
            />
            <button className="primary">Add</button>
          </form>
        )}
        <p className="hint">Hours is how long you think it will take. Weight is its share of the course grade.</p>
      </section>

      {courses.length > 0 && (
        <select className="filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c.courseId} value={c.courseId}>{c.code}</option>
          ))}
        </select>
      )}

      {items === null ? (
        <Loading />
      ) : shown.length === 0 ? (
        <Empty>Nothing here yet.</Empty>
      ) : (
        <table className="card">
          <thead>
            <tr>
              <th>Priority</th>
              <th>Assignment</th>
              <th>Course</th>
              <th>Due</th>
              <th>Hours</th>
              <th>Weight</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((a) => (
              <tr key={a.taskId} className={a.status === "completed" ? "dim" : ""}>
                <td>
                  <Score value={a.priorityScore} />
                  {a.priorityOverridden && <span className="pill">manual</span>}
                </td>
                <td>{a.title}</td>
                <td className="muted">{codeOf(a.courseId)}</td>
                <td><Due days={a.daysRemaining} /></td>
                <td>
                  <input
                    className="mini" type="number" min="0" step="0.5"
                    defaultValue={a.estimatedHours}
                    onBlur={(e) =>
                      Number(e.target.value) !== a.estimatedHours &&
                      setEffort(a.taskId, e.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    className="mini" type="number" min="0" max="100"
                    defaultValue={a.gradeWeight}
                    onBlur={(e) =>
                      Number(e.target.value) !== a.gradeWeight &&
                      setWeight(a.taskId, e.target.value)
                    }
                  />
                </td>
                <td>
                  <select
                    value={a.status}
                    onChange={(e) => setStatus(a.taskId, e.target.value)}
                  >
                    <option value="not_started">Not started</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </td>
                <td className="actions">
                  {a.priorityOverridden ? (
                    <button
                      className="link"
                      title="Let the planner decide"
                      onClick={() => clearOverride(a.taskId)}
                    >
                      auto
                    </button>
                  ) : (
                    <button
                      className="link"
                      title="Set the priority yourself"
                      onClick={() => {
                        const v = prompt("Set priority by hand (0-100):", Math.round(a.priorityScore));
                        if (v !== null) override(a.taskId, v);
                      }}
                    >
                      pin
                    </button>
                  )}
                  <button className="link danger" onClick={() => remove(a.taskId)}>delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
