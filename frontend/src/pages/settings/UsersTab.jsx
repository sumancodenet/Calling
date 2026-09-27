import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { auth, ApiError } from "../../lib/api.js";
import Icon from "../../components/Icon.jsx";
import Alert from "../../components/Alert.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { TableSkeleton } from "../../components/Spinner.jsx";

const ROLES = ["", "ADMIN", "SUBADMIN", "AGENT"];

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : "Never");

const initialsOf = (name) =>
  (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const UsersTab = () => {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (params) => {
    setLoading(true);
    try {
      const payload = await auth.listUsers(params);
      setRows(payload.data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce the search so each keystroke does not hit the API.
  useEffect(() => {
    const timer = setTimeout(() => load({ q: search.trim(), role: role || undefined }), 300);
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
          <Link className="btn btn--primary btn--sm" to="/team">
            <Icon name="plus" size={15} />
            Add user
          </Link>
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
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last login</th>
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
                          <span className="cell-user__mail">{user.email ?? "No email"}</span>
                        </span>
                      </span>
                    </td>
                    <td className="table__mono">{user.userName}</td>
                    <td>
                      <span className="badge badge--neutral">{user.role}</span>
                    </td>
                    <td>
                      <span className={user.Status === "ACTIVE" ? "badge badge--ok" : "badge badge--neutral"}>
                        <span className="badge__dot" aria-hidden="true" />
                        {user.Status}
                      </span>
                    </td>
                    <td className="tabular">{formatDate(user.lastLogin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersTab;
