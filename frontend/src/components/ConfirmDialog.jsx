import { useEffect, useState } from "react";
import Icon from "./Icon.jsx";

/**
 * Destructive-action confirmation.
 *
 * When `confirmPhrase` is set the confirm button stays disabled until the user
 * types that word, which stops accidental deletes on a row of buttons.
 * The match is case-insensitive so a mobile keyboard auto-capitalising "delete"
 * does not block the action.
 *
 * Wrapped in a real <form> so Enter in the input confirms, as expected.
 */
export const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  confirmPhrase = null,
  tone = "danger",
  busy = false,
  onConfirm,
  onClose,
}) => {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (open) setTyped("");
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

  const needsPhrase = Boolean(confirmPhrase);
  const matched =
    !needsPhrase || typed.trim().toLowerCase() === String(confirmPhrase).trim().toLowerCase();
  const canSubmit = matched && !busy;

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="modal__panel modal__panel--sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) onConfirm();
          }}
        >
          <div className="confirm">
            <span className={`confirm__icon confirm__icon--${tone}`} aria-hidden="true">
              <Icon name={tone === "danger" ? "alert" : "info"} size={20} />
            </span>
            <h2 className="confirm__title" id="confirm-title">
              {title}
            </h2>
            <p className="confirm__message">{message}</p>

            {needsPhrase ? (
              <div className="field confirm__field">
                <label htmlFor="confirm-phrase">
                  Type <code>{confirmPhrase}</code> to confirm
                </label>
                <input
                  id="confirm-phrase"
                  className="input"
                  type="text"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={confirmPhrase}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-invalid={typed.length > 0 && !matched}
                  disabled={busy}
                />
                {typed.length > 0 && !matched ? (
                  <span className="field__error">Type “{confirmPhrase}” exactly to continue</span>
                ) : null}
              </div>
            ) : null}
          </div>

          <footer className="modal__foot modal__foot--end">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              type="submit"
              className={tone === "danger" ? "btn btn--danger-solid" : "btn btn--primary"}
              disabled={!canSubmit}
              title={needsPhrase && !matched ? `Type "${confirmPhrase}" to enable` : undefined}
            >
              {busy ? "Working..." : confirmLabel}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default ConfirmDialog;
