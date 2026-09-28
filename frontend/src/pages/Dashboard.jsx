import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { auth, ApiError } from "../lib/api.js";
import Alert from "../components/Alert.jsx";
import Icon from "../components/Icon.jsx";
import { CardSkeleton, Skeleton } from "../components/Spinner.jsx";

const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "Never";

const initialsOf = (name) =>
  (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

const QUICK_LINKS = [
  { to: "/team", icon: "users", title: "Invite a teammate", text: "Add an agent to this workspace." },
  { to: "/sessions", icon: "shield", title: "Review sessions", text: "Check devices signed into your account." },
];

export const Dashboard = () => {
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [deviceCount, setDeviceCount] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    auth
      .me()
      .then((payload) => {
        if (active) setSession(payload.data);
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
        // Non-critical: the security card falls back to a dash.
      });

    return () => {
      active = false;
    };
  }, []);

  const profile = session ?? user;
  const displayName = profile?.fullName?.trim() || profile?.userName || "there";

  const stats = [
    { label: "Workspace", icon: "building", value: profile?.tenant?.name ?? "-" },
    { label: "Plan", icon: "layers", value: profile?.tenant?.plan ?? "-" },
    { label: "Role", icon: "user", value: profile?.role ?? "-" },
    { label: "Last sign in", icon: "clock", value: formatDateTime(profile?.lastLogin), small: true },
  ];

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Welcome back, {displayName}</h1>
          <p className="page__subtitle">Here is the state of your workspace today.</p>
        </div>
      </header>

      <div className="page__body">
        {error ? <Alert tone="error">{error}</Alert> : null}

        <div className="grid grid--4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
          : stats.map((stat) => (
              <div className="stat" key={stat.label}>
                <span className="stat__head">
                  <span className="stat__icon">
                    <Icon name={stat.icon} size={14} />
                  </span>
                  {stat.label}
                </span>
                <span className={stat.small ? "stat__value stat__value--sm" : "stat__value"}>{stat.value}</span>
                {stat.label === "Workspace" && profile?.tenant?.slug ? (
                  <span className="stat__meta">
                    <code>/{profile.tenant.slug}</code>
                  </span>
                ) : null}
              </div>
            ))}
      </div>

      <div className="columns">
        <section className="panel">
          <div className="identity">
            <span className="avatar avatar--lg" aria-hidden="true">
              {initialsOf(displayName)}
            </span>
            <div className="identity__text">
              <h2 className="identity__name">{displayName}</h2>
              <p className="identity__meta">
                {profile?.role} &middot; {profile?.tenant?.name}
              </p>
            </div>
            <span className="badge badge--ok">
              <span className="badge__dot" aria-hidden="true" />
              {profile?.status}
            </span>
          </div>

          <hr className="divider" />

          <dl className="details">
            <div className="details__row">
              <dt>User ID</dt>
              <dd className="table__mono">{profile?.userId}</dd>
            </div>
            <div className="details__row">
              <dt>Username</dt>
              <dd>{profile?.userName}</dd>
            </div>
            <div className="details__row">
              <dt>
                <span className="row" style={{ gap: 7 }}>
                  <Icon name="mail" size={14} /> Email
                </span>
              </dt>
              <dd>{profile?.email ?? <span className="muted">Not set</span>}</dd>
            </div>
            <div className="details__row">
              <dt>
                <span className="row" style={{ gap: 7 }}>
                  <Icon name="phone" size={14} /> Phone
                </span>
              </dt>
              <dd>{profile?.phone ?? <span className="muted">Not set</span>}</dd>
            </div>
            <div className="details__row">
              <dt>
                <span className="row" style={{ gap: 7 }}>
                  <Icon name="key" size={14} /> Password
                </span>
              </dt>
              <dd>{profile?.IsReset ? "Reset required on next sign in" : "Up to date"}</dd>
            </div>
          </dl>
        </section>

        <div className="stack stack--lg">
          <section className="panel">
            <div className="panel__head">
              <h2 className="panel__title">Sign-in &amp; security</h2>
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
                <span className="security__value">{formatDateTime(profile?.lastLogin)}</span>
              </div>
              <div className="security__row">
                <span className="muted">Workspace</span>
                <span className="security__value">
                  {profile?.tenant?.name} <span className="muted">({profile?.tenant?.plan})</span>
                </span>
              </div>
            </div>

            <Link className="btn btn--secondary btn--block" to="/sessions" style={{ marginTop: 20 }}>
              Manage sessions
            </Link>
          </section>

          <section className="panel">
            <div className="panel__head">
              <h2 className="panel__title">Quick actions</h2>
            </div>
            <div className="stack">
              {QUICK_LINKS.map((link) => (
                <Link className="quick" key={link.to} to={link.to}>
                  <span className="quick__icon">
                    <Icon name={link.icon} size={16} />
                  </span>
                  <span className="quick__text">
                    <span className="quick__title">{link.title}</span>
                    <span className="quick__desc">{link.text}</span>
                  </span>
                  <Icon name="chevronRight" size={15} className="quick__chev" />
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Dashboard;
