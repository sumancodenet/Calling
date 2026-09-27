import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "crm-theme";

const systemPrefersDark = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;

const readPreference = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  } catch {
    return "system";
  }
};

export const resolveTheme = (preference) => {
  if (preference === "light" || preference === "dark") return preference;
  return systemPrefersDark() ? "dark" : "light";
};

const apply = (preference) => {
  const resolved = resolveTheme(preference);
  document.documentElement.setAttribute("data-theme", resolved);
  return resolved;
};

// Applied at module load; index.html mirrors this inline to avoid a flash.
if (typeof document !== "undefined") {
  apply(readPreference());
}

export const useTheme = () => {
  const [preference, setPreference] = useState(readPreference);
  const [resolved, setResolved] = useState(() => apply(readPreference()));

  useEffect(() => {
    setResolved(apply(preference));
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Storage disabled (private mode) - still applied for this session.
    }
  }, [preference]);

  // Follow the OS while the preference is "system".
  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;

    const onChange = () => setResolved(apply("system"));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const cycle = useCallback(() => {
    setPreference((prev) => (prev === "dark" ? "light" : prev === "light" ? "system" : "dark"));
  }, []);

  return { preference, setPreference, resolved, isDark: resolved === "dark", cycle };
};

export default useTheme;
