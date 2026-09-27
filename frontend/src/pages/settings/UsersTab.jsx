import { useCallback, useEffect, useRef, useState } from "react";
import { auth, ApiError } from "../../lib/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import Icon from "../../components/Icon.jsx";
import Alert from "../../components/Alert.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import AddUsersModal from "../../components/AddUsersModal.jsx";
import UserRowActions from "../../components/UserRowActions.jsx";
import { TableSkeleton } from "../../components/Spinner.jsx";

const ROLES = ["", "ADMIN", "SUBADMIN", "AGENT"];

const initialsOf = (name) =>
  (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const UsersTab = () => {
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.id;
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [params, setParams] = useState({ q: "", role: "" });
  // Guards against out-of-order responses: a slow list request that was fired
  // before a delete/edit must not overwrite fresher state when it lands.
  const requestSeq = useRef(0);

  const load = useCallback(async (query = {}) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const payload = await auth.listUsers({
        q: query.q || undefined,
        role: query.role || undefined,
      });
      if (seq !== requestSeq.current) return;
      setRows(payload.data);
      setError(null);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err instanceof ApiError ? err.message : "Could not load users.");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  // Remember the last query so row actions can refresh the current view.
  const reload = useCallback(() => load(params), [load, params]);

  // Debounce the search so each keystroke does not hit the API.
  useEffect(() => {
    const next = { q: search.trim(), role };
    setParams(next);
    const timer = setTimeout(() => load(next), 300);
    return () => clearTimeout(timer);
  }, [search, role, load]);

  return (
    <div className="stack stack--lg">
      <section className="panel">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Users</h2>
            <p className="panel__desc">Everyone with access to this workspace.</p>
          </div>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setAdding(true)}>
            <Icon name="plus" size={15} />
            Add user
          </button>
        </div>

        <div className="toolbar">
          <div className="input-affix toolbar__search">
            <span className="input-affix__icon">
              <Icon name="search" size={15} />
            </span>
            <input
              className="input"
              type="search"
              placeholder="Search name, username or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search users"
            />
          </div>

          <div className="chips" role="group" aria-label="Filter by role">
            {ROLES.map((option) => (
              <button
                key={option || "all"}
                type="button"
                className={role === option ? "chip chip--active" : "chip"}
                onClick={() => setRole(option)}
              >
                {option || "All roles"}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="panel panel--flush">
        {loading ? (
          <TableSkeleton rows={3} cols={5} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="users"
            title={search || role ? "No matching users" : "No users yet"}
            text={
              search || role
                ? "Try a different search term or clear the role filter."
                : "Add the first member of this workspace to get started."
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
                  <th>Password</th>
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
                    <td>
                      {user.IsReset ? (
                        <span className="badge badge--warning" title="Still the password an admin set - this person has not signed in yet">
                          Temporary
                        </span>
                      ) : (
                        <span className="badge badge--neutral" title="The password has been used at least once">
                          Set
                        </span>
                      )}
                    </td>
                    <td className="table__actions">
                      <UserRowActions user={user} currentUserId={currentUserId} onChanged={reload} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddUsersModal
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={() => load({ q: search.trim(), role: role || undefined })}
      />
    </div>
  );
};

export default UsersTab;
