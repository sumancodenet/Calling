import { Link } from "react-router-dom";
import Icon from "../components/Icon.jsx";

export const NotFound = () => (
  <div className="notfound">
    <div className="stack" style={{ alignItems: "center", gap: 12 }}>
      <span className="notfound__code">404</span>
      <h1 className="page__title">Page not found</h1>
      <p className="page__subtitle">The page you were looking for does not exist or has moved.</p>
      <Link className="btn btn--primary" to="/" style={{ marginTop: 8 }}>
        <Icon name="dashboard" size={16} />
        Back to overview
      </Link>
    </div>
  </div>
);

export default NotFound;
