import { useEffect, useState } from "react";
import { auth, ApiError } from "../../lib/api.js";
import Icon from "../../components/Icon.jsx";
import Alert from "../../components/Alert.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { Skeleton } from "../../components/Spinner.jsx";

const ROLE_ICON = { ADMIN: "key", SUBADMIN: "shield", AGENT: "user" };

export const RolesTab = () => {
  const [roles, setRoles] = useState([]);
  const [enforced, setEnforced] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    auth
      .listRoles()
      .then((payload) => {
        if (!active) return;
        setRoles(payload.data);
        setEnforced(payload.meta?.permissionsEnforced ?? false);
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : "Could not load roles.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="stack stack--lg">
      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <div className="role-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <div className="role" key={i}>
              <Skeleton width={40} height={40} style={{ borderRadius: 10 }} />
              <Skeleton width="55%" height={14} style={{ marginTop: 14 }} />
              <Skeleton width="90%" height={11} style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
      ) : roles.length === 0 ? (
        <div className="panel panel--flush">
          <EmptyState icon="key" title="No roles defined" text="The server role catalog is empty." />
        </div>
      ) : (
        <div className="role-grid">
          {roles.map((role) => (
            <section className="role" key={role.key}>
              <span className="role__icon">
                <Icon name={ROLE_ICON[role.key] ?? "key"} size={19} />
              </span>
              <h3 className="role__label">{role.label}</h3>
              <span className="role__key table__mono">{role.key}</span>
              <p className="role__desc">{role.description}</p>
            </section>
          ))}
        </div>
      )}

      <section className="panel">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Permissions</h2>
            <p className="panel__desc">How access is enforced today.</p>
          </div>
          <Icon name="shield" size={18} className="muted" />
        </div>

        <div className="notice">
          <Icon name="alert" size={15} />
          <span>
            {enforced === false ? (
              <>
                No permission checks are enforced yet. Every authenticated member of a workspace can read that
                workspace&rsquo;s users and pipeline. Authorisation is currently limited to tenant scoping, so role
                changes have no effect on access.
              </>
            ) : (
              "Role-based access control is enforced by the API."
            )}
          </span>
        </div>
      </section>
    </div>
  );
};

export default RolesTab;
