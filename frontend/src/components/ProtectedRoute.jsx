import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Spinner from "./Spinner.jsx";

export const ProtectedRoute = ({ children }) => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") return <Spinner fullscreen label="Restoring your session" />;

  if (status === "guest") return <Navigate to="/login" replace state={{ from: location }} />;

  return children;
};

export default ProtectedRoute;
