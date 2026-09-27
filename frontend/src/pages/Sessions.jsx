import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, ApiError } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Alert from "../components/Alert.jsx";
import Icon from "../components/Icon.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { TableSkeleton } from "../components/Spinner.jsx";
import { useToast } from "../components/Toast.jsx";

const formatDate = (value) => (value ? new Date(value).toLocaleString() : "-");

export const Sessions = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const payload = await auth.sessions();
      setRows(payload.data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load sessions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const revokeAll = async () => {
    setBusy(true);
    try {
      await auth.logoutAll();
      await signOut();
      toast.success("Signed out everywhere", "All devices have been signed out.");
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign out of all devices.");
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Active sessions</h1>
          <p className="page__subtitle">Every device currently holding a valid refresh token.</p>
        </div>
        <div className="page__actions">
          <button
            type="button"
            className="btn btn--danger"
            onClick={revokeAll}
            disabled={busy || rows.length === 0 || loading}
          >
            <Icon name="logout" size={15} />
            {busy ? "Signing out..." : "Sign out everywhere"}
          </button>
        </div>
      </header>

      {error ? <Alert tone="error" onDismiss={() => setError(null)}>{error}</Alert> : null}

      <div className="panel panel--flush">
        {loading ? (
          <TableSkeleton rows={3} cols={4} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="shield"
            title="No active sessions"
            text="Once you sign in from a device it will appear here so you can spot anything unfamiliar."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>IP address</th>
                  <th>Signed in</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="table__truncate" title={row.userAgent ?? ""}>
                      <span className="row" style={{ gap: 8 }}>
                        <Icon name="monitor" size={15} className="muted" />
                        {row.userAgent ?? "Unknown device"}
                      </span>
                    </td>
                    <td className="table__mono">{row.ip ?? "-"}</td>
                    <td className="tabular">{formatDate(row.CreatedAt)}</td>
                    <td className="tabular">{formatDate(row.expiresAt)}</td>
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

export default Sessions;
