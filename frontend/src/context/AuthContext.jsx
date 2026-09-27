import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { auth, setUnauthorizedHandler } from "../lib/api.js";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [status, setStatus] = useState("loading");
  const [user, setUser] = useState(null);

  const signOut = useCallback(async () => {
    try {
      await auth.logout();
    } catch {
      // Cookie may already be gone; the local session is cleared either way.
    }
    setUser(null);
    setStatus("guest");
  }, []);

  const signIn = useCallback(async (credentials) => {
    const signedInUser = await auth.login(credentials);
    setUser(signedInUser);
    setStatus("authenticated");
    return signedInUser;
  }, []);

  // The access token lives in memory, so a page reload starts empty. The httpOnly
  // refresh cookie is all that is needed to mint a new one on boot.
  useEffect(() => {
    let active = true;
    auth
      .restoreSession()
      .then((restored) => {
        if (!active) return;
        setUser(restored);
        setStatus("authenticated");
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setStatus("guest");
      });
    return () => {
      active = false;
    };
  }, []);

  // Fires when a refresh attempt fails on an otherwise authenticated request.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setStatus("guest");
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const value = useMemo(
    () => ({ status, user, signIn, signOut, isAuthenticated: status === "authenticated" }),
    [status, user, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};

export default AuthContext;
