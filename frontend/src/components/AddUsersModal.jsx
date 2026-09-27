import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import Alert from "./Alert.jsx";
import { useToast } from "./Toast.jsx";
import { auth, ApiError } from "../lib/api.js";

let rowSeq = 0;
const blankRow = () => ({
  key: `row-${++rowSeq}`,
  userName: "",
  fullName: "",
  phone: "",
  email: "",
  employeeId: "",
  password: "",
  role: "AGENT",
});

/** "users.1.phone" -> { index: 1, field: "phone" } */
const parseFieldPath = (path) => {
  const match = /^users\.(\d+)\.(.+)$/.exec(String(path));
  return match ? { index: Number(match[1]), field: match[2] } : null;
};

const FIELDS = [
  { key: "userName", label: "Username", required: true, placeholder: "rahul.k", autoComplete: "off" },
  { key: "fullName", label: "Full name", required: false, placeholder: "Rahul Kumar" },
  { key: "phone", label: "Phone", required: true, placeholder: "9811100001" },
  { key: "email", label: "Email", required: false, placeholder: "rahul@acme.com", type: "email" },
  { key: "employeeId", label: "Employee ID", required: false, placeholder: "EMP-1001" },
  { key: "password", label: "Password", required: true, type: "password", placeholder: "Min 8 characters" },
];

export const AddUsersModal = ({ open, onClose, onCreated }) => {
  const toast = useToast();
  const [rows, setRows] = useState(() => [blankRow()]);
  const [roles, setRoles] = useState([]);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const firstFieldRef = useRef(null);

  // Reset whenever it is opened. `submitting` must be included: the component
  // stays mounted while closed (it renders null), so without this a successful
  // submit leaves the next open stuck on "Creating..." with a disabled button.
  useEffect(() => {
    if (open) {
      setRows([blankRow()]);
      setErrors({});
      setFormError(null);
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    auth
      .listRoles()
      .then((payload) => setRoles(payload.data))
      .catch(() => setRoles([{ key: "ADMIN", label: "Administrator" }, { key: "AGENT", label: "Agent" }]));
  }, [open]);

  // Escape to close, and keep the page behind from scrolling.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, submitting, onClose]);

  useEffect(() => {
    if (open) firstFieldRef.current?.focus();
  }, [open]);

  const update = useCallback((key, field) => (event) => {
    const { value } = event.target;
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
    setErrors((prev) => {
      if (!prev[key]?.[field]) return prev;
      const next = { ...prev, [key]: { ...prev[key] } };
      delete next[key][field];
      return next;
    });
  }, []);

  const addRow = () => {
    setRows((prev) => [...prev, blankRow()]);
  };

  const removeRow = (key) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.key !== key)));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const reset = () => {
    setRows([blankRow()]);
    setErrors({});
    setFormError(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);
    setErrors({});

    // Send only the fields the API expects, with blanks as "" so the server's
    // optional/checkFalsy handling decides what becomes NULL.
    const payload = rows.map((row) => ({
      userName: row.userName.trim(),
      fullName: row.fullName.trim(),
      phone: row.phone.trim(),
      email: row.email.trim(),
      employeeId: row.employeeId.trim(),
      password: row.password,
      role: row.role,
    }));

    setSubmitting(true);
    try {
      // The API client resolves with the response envelope itself, so the
      // created users are on `res.data`, not `res.body.data`.
      const res = await auth.createUsers(payload);
      toast.success(
        res.message,
        res.data.map((u) => u.userName).join(", "),
      );
      onCreated?.(res.data);
      onClose();
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setFormError("Unexpected error. Please try again.");
        setSubmitting(false);
        return;
      }

      if (err.status === 401) {
        setFormError("Your session ended. Please sign in again.");
        setSubmitting(false);
        return;
      }

      const perRow = {};
      let unattached = null;
      for (const detail of Array.isArray(err.details) ? err.details : []) {
        const parsed = parseFieldPath(detail.field);
        if (parsed && rows[parsed.index]) {
          perRow[rows[parsed.index].key] = { ...(perRow[rows[parsed.index].key] ?? {}), [parsed.field]: detail.message };
        } else {
          unattached = unattached ?? detail.message;
        }
      }

      if (Object.keys(perRow).length > 0) setErrors(perRow);
      // Only show the banner for errors that could not be pinned to a field,
      // otherwise the same message appears twice.
      setFormError(Object.keys(perRow).length === 0 ? err.message : unattached);
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-users-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="modal__panel">
        <header className="modal__head">
          <div>
            <h2 className="modal__title" id="add-users-title">
              Add users
            </h2>
            <p className="modal__desc">
              Create up to 100 accounts at once. Either every row is created, or none is.
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} disabled={submitting} aria-label="Close">
            <Icon name="x" size={17} />
          </button>
        </header>

        {formError ? (
          <div style={{ padding: "0 24px 4px" }}>
            <Alert tone="error">{formError}</Alert>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} noValidate>
          <div className="modal__body">
            {rows.map((row, index) => (
              <fieldset className="userrow" key={row.key}>
                <legend className="userrow__legend">
                  <span className="userrow__index">{index + 1}</span>
                  {rows.length > 1 ? (
                    <button
                      type="button"
                      className="userrow__remove"
                      onClick={() => removeRow(row.key)}
                      disabled={submitting}
                      aria-label={`Remove user ${index + 1}`}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  ) : null}
                </legend>

                <div className="userrow__grid">
                  {FIELDS.map((field, fieldIndex) => {
                    const error = errors[row.key]?.[field.key];
                    const id = `${row.key}-${field.key}`;
                    return (
                      <div className="field" key={field.key}>
                        <label htmlFor={id}>
                          {field.label}
                          {field.required ? (
                            <span className="field__required">*</span>
                          ) : (
                            <span className="field__optional">optional</span>
                          )}
                        </label>
                        <input
                          id={id}
                          ref={index === 0 && fieldIndex === 0 ? firstFieldRef : null}
                          className="input"
                          type={field.type ?? "text"}
                          autoComplete={field.autoComplete ?? "off"}
                          placeholder={field.placeholder}
                          value={row[field.key]}
                          onChange={update(row.key, field.key)}
                          aria-invalid={Boolean(error)}
                        />
                        {error ? <span className="field__error">{error}</span> : null}
                      </div>
                    );
                  })}

                  <div className="field">
                    <label htmlFor={`${row.key}-role`}>
                      Role
                      <span className="field__optional">optional</span>
                    </label>
                    <select
                      id={`${row.key}-role`}
                      className="input"
                      value={row.role}
                      onChange={update(row.key, "role")}
                      disabled={submitting}
                    >
                      {(roles.length ? roles : [{ key: "ADMIN", label: "Administrator" }, { key: "AGENT", label: "Agent" }]).map(
                        (role) => (
                          <option key={role.key} value={role.key}>
                            {role.label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                </div>
              </fieldset>
            ))}

            <button type="button" className="btn btn--secondary btn--block" onClick={addRow} disabled={submitting}>
              <Icon name="plus" size={15} />
              Add another
            </button>
          </div>

          <footer className="modal__foot">
            <span className="muted">
              {rows.length} {rows.length === 1 ? "user" : "users"} ready
            </span>
            <div className="row">
              <button type="button" className="btn btn--ghost" onClick={reset} disabled={submitting}>
                Reset
              </button>
              <button type="button" className="btn btn--secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="btn__spinner" aria-hidden="true" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Icon name="check" size={15} />
                    Create {rows.length === 1 ? "user" : `${rows.length} users`}
                  </>
                )}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default AddUsersModal;
