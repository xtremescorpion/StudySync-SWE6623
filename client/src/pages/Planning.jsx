import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { ErrorBanner, Loading, Empty } from "../App.jsx";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* FR 16-20 and FR 34: availability, the generated plan, sessions, calendar export. */
export default function Planning() {
  const [slots, setSlots] = useState(null);
  const [weeklyHours, setWeeklyHours] = useState(0);
  const [sessions, setSessions] = useState([]);
  const [plan, setPlan] = useState(null);
  const [scope, setScope] = useState("week");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [slot, setSlot] = useState({ dayOfWeek: "Mon", startTime: "18:00", endTime: "21:00" });

  const loadAvailability = () =>
    api.get("/planning/availability").then((d) => {
      setSlots(d.slots);
      setWeeklyHours(d.weeklyHours);
    });

  const loadPlan = (s = scope) =>
    api.get(`/planning/plan?scope=${s}`).then((d) => {
      setPlan(d.plan);
      setSessions(d.sessions);
    });

  useEffect(() => {
    Promise.all([loadAvailability(), loadPlan()]).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k) => (e) => setSlot({ ...slot, [k]: e.target.value });

  async function addSlot(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/planning/availability", slot);   // FR 16
      await loadAvailability();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeSlot(slotId) {
    try {
      await api.del(`/planning/availability/${slotId}`);
      await loadAvailability();
    } catch (err) {
      setError(err.message);
    }
  }

  async function generate(adjust = false) {
    setBusy(true);
    setError(null);
    try {
      await api.post(adjust ? "/planning/plan/adjust" : "/planning/plan/generate"); // FR 17, 18
      await loadPlan();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function complete(sessionId) {
    try {
      await api.post(`/planning/sessions/${sessionId}/complete`);   // FR 20
      await loadPlan();
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeScope(s) {
    setScope(s);
    try {
      await loadPlan(s);                                            // FR 19
    } catch (err) {
      setError(err.message);
    }
  }

  const byDay = {};
  for (const s of sessions) {
    const key = new Date(s.startTime).toDateString();
    (byDay[key] ||= []).push(s);
  }

  return (
    <>
      <h2>Study plan</h2>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <section className="card">
        <h3>When are you free to study?</h3>
        <p className="hint">
          Set the times you're regularly free. Total: <strong>{weeklyHours}h</strong> a week.
        </p>
        <form className="row" onSubmit={addSlot}>
          <select value={slot.dayOfWeek} onChange={set("dayOfWeek")}>
            {DAYS.map((d) => <option key={d}>{d}</option>)}
          </select>
          <input type="time" value={slot.startTime} onChange={set("startTime")} required />
          <input type="time" value={slot.endTime} onChange={set("endTime")} required />
          <button className="primary">Add slot</button>
        </form>

        {slots === null ? (
          <Loading />
        ) : slots.length === 0 ? (
          <Empty>No availability declared yet.</Empty>
        ) : (
          <div className="chips">
            {DAYS.flatMap((d) =>
              slots
                .filter((s) => s.dayOfWeek === d)
                .map((s) => (
                  <span className="chip" key={s.slotId}>
                    {s.dayOfWeek} {s.startTime} to {s.endTime}
                    <button className="x" onClick={() => removeSlot(s.slotId)} title="Remove">×</button>
                  </span>
                ))
            )}
          </div>
        )}
      </section>

      <section className="card">
        <div className="row between">
          <h3>Your schedule</h3>
          <div className="actions">
            <select value={scope} onChange={(e) => changeScope(e.target.value)}>
              <option value="day">Today</option>
              <option value="week">This week</option>
              <option value="all">Everything</option>
            </select>
            <button className="primary" onClick={() => generate(false)} disabled={busy}>
              {busy ? "Working…" : plan ? "Regenerate" : "Generate plan"}
            </button>
            {plan && (
              <button onClick={() => generate(true)} disabled={busy}>Adjust</button>
            )}
            <button onClick={() => api.downloadCalendar().catch((e) => setError(e.message))}>
              Export .ics
            </button>
          </div>
        </div>

        <p className="hint">
          Built from your assignments and the time you have free.
        </p>

        {!plan ? (
          <Empty>No plan yet. Add some availability and assignments, then generate one.</Empty>
        ) : sessions.length === 0 ? (
          <Empty>Nothing scheduled in this range.</Empty>
        ) : (
          Object.entries(byDay).map(([dayLabel, list]) => (
            <div key={dayLabel} className="dayblock">
              <h4>{dayLabel}</h4>
              {list.map((s) => (
                <div key={s.sessionId} className={`session ${s.isCompleted ? "done" : ""}`}>
                  <span className="time">
                    {new Date(s.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {" to "}
                    {new Date(s.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="what">Assignment #{s.assignmentId}</span>
                  {s.isCompleted ? (
                    <span className="pill done">done</span>
                  ) : (
                    <button className="link" onClick={() => complete(s.sessionId)}>
                      mark complete
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </section>
    </>
  );
}
