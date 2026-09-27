import { useState } from "react";
import { auth, ApiError } from "../lib/api.js";
import Alert from "../components/Alert.jsx";
import Icon from "../components/Icon.jsx";
import { useToast } from "../components/Toast.jsx";

const EMPTY = { userName: "", fullName: "", email: "", phone: "", password: "" };

export const Team = () => {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [details, setDetails] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
      const payload = await auth.createUser({
        userName: form.userName.trim(),
        fullName: form.fullName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        password: form.password,
      });

      toast.success("User created", `${payload.data.fullName} can now sign in as "${payload.data.userName}".`);
      setForm(EMPTY);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors);
        if (Array.isArray(err.details)) setDetails(err.details);
        toast.error("Could not create user", err.message);
      } else {
        setError("Unexpected error. Please try again.");
        toast.error("Could not create user", "Unexpected error. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Team</h1>
          <p className="page__subtitle">Add a teammate to this workspace.</p>
        </div>
      </header>

      <div className="panel panel--narrow">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">New user</h2>
            <p className="panel__desc">Usernames and emails are unique per workspace, not globally.</p>
          </div>
          <Icon name="user" size={18} className="muted" />
        </div>

        {error ? (
          <div style={{ marginBottom: 20 }}>
            <Alert tone="error" onDismiss={() => setError(null)} errors={details}>
              {error}
            </Alert>
          </div>
        ) : null}

        <form className="form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="new-userName">Username</label>
            <input
              id="new-userName"
              className="input"
              value={form.userName}
              onChange={update("userName")}
              placeholder="jane.doe"
              aria-invalid={Boolean(fieldErrors.userName)}
              required
            />
            {fieldErrors.userName ? <span className="field__error">{fieldErrors.userName}</span> : null}
          </div>

          <div className="field">
            <label htmlFor="new-fullName">Full name</label>
            <input
              id="new-fullName"
              className="input"
              value={form.fullName}
              onChange={update("fullName")}
              placeholder="Jane Doe"
              aria-invalid={Boolean(fieldErrors.fullName)}
              required
            />
            {fieldErrors.fullName ? <span className="field__error">{fieldErrors.fullName}</span> : null}
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="new-email">
                Email <span className="field__optional">optional</span>
              </label>
              <input
                id="new-email"
                className="input"
                type="email"
                value={form.email}
                onChange={update("email")}
                placeholder="jane@company.com"
                aria-invalid={Boolean(fieldErrors.email)}
              />
              {fieldErrors.email ? <span className="field__error">{fieldErrors.email}</span> : null}
            </div>

            <div className="field">
              <label htmlFor="new-phone">
                Phone <span className="field__optional">optional</span>
              </label>
              <input
                id="new-phone"
                className="input"
                value={form.phone}
                onChange={update("phone")}
                placeholder="+91 90000 00000"
                aria-invalid={Boolean(fieldErrors.phone)}
              />
              {fieldErrors.phone ? <span className="field__error">{fieldErrors.phone}</span> : null}
            </div>
          </div>

          <div className="field">
            <label htmlFor="new-password">Temporary password</label>
            <input
              id="new-password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={update("password")}
              placeholder="At least 8 characters"
              aria-invalid={Boolean(fieldErrors.password)}
              required
            />
            {fieldErrors.password ? (
              <span className="field__error">{fieldErrors.password}</span>
            ) : (
              <span className="muted" style={{ fontSize: 13 }}>
                Share this out of band. There is no password reset flow yet.
              </span>
            )}
          </div>

          <hr className="divider" />

          <div className="row">
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? (
                <>
                  <span className="btn__spinner" aria-hidden="true" />
                  Creating...
                </>
              ) : (
                <>
                  <Icon name="plus" size={16} />
                  Create user
                </>
              )}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setForm(EMPTY)} disabled={submitting}>
              Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Team;
