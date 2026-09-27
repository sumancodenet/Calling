import { useEffect, useState } from "react";
import Icon from "./Icon.jsx";
import Alert from "./Alert.jsx";
import { auth, ApiError } from "../lib/api.js";
import { useToast } from "./Toast.jsx";

const PASSWORD_MIN = 8;

export const ChangePasswordModal = ({ open, user, onClose, onChanged }) => {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword("");
      setConfirm("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open || !user) return null;

  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < PASSWORD_MIN;

  const submit = async (event) => {
    event.preventDefault();
    if (mismatch || tooShort) return;

    setBusy(true);
    setError(null);
    try {
      const res = await auth.changePassword(user.id, password);
      toast.success("Password reset", res.message);
      onChanged?.();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset the password.");
      setBusy(false);
    }
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pw-title" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal__panel modal__panel--sm">
        <header className="modal__head">
          <div>
            <h2 className="modal__title" id="pw-title">
              Change password
            </h2>
            <p className="modal__desc">
              For <strong>{user.fullName}</strong> ({user.userName}). Their active sessions will be signed out.
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close">
            <Icon name="x" size={17} />
          </button>
        </header>

        {error ? (
          <div style={{ padding: "16px 24px 0" }}>
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}

        <form onSubmit={submit} noValidate>
          <div className="modal__body">
            <div className="field">
              <label htmlFor="new-password">New password</label>
              <input
                id="new-password"
                className="input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={tooShort || mismatch}
                required
              />
              {tooShort ? <span className="field__error">At least {PASSWORD_MIN} characters</span> : null}
            </div>

            <div className="field">
              <label htmlFor="confirm-password">Confirm new password</label>
              <input
                id="confirm-password"
                className="input"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-invalid={mismatch}
                required
              />
              {mismatch ? <span className="field__error">Passwords do not match</span> : null}
            </div>
          </div>

          <footer className="modal__foot modal__foot--end">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy || mismatch || tooShort || !password}>
              {busy ? "Resetting..." : "Reset password"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
