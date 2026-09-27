import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon.jsx";

const ToastContext = createContext(null);

const ICON_FOR = { success: "checkCircle", error: "alert", info: "info" };
const DURATION = 4500;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (tone, title, text) => {
      const id = ++nextId.current;
      setToasts((prev) => [...prev, { id, tone, title, text }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DURATION),
      );
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const store = timers.current;
    return () => {
      store.forEach((t) => clearTimeout(t));
      store.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      toast: {
        success: (title, text) => push("success", title, text),
        error: (title, text) => push("error", title, text),
        info: (title, text) => push("info", title, text),
      },
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            <span className="toast__icon">
              <Icon name={ICON_FOR[t.tone] ?? "info"} size={18} />
            </span>
            <div className="toast__body">
              {t.title ? <span className="toast__title">{t.title}</span> : null}
              {t.text ? <span className="toast__text">{t.text}</span> : null}
            </div>
            <button type="button" className="toast__close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx.toast;
};

export default ToastProvider;
