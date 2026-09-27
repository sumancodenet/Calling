import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { ApiError } from "../lib/api.js";
import Alert from "../components/Alert.jsx";
import Spinner from "../components/Spinner.jsx";
import Icon from "../components/Icon.jsx";
import { ThemeToggle } from "../components/ThemeToggle.jsx";

const FEATURES = [
  { icon: "zap", text: "Instant call dispositions and live pipeline movement" },
  { icon: "shield", text: "Workspace-isolated data with revocable sessions" },
  { icon: "trending", text: "Per-agent performance and conversion analytics" },
];

export const Login = () => {
  const { status, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ tenantSlug: "demo", userName: "admin", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [details, setDetails] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (status === "loading") return <Spinner fullscreen label="Restoring your session" />;
  if (status === "authenticated") return <Navigate to={location.state?.from?.pathname ?? "/"} replace />;

  const update = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setDetails(null);
    setFieldErrors({});
    setSubmitting(true);

    try {
      await signIn({
        tenantSlug: form.tenantSlug.trim(),
        userName: form.userName.trim(),
        password: form.password,
      });
      navigate(location.state?.from?.pathname ?? "/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors);
        if (Array.isArray(err.details)) setDetails(err.details);
      } else {
        setError("Unexpected error. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = () => {
    setForm({ tenantSlug: "demo", userName: "admin", password: "12345678" });
    setError(null);
    setFieldErrors({});
  };

  return (
    <div className="auth">
      <aside className="auth__aside">
        <span className="auth__grid-lines" aria-hidden="true" />

        <div className="brand brand--inverse">
          <span className="brand__mark" aria-hidden="true">
            C
          </span>
          <span className="brand__name">Calling CRM</span>
        </div>

        <div>
          <h2 className="auth__headline">Every call, one workspace.</h2>
          <p className="auth__lede">
            The calling platform built for sales teams who need their dialer, pipeline and reporting to agree with
            each other.
          </p>

          <ul className="auth__features">
            {FEATURES.map((feature) => (
              <li key={feature.text} className="auth__feature">
                <span className="auth__feature-icon">
                  <Icon name={feature.icon} size={14} />
                </span>
                {feature.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="auth__stats">
          <div className="auth__stat">
            <span className="auth__stat-value">99.9%</span>
            <span className="auth__stat-label">Uptime target</span>
          </div>
          <div className="auth__stat">
            <span className="auth__stat-value">&lt; 40ms</span>
            <span className="auth__stat-label">API response</span>
          </div>
          <div className="auth__stat">
            <span className="auth__stat-value">24/7</span>
            <span className="auth__stat-label">Monitoring</span>
          </div>
        </div>
      </aside>

      <main className="auth__panel">
        <ThemeToggle className="auth__theme" />

        <div className="auth__form-wrap">
          <h1 className="auth__title">Welcome back</h1>
          <p className="auth__subtitle">Sign in with the workspace and credentials from your administrator.</p>

          {error ? (
            <div className="auth__alert">
              <Alert tone="error" onDismiss={() => setError(null)} errors={details}>
                {error}
              </Alert>
            </div>
          ) : null}

          <form className="form" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="tenantSlug">Workspace</label>
              <div className="input-affix">
                <span className="input-affix__icon">
                  <Icon name="building" size={16} />
                </span>
                <input
                  id="tenantSlug"
                  name="tenantSlug"
                  className="input"
                  type="text"
                  autoComplete="organization"
                  placeholder="your-company"
                  value={form.tenantSlug}
                  onChange={update("tenantSlug")}
                  aria-invalid={Boolean(fieldErrors.tenantSlug)}
                  required
                />
              </div>
              {fieldErrors.tenantSlug ? <span className="field__error">{fieldErrors.tenantSlug}</span> : null}
            </div>

            <div className="field">
              <label htmlFor="userName">Username</label>
              <div className="input-affix">
                <span className="input-affix__icon">
                  <Icon name="user" size={16} />
                </span>
                <input
                  id="userName"
                  name="userName"
                  className="input"
                  type="text"
                  autoComplete="username"
                  placeholder="admin"
                  value={form.userName}
                  onChange={update("userName")}
                  aria-invalid={Boolean(fieldErrors.userName)}
                  required
                />
              </div>
              {fieldErrors.userName ? <span className="field__error">{fieldErrors.userName}</span> : null}
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="input-affix">
                <span className="input-affix__icon">
                  <Icon name="lock" size={16} />
                </span>
                <input
                  id="password"
                  name="password"
                  className="input"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="At least 8 characters"
                  value={form.password}
                  onChange={update("password")}
                  aria-invalid={Boolean(fieldErrors.password)}
                  required
                />
                <button
                  type="button"
                  className="input-affix__toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} size={16} />
                </button>
              </div>
              {fieldErrors.password ? <span className="field__error">{fieldErrors.password}</span> : null}
            </div>

            <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={submitting}>
              {submitting ? (
                <>
                  <span className="btn__spinner" aria-hidden="true" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="auth__footer">
            <span>Need an account? Ask your workspace admin.</span>
            <button type="button" className="auth__seed" onClick={fillDemo} title="Fill dev seed credentials">
              <Icon name="zap" size={13} />
              demo / admin / 12345678
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
