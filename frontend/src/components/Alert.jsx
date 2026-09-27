import Icon from "./Icon.jsx";

const ICON_FOR = {
  error: "alert",
  success: "checkCircle",
  warning: "alert",
  info: "info",
};

export const Alert = ({ tone = "error", title, children, errors, onDismiss }) => {
  const list = Array.isArray(errors) ? errors : null;
  if (!children && !title && !list?.length) return null;

  return (
    <div className={`alert alert--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <span className="alert__icon">
        <Icon name={ICON_FOR[tone] ?? "info"} size={16} />
      </span>
      <div className="alert__body">
        {title ? <strong className="alert__title">{title}</strong> : null}
        {children ? <span className="alert__text">{children}</span> : null}
        {list?.length ? (
          <ul className="alert__list">
            {list.map((item, i) => (
              <li key={i}>{item.field ? `${item.field}: ${item.message}` : item.message}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {onDismiss ? (
        <button type="button" className="alert__close" onClick={onDismiss} aria-label="Dismiss">
          <Icon name="x" size={13} />
        </button>
      ) : null}
    </div>
  );
};

export default Alert;
