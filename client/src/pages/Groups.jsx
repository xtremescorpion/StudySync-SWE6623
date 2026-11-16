import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { ErrorBanner, Loading, Empty } from "../App.jsx";
import { Due } from "./Dashboard.jsx";

/* FR 24-29: study groups, members, invitations, group tasks, progress. */
export default function Groups() {
  const [groups, setGroups] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState(null);
  const [newGroup, setNewGroup] = useState({ name: "", description: "" });

  const load = async () => {
    try {
      const [{ groups }, { invitations }] = await Promise.all([
        api.get("/groups"),
        api.get("/groups/invitations/mine"),
      ]);
      setGroups(groups);
      setInvitations(invitations);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = (fn) => async (...a) => {
    setError(null);
    try {
      await fn(...a);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const create = act(async (e) => {
    e.preventDefault();
    await api.post("/groups", newGroup);          // FR 24
    setNewGroup({ name: "", description: "" });
  });
  const accept = act((id) => api.post(`/groups/invitations/${id}/accept`));   // FR 27
  const decline = act((id) => api.post(`/groups/invitations/${id}/decline`)); // FR 27

  const pending = invitations.filter((i) => i.status === "pending");

  return (
    <>
      <h2>Study groups</h2>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {pending.length > 0 && (
        <section className="card highlight">
          <h3>Invitations waiting for you</h3>
          {pending.map((i) => (
            <div className="row between" key={i.inviteId}>
              <span>
                Group #{i.groupId} · expires {new Date(i.expiresOn).toDateString()}
              </span>
              <div className="actions">
                <button className="primary" onClick={() => accept(i.inviteId)}>Accept</button>
                <button onClick={() => decline(i.inviteId)}>Decline</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <h3>Create a group</h3>
        <form className="row" onSubmit={create}>
          <input
            placeholder="Group name" required
            value={newGroup.name}
            onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
          />
          <input
            placeholder="What is it for?" style={{ flex: 2 }}
            value={newGroup.description}
            onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
          />
          <button className="primary">Create</button>
        </form>
        <p className="hint">Name your group, then invite classmates. You'll be its owner.</p>
      </section>

      {groups === null ? (
        <Loading />
      ) : groups.length === 0 ? (
        <Empty>You are not in any study groups yet.</Empty>
      ) : (
        groups.map((g) => (
          <GroupCard
            key={g.groupId}
            group={g}
            expanded={open === g.groupId}
            onToggle={() => setOpen(open === g.groupId ? null : g.groupId)}
            onError={setError}
          />
        ))
      )}
    </>
  );
}

function GroupCard({ group, expanded, onToggle, onError }) {
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [progress, setProgress] = useState(null);
  const [invite, setInvite] = useState("");
  const [task, setTask] = useState({ title: "", dueDate: "", assigneeId: "" });
  const isOwner = group.myRole === "owner";

  const load = async () => {
    try {
      const [m, t, p] = await Promise.all([
        api.get(`/groups/${group.groupId}/members`),
        api.get(`/groups/${group.groupId}/tasks`),
        api.get(`/groups/${group.groupId}/progress`),
      ]);
      setMembers(m.members);
      setTasks(t.tasks);
      setProgress(p.progress);
    } catch (e) {
      onError(e.message);
    }
  };

  useEffect(() => {
    if (expanded) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const act = (fn) => async (...a) => {
    try {
      await fn(...a);
      await load();
    } catch (e) {
      onError(e.message);
    }
  };

  const sendInvite = act(async (e) => {
    e.preventDefault();
    await api.post(`/groups/${group.groupId}/invitations`, { recipientEmail: invite }); // FR 26
    setInvite("");
  });
  const addTask = act(async (e) => {
    e.preventDefault();
    await api.post(`/groups/${group.groupId}/tasks`, {                                   // FR 28
      ...task,
      assigneeId: task.assigneeId || undefined,
    });
    setTask({ title: "", dueDate: "", assigneeId: "" });
  });
  const removeMember = act((id) => api.del(`/groups/${group.groupId}/members/${id}`));   // FR 24

  return (
    <section className="card">
      <div className="row between">
        <h3 onClick={onToggle} style={{ cursor: "pointer" }}>
          {expanded ? "▾" : "▸"} {group.name}
          <span className="pill">{group.myRole}</span>
        </h3>
        {progress && (
          <span className="muted">
            {progress.completedTasks}/{progress.totalTasks} tasks · {progress.percentComplete}%
          </span>
        )}
      </div>
      {group.description && <p className="muted">{group.description}</p>}

      {expanded && (
        <>
          {progress && (
            <div className="bar" title={`${progress.percentComplete}% complete`}>
              <div style={{ width: `${progress.percentComplete}%` }} />
            </div>
          )}

          <h4>Members</h4>
          <table>
            <thead>
              <tr><th>Member</th><th>Role</th><th>Assigned</th><th>Done</th><th /></tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const row = progress?.byMember.find((b) => b.membershipId === m.membershipId);
                return (
                  <tr key={m.membershipId}>
                    <td>User #{m.userId}</td>
                    <td>{m.role}</td>
                    <td>{row?.assigned ?? 0}</td>
                    <td>{row?.completed ?? 0}</td>
                    <td className="actions">
                      {isOwner && (
                        <button className="link danger" onClick={() => removeMember(m.membershipId)}>
                          remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {isOwner && (
            <>
              <h4>Invite someone</h4>
              <form className="row" onSubmit={sendInvite}>
                <input
                  type="email" required placeholder="their.email@students.kennesaw.edu"
                  value={invite} onChange={(e) => setInvite(e.target.value)} style={{ flex: 2 }}
                />
                <button className="primary">Send invitation</button>
              </form>
              <p className="hint">
                Only owners can invite. Invitations appear in the recipient's Invitations list.
              </p>
            </>
          )}

          <h4>Group tasks</h4>
          <form className="row" onSubmit={addTask}>
            <input
              placeholder="Task" required style={{ flex: 2 }}
              value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })}
            />
            <input
              type="date" required
              value={task.dueDate} onChange={(e) => setTask({ ...task, dueDate: e.target.value })}
            />
            <select
              value={task.assigneeId}
              onChange={(e) => setTask({ ...task, assigneeId: e.target.value })}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.membershipId} value={m.membershipId}>User #{m.userId}</option>
              ))}
            </select>
            <button className="primary">Add</button>
          </form>

          {tasks.length === 0 ? (
            <Empty>No group tasks yet.</Empty>
          ) : (
            <table>
              <thead>
                <tr><th>Task</th><th>Due</th><th>Assigned to</th><th>Status</th></tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.taskId}>
                    <td>{t.title}</td>
                    <td><Due days={t.daysRemaining} /></td>
                    <td className="muted">
                      {t.assigneeId
                        ? `User #${members.find((m) => m.membershipId === t.assigneeId)?.userId ?? "?"}`
                        : "unassigned"}
                    </td>
                    <td>{t.status.replace("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}
