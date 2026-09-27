import { useCallback, useEffect, useRef, useState } from "react";
import { auth, ApiError } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Icon from "../components/Icon.jsx";
import Alert from "../components/Alert.jsx";
import EmptyState from "../components/EmptyState.jsx";
import AddUsersModal from "../components/AddUsersModal.jsx";
import UserRowActions from "../components/UserRowActions.jsx";
import { TableSkeleton } from "../components/Spinner.jsx";

const initialsOf = (name) =>
  (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const Team = () => {
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.id;
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  // Guards against out-of-order list responses overwriting fresher state.
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const payload = await auth.listUsers();
      if (seq !== requestSeq.current) return;
      setRows(payload.data);
      setError(null);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err instanceof ApiError ? err.message : "Could not load the team.");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Team</h1>
          <p className="page__subtitle">Everyone working in this workspace.</p>
        </div>
        <div className="page__actions">
          <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} />
            Add users
          </button>
        </div>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="panel panel--flush">
        {loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="users"
            title="No users yet"
            text="Add the first members of this workspace to get started."
            action={
              <button type="button" className="btn btn--primary" onClick={() => setAdding(true)} style={{ marginTop: 8 }}>
                <Icon name="plus" size={16} />
                Add users
              </button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table table--wide">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Employee ID</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <span className="row" style={{ gap: 10 }}>
                        <span className="avatar avatar--sm">{initialsOf(user.fullName)}</span>
                        <span className="cell-user">
                          <span className="cell-user__name">{user.fullName}</span>
                          <span className="cell-user__mail">{user.userName}</span>
                        </span>
                      </span>
                    </td>
                    <td className="tabular">{user.phone ?? <span className="muted">-</span>}</td>
                    <td className="cell-clip" title={user.email ?? ""}>
                      {user.email ?? <span className="muted">-</span>}
                    </td>
                    <td className="table__mono">{user.employeeId ?? <span className="muted">-</span>}</td>
                    <td>
                      <span className="badge badge--neutral">{user.role}</span>
                    </td>
                    <td>
                      <span className={user.Status === "ACTIVE" ? "badge badge--ok" : "badge badge--neutral"}>
                        <span className="badge__dot" aria-hidden="true" />
                        {user.Status}
                      </span>
                    </td>
                    <td className="table__actions">
                      <UserRowActions user={user} currentUserId={currentUserId} onChanged={load} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddUsersModal open={adding} onClose={() => setAdding(false)} onCreated={load} />
    </div>
  );
};

export default Team;
