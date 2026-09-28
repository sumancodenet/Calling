import { NavLink, Outlet } from "react-router-dom";
import Icon from "../components/Icon.jsx";

const TABS = [
  { to: "/settings", label: "General", icon: "settings", end: true },
  { to: "/settings/users", label: "Users", icon: "users" },
  { to: "/settings/pipeline", label: "Pipeline", icon: "layers" },
  { to: "/settings/roles", label: "Role & Permission", icon: "key" },
];

export const Settings = () => (
  <div className="page">
    <header className="page__header">
      <div>
        <h1 className="page__title">Settings</h1>
        <p className="page__subtitle">Manage your account, members and workspace configuration.</p>
      </div>
    </header>

    <div className="page__body">
      <nav className="tabs" aria-label="Settings sections">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => (isActive ? "tabs__tab tabs__tab--active" : "tabs__tab")}
          >
            <Icon name={tab.icon} size={15} />
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div className="tabs__panel">
        <Outlet />
      </div>
    </div>
  </div>
);

export default Settings;
