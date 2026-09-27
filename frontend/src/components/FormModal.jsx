import { useEffect, useState } from "react";
import Icon from "./Icon.jsx";
import Alert from "./Alert.jsx";
import { ApiError } from "../lib/api.js";

/**
 * Field-driven dialog. `fields` describes the controls, so creating a pipeline,
 * a stage and a tag all reuse this instead of three near-identical components.
 *
 * field: { name, label, type, required, placeholder, options, hint, optional }
 */
export const FormModal = ({
  open,
  title,
  description,
  fields,
  submitLabel = "Save",
  onSubmit,
  onClose,
  size = "sm",
}) => {
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const initial = () => {
    const out = {};
    for (const field of fields) {
      out[field.name] = field.initial ?? (field.type === "checkbox" ? false : "");
    }
    return out;
  };

  useEffect(() => {
    if (open) {
      setValues(initial());
      setErrors({});
      setError(null);
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const update = (name) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const missing = fields.filter((f) => f.required && !String(values[f.name] ?? "").trim());

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (missing.length > 0) {
      setErrors(Object.fromEntries(missing.map((f) => [f.name, `${f.label} is required`])));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onSubmit(values);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        const next = {};
        for (const detail of Array.isArray(err.details) ? err.details : []) {
          const key = String(detail.field ?? "").split(".").pop();
          if (key) next[key] = detail.value ? `${key} "${detail.value}" is already in use` : detail.message;
        }
        setErrors(next);
      } else {
        console.error("[form-modal] unexpected", err && err.message, err && err.stack);
        setError("Unexpected error. Please try again.");
      }
      setBusy(false);
    }
  };

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-modal-title"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className={`modal__panel modal__panel--${size}`}>
        <header className="modal__head">
          <div>
            <h2 className="modal__title" id="form-modal-title">
              {title}
            </h2>
            {description ? <p className="modal__desc">{description}</p> : null}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close">
            <Icon name="x" size={17} />
          </button>
        </header>

        {error ? (
          <div style={{ padding: "16px 24px 0" }}>
            <Alert tone="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} noValidate>
          <div className="modal__body">
            <div className="grid" style={{ marginBottom: 0, gridTemplateColumns: "1fr 1fr" }}>
              {fields.map((field) => {
                const id = `fm-${field.name}`;
                const invalid = Boolean(errors[field.name]);
                return (
                  <div
                    className="field"
                    key={field.name}
                    style={field.span ? { gridColumn: "1 / -1" } : undefined}
                  >
                    {field.type === "checkbox" ? (
                      <label className="checkbox" htmlFor={id}>
                        <input id={id} type="checkbox" checked={Boolean(values[field.name])} onChange={update(field.name)} disabled={busy} />
                        <span>{field.label}</span>
                      </label>
                    ) : (
                      <>
                        <label htmlFor={id}>
                          {field.label}
                          {field.required ? <span className="field__required">*</span> : <span className="field__optional">optional</span>}
                        </label>
                        {field.type === "select" ? (
                          <select id={id} className="input" value={values[field.name] ?? ""} onChange={update(field.name)} disabled={busy}>
                            {field.options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : field.type === "textarea" ? (
                          <textarea
                            id={id}
                            className="input"
                            rows={3}
                            placeholder={field.placeholder}
                            value={values[field.name] ?? ""}
                            onChange={update(field.name)}
                            disabled={busy}
                          />
                        ) : (
                          <input
                            id={id}
                            className="input"
                            type={field.type ?? "text"}
                            placeholder={field.placeholder}
                            value={values[field.name] ?? ""}
                            onChange={update(field.name)}
                            aria-invalid={invalid}
                            disabled={busy}
                          />
                        )}
                      </>
                    )}
                    {errors[field.name] ? <span className="field__error">{errors[field.name]}</span> : field.hint ? <span className="field__hint">{field.hint}</span> : null}
                  </div>
                );
              })}
            </div>
          </div>

          <footer className="modal__foot modal__foot--end">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy || missing.length > 0}>
              {busy ? "Saving..." : submitLabel}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default FormModal;
