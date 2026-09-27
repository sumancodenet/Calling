import Icon from "./Icon.jsx";

export const EmptyState = ({ icon = "file", title, text, action }) => (
  <div className="empty">
    <span className="empty__icon">
      <Icon name={icon} size={22} />
    </span>
    <span className="empty__title">{title}</span>
    {text ? <span className="empty__text">{text}</span> : null}
    {action}
  </div>
);

export default EmptyState;
