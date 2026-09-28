import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { auth, ApiError } from "../lib/api.js";
import { useAuth } from "./AuthContext.jsx";

/**
 * One copy of the pipeline list, shared by the sidebar and the settings tab, so
 * adding or deleting a pipeline updates the navigation immediately instead of
 * only after a reload.
 */
const PipelineContext = createContext(null);

export const PipelineProvider = ({ children }) => {
  const { status } = useAuth();
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Guards against an earlier, slower response overwriting a newer one.
  const requestSeq = useRef(0);

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const payload = await auth.listPipelines();
      if (seq !== requestSeq.current) return;
      setPipelines(payload.data);
      setError(null);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setPipelines([]);
      setError(err instanceof ApiError ? err.message : "Could not load pipelines.");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  // Only once signed in: this hits an authenticated endpoint.
  useEffect(() => {
    if (status === "authenticated") {
      refresh();
    } else if (status === "guest") {
      setPipelines([]);
      setLoading(false);
    }
  }, [status, refresh]);

  const value = useMemo(() => ({ pipelines, loading, error, refresh }), [pipelines, loading, error, refresh]);

  return <PipelineContext.Provider value={value}>{children}</PipelineContext.Provider>;
};

export const usePipelines = () => {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error("usePipelines must be used within a PipelineProvider");
  return ctx;
};

export default PipelineProvider;
