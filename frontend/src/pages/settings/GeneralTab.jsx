import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useTheme } from "../../hooks/useTheme.js";
import { auth, ApiError } from "../../lib/api.js";
import Icon from "../../components/Icon.jsx";
import Alert from "../../components/Alert.jsx";
import { Skeleton } from "../../components/Spinner.jsx";

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "System", icon: "monitor" },
];

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Never";

const initialsOf = (name) =>
  (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const GeneralTab = () => {
  const { user } = useAuth();
  const { preference, setPreference } = useTheme();

  const [profile, setProfile] = useState(null);
  const [deviceCount, setDeviceCount] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    auth
      .me()
      .then((payload) => {
        if (active) setProfile(payload.data);
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : "Could not load your profile.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    auth
      .sessions()
      .then((payload) => {
        if (active) setDeviceCount(payload.data.length);
      })
      .catch(() => {
        // Non-critical for this panel.
      });

    return () => {
      active = false;
    };
  }, []);

  const me = profile ?? user;
  const displayName = me?.fullName?.trim() || me?.userName || "-";

  return (
    <>
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="columns">
        <div className="stack stack--lg">
          <section className="panel">
            <div className="panel__head">
              <div>
                <h2 className="panel__title">Profile</h2>
                <p className="panel__desc">How you appear inside this workspace.</p>
              </div>
              <Icon name="user" size={18} className="muted" />
            </div>

            <div className="identity" style={{ marginBottom: 20 }}>
              <span className="avatar avatar--lg" aria-hidden="true">
                {initialsOf(displayName)}
              </span>
              <div className="identity__text">
                <span className="identity__name">{displayName}</span>
                <span className="identity__meta">
                  {me?.role} &middot; {me?.tenant?.name}
                </span>
              </div>
              <span className="badge badge--ok">
                <span className="badge__dot" aria-hidden="true" />
                {me?.status}
              </span>
            </div>

            <dl className="details">
              <div className="details__row">
                <dt>Username</dt>
                <dd>{me?.userName}</dd>
              </div>
              <div className="details__row">
                <dt>User ID</dt>
                <dd className="table__mono">{me?.userId}</dd>
              </div>
              <div className="details__row">
                <dt>Email</dt>
                <dd>{me?.email ?? <span className="muted">Not set</span>}</dd>
              </div>
              <div className="details__row">
                <dt>Phone</dt>
                <dd>{me?.phone ?? <span className="muted">Not set</span>}</dd>
              </div>
            </dl>

            <div className="notice" style={{ marginTop: 20 }}>
              <Icon name="info" size={15} />
              <span>
                Editing your profile needs a <code>PATCH /api/auth/me</code> endpoint, which does not exist yet. Ask a
                workspace admin to change your name, email or role.
              </span>
            </div>
          </section>

          <section className="panel">
            <div className="panel__head">
              <div>
                <h2 className="panel__title">Security</h2>
                <p className="panel__desc">Sessions and sign-in activity.</p>
              </div>
              <Icon name="shield" size={18} className="muted" />
            </div>

            <div className="security">
              <div className="security__row">
                <span className="muted">Active sessions</span>
                {deviceCount === null ? (
                  <Skeleton width={44} height={14} />
                ) : (
                  <span className="security__value tabular">
                    {deviceCount} {deviceCount === 1 ? "device" : "devices"}
                  </span>
                )}
              </div>
              <div className="security__row">
                <span className="muted">Last sign in</span>
                <span className="security__value">{formatDateTime(me?.lastLogin)}</span>
              </div>
              <div className="security__row">
                <span className="muted">Password</span>
                <span className="security__value">
                  {me?.isReset ? "Reset required on next sign in" : "Up to date"}
                </span>
              </div>
            </div>

            <Link className="btn btn--secondary btn--block" to="/sessions" style={{ marginTop: 20 }}>
              <Icon name="monitor" size={15} />
              Manage active sessions
            </Link>

            <div className="notice" style={{ marginTop: 16 }}>
              <Icon name="info" size={15} />
              <span>Changing your password and two-factor enrolment are not built yet.</span>
            </div>
          </section>
        </div>

        <div className="stack stack--lg">
          <section className="panel">
            <div className="panel__head">
              <div>
                <h2 className="panel__title">Appearance</h2>
                <p className="panel__desc">Applies to this browser only.</p>
              </div>
              <Icon name="palette" size={18} className="muted" />
            </div>

            <div className="segmented" role="radiogroup" aria-label="Theme">
              {THEME_OPTIONS.map((option) => {
                const active = preference === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={active ? "segmented__item segmented__item--active" : "segmented__item"}
                    onClick={() => setPreference(option.value)}
                  >
                    <Icon name={option.icon} size={15} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <div className="panel__head">
              <div>
                <h2 className="panel__title">Workspace</h2>
                <p className="panel__desc">Read-only in this build.</p>
              </div>
              <Icon name="building" size={18} className="muted" />
            </div>

            <div className="security">
              <div className="security__row">
                <span className="muted">Name</span>
                <span className="security__value">{me?.tenant?.name}</span>
              </div>
              <div className="security__row">
                <span className="muted">Slug</span>
                <span className="security__value table__mono">/{me?.tenant?.slug}</span>
              </div>
              <div className="security__row">
                <span className="muted">Plan</span>
                <span className="security__value">
                  <span className="badge badge--brand">{me?.tenant?.plan}</span>
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default GeneralTab;
