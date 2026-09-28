import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { usePipelines } from "../context/PipelineContext.jsx";
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

// The Pipelines area is an admin/subadmin tool; agents have nothing to do here,
// so the section is not rendered for them at all.
const PIPELINE_ROLES = ["ADMIN", "SUBADMIN"];

const PipelinesNav = () => {
  const { user } = useAuth();
  const { pipelines, loading } = usePipelines();
  const location = useLocation();
  const isOpen = location.pathname.startsWith("/pipelines");
  const [expanded, setExpanded] = useState(true);

  // Never collapse the section the reader is currently inside.
  useEffect(() => {
    if (isOpen) setExpanded(true);
  }, [isOpen]);

  // After every hook: returning early above them would change the hook count
  // between renders and React would throw.
  if (!PIPELINE_ROLES.includes(user?.role)) return null;

  return (
    <>
      <button
        type="button"
        className={isOpen ? "nav__link nav__link--active" : "nav__link"}
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span className="nav__icon">
          <Icon name="layers" size={17} />
        </span>
        Pipelines
        {pipelines.length > 0 ? <span className="nav__badge">{pipelines.length}</span> : null}
        <span className={expanded ? "nav__chevron" : "nav__chevron nav__chevron--collapsed"} aria-hidden="true">
          <Icon name="chevronRight" size={14} />
        </span>
      </button>

      {expanded && pipelines.length > 0 ? (
        <div className="nav__sub">
          {pipelines.map((pipeline) => (
            <NavLink
              key={pipeline.id}
              to={`/pipelines/${pipeline.id}`}
              className={({ isActive }) => (isActive ? "nav__sublink nav__sublink--active" : "nav__sublink")}
              title={pipeline.name}
            >
              <span className="nav__subdot" aria-hidden="true" />
              <span className="nav__sublabel">{pipeline.name}</span>
              {pipeline.isDefault ? <span className="nav__subbadge">Default</span> : null}
            </NavLink>
          ))}
        </div>
      ) : null}

      {expanded && !loading && pipelines.length === 0 ? (
        <p className="nav__hint">No pipelines yet. Add one from Settings.</p>
      ) : null}
    </>
  );
};

export const AppShell = () => {
  const { user, signOut } = useAuth();
  const { pipelines } = usePipelines();
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

  // /pipelines/:id is not in TITLES, so name the pipeline the reader is inside.
  const pipelineId = Number(location.pathname.split("/")[2]);
  const activePipeline = location.pathname.startsWith("/pipelines/") ? pipelines.find((p) => p.id === pipelineId) : null;
  const pageTitle = TITLES[location.pathname] ?? (activePipeline ? activePipeline.name : "Calling CRM");

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
          <PipelinesNav />
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
          <span className="topbar__title">{pageTitle}</span>
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
