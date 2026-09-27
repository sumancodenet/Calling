import Icon from "./Icon.jsx";
import { useTheme } from "../hooks/useTheme.js";

export const ThemeToggle = ({ className = "" }) => {
  const { isDark, cycle } = useTheme();

  return (
    <button
      type="button"
      className={`icon-btn ${className}`}
      onClick={cycle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      <Icon name={isDark ? "sun" : "moon"} size={17} />
    </button>
  );
};

export default ThemeToggle;
