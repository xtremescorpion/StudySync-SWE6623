import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { ErrorBanner, Loading, Empty } from "../App.jsx";

/* FR 06-10: add, edit, archive, list and delete courses. */
export default function Courses() {
  const [courses, setCourses] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState({ code: "", title: "", semester: "Fall 2026" });
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);

  const load = () =>
    api
      .get(`/courses${showArchived ? "?all=true" : ""}`)
      .then((d) => setCourses(d.courses))
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function add(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/courses", form);           // FR 06
      setForm({ code: "", title: "", semester: form.semester });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveEdit(courseId, fields) {
    setError(null);
    try {
      await api.patch(`/courses/${courseId}`, fields);   // FR 07
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function archive(c) {
    try {
      await api.post(`/courses/${c.courseId}/archive`, { archived: !c.isArchived }); // FR 08
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(c) {
    if (!confirm(`Delete ${c.code} and every assignment filed under it?`)) return;
    try {
      await api.del(`/courses/${c.courseId}`);     // FR 10
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <h2>Courses</h2>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <section className="card">
        <h3>Add a course</h3>
        <form className="row" onSubmit={add}>
          <input placeholder="Code (SWE 6623)" value={form.code} onChange={set("code")} required />
          <input
            placeholder="Title"
            value={form.title}
            onChange={set("title")}
            required
            style={{ flex: 2 }}
          />
          <input placeholder="Semester" value={form.semester} onChange={set("semester")} required />
          <button className="primary">Add</button>
        </form>
      </section>

      <label className="toggle">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        Show archived courses
      </label>

      {courses === null ? (
        <Loading />
      ) : courses.length === 0 ? (
        <Empty>No courses yet. Add your first one above.</Empty>
      ) : (
        <table className="card">
          <thead>
            <tr>
              <th>Code</th>
              <th>Title</th>
              <th>Semester</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {courses.map((c) =>
              editing === c.courseId ? (
                <EditRow
                  key={c.courseId}
                  course={c}
                  onCancel={() => setEditing(null)}
                  onSave={(fields) => saveEdit(c.courseId, fields)}
                />
              ) : (
                <tr key={c.courseId} className={c.isArchived ? "dim" : ""}>
                  <td><strong>{c.code}</strong></td>
                  <td>
                    {c.title}
                    {c.isArchived && <span className="pill">archived</span>}
                  </td>
                  <td className="muted">{c.semester}</td>
                  <td className="actions">
                    <button className="link" onClick={() => setEditing(c.courseId)}>edit</button>
                    <button className="link" onClick={() => archive(c)}>
                      {c.isArchived ? "restore" : "archive"}
                    </button>
                    <button className="link danger" onClick={() => remove(c)}>delete</button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}
    </>
  );
}

function EditRow({ course, onSave, onCancel }) {
  const [f, setF] = useState({
    code: course.code,
    title: course.title,
    semester: course.semester,
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <tr>
      <td><input value={f.code} onChange={set("code")} /></td>
      <td><input value={f.title} onChange={set("title")} /></td>
      <td><input value={f.semester} onChange={set("semester")} /></td>
      <td className="actions">
        <button className="link" onClick={() => onSave(f)}>save</button>
        <button className="link" onClick={onCancel}>cancel</button>
      </td>
    </tr>
  );
}
