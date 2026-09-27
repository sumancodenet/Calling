import { useEffect, useState } from "react";
import Icon from "./Icon.jsx";
import Alert from "./Alert.jsx";
import { auth, ApiError } from "../lib/api.js";
import { useToast } from "./Toast.jsx";

const ROLES = [
  { key: "ADMIN", label: "Administrator" },
  { key: "SUBADMIN", label: "Sub administrator" },
  { key: "AGENT", label: "Agent" },
];

const STATUSES = [
  { key: "ACTIVE", label: "Active" },
  { key: "INACTIVE", label: "Inactive" },
  { key: "BLOCKED", label: "Blocked" },
];

const blank = (user) => ({
  fullName: user?.fullName ?? "",
  phone: user?.phone ?? "",
  email: user?.email ?? "",
  employeeId: user?.employeeId ?? "",
  role: user?.role ?? "AGENT",
  Status: user?.Status ?? "ACTIVE",
});

export const EditUserModal = ({ open, user, onClose, onChanged }) => {
  const toast = useToast();
  const [form, setForm] = useState(() => blank(user));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && user) {
      setForm(blank(user));
      setErrors({});
      setError(null);
      setBusy(false);
    }
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open || !user) return null;

  const update = (key) => (event) => {
    const { value } = event.target;
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});

    try {
      // Blank optional fields are sent as null so the API clears them.
      const patch = {
        fullName: form.fullName.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        employeeId: form.employeeId.trim() || null,
        role: form.role,
        Status: form.Status,
      };
      const res = await auth.updateUser(user.id, patch);
      toast.success("User updated", `${res.data.fullName} (${res.data.userName})`);
      onChanged?.();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        const next = {};
        for (const detail of Array.isArray(err.details) ? err.details : []) {
          if (detail.field) next[detail.field] = detail.message;
        }
        // 409 conflicts come back as a bare `field`, not an array.
        if (err.status === 409 && Array.isArray(err.details)) {
          for (const detail of err.details) if (detail.field) next[detail.field] = detail.value;
        }
        setErrors(next);
      } else {
        setError("Unexpected error. Please try again.");
      }
      setBusy(false);
    }
  };

  const field = (key, label, placeholder, optional = true) => (
    <div className="field">
      <label htmlFor={`edit-${key}`}>
        {label}
        {optional ? <span className="field__optional">optional</span> : <span className="field__required">*</span>}
      </label>
      <input
        id={`edit-${key}`}
        className="input"
        value={form[key]}
        onChange={update(key)}
        placeholder={placeholder}
        aria-invalid={Boolean(errors[key])}
        required={!optional}
      />
      {errors[key] ? <span className="field__error">{errors[key]}</span> : null}
    </div>
  );

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-title" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal__panel modal__panel--sm">
        <header className="modal__head">
          <div>
            <h2 className="modal__title" id="edit-title">
              Edit user
            </h2>
            <p className="modal__desc">
              <strong>{user.userName}</strong> &middot; {user.userId}
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
            <div className="grid" style={{ marginBottom: 0 }}>
              {field("fullName", "Full name", "Rahul Kumar", false)}
              {field("phone", "Phone", "9811100001")}
              {field("email", "Email", "rahul@acme.com")}
              {field("employeeId", "Employee ID", "EMP-1001")}

              <div className="field">
                <label htmlFor="edit-role">Role</label>
                <select id="edit-role" className="input" value={form.role} onChange={update("role")}>
                  {ROLES.map((role) => (
                    <option key={role.key} value={role.key}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="edit-status">Status</label>
                <select id="edit-status" className="input" value={form.Status} onChange={update("Status")}>
                  {STATUSES.map((status) => (
                    <option key={status.key} value={status.key}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              Changing the role or status signs this person out everywhere.
            </p>
          </div>

          <footer className="modal__foot modal__foot--end">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy || !form.fullName.trim()}>
              {busy ? "Saving..." : "Save changes"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default EditUserModal;
