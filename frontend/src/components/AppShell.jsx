import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Icon from "./Icon.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

const NAV = [
  { to: "/", label: "Overview", icon: "dashboard", end: true },
  { to: "/team", label: "Team", icon: "users" },
  { to: "/sessions", label: "Active sessions", icon: "shield" },
];

// Rendered after the main nav so it sits directly above the account/sign-out block.
const FOOTER_NAV = [{ to: "/settings", label: "Settings", icon: "settings" }];

const TITLES = {
  "/": "Overview",
  "/team": "Team",
  "/sessions": "Active sessions",
  "/settings": "Settings",
  "/settings/users": "Settings / Users",
  "/settings/pipeline": "Settings / Pipeline",
  "/settings/roles": "Settings / Role & Permission",
};

const renderLink = (item) => (
  <NavLink
    key={item.to}
    to={item.to}
    end={item.end}
    className={({ isActive }) => (isActive ? "nav__link nav__link--active" : "nav__link")}
  >
    <span className="nav__icon">
      <Icon name={item.icon} size={17} />
    </span>
    {item.label}
  </NavLink>
);

export const AppShell = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    navigate("/login", { replace: true });
  };

  const initials = (user?.fullName ?? "?")
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="shell">
      <aside className="shell__sidebar">
        <div className="shell__sidebar-head">
          <div className="brand">
            <span className="brand__mark" aria-hidden="true">
              C
            </span>
            <span className="brand__name">Calling CRM</span>
          </div>
          <ThemeToggle />
        </div>

        <nav className="nav">
          <span className="shell__nav-label">Workspace</span>
          {NAV.map(renderLink)}
        </nav>

        <nav className="nav nav--footer">{FOOTER_NAV.map(renderLink)}</nav>

        <div className="shell__user">
          <span className="avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="shell__user-meta">
            <span className="shell__user-name">{user?.fullName}</span>
            <span className="shell__user-role">
              {user?.role} &middot; {user?.tenant?.name}
            </span>
          </span>
          <button
            type="button"
            className="icon-btn"
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label="Sign out"
            title="Sign out"
          >
            <Icon name="logout" size={17} />
          </button>
        </div>
      </aside>

      <div className="shell__main">
        <header className="topbar">
          <span className="topbar__title">{TITLES[location.pathname] ?? "Calling CRM"}</span>
          <span className="topbar__spacer" />
          <span className="badge badge--brand">
            <span className="badge__dot" aria-hidden="true" />
            {user?.tenant?.plan ?? "FREE"} plan
          </span>
        </header>

        <div className="shell__content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AppShell;
