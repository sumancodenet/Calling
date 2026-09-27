import { useEffect, useState } from "react";
import { auth, ApiError } from "../../lib/api.js";
import Icon from "../../components/Icon.jsx";
import Alert from "../../components/Alert.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { Skeleton } from "../../components/Spinner.jsx";

export const PipelineTab = () => {
  const [stages, setStages] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    auth
      .listPipelines()
      .then((payload) => {
        if (active) setStages(payload.data);
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : "Could not load pipeline stages.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="stack stack--lg">
      <section className="panel">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Pipeline</h2>
            <p className="panel__desc">The stages a call record moves through, in order.</p>
          </div>
          <Icon name="layers" size={18} className="muted" />
        </div>

        {error ? <Alert tone="error">{error}</Alert> : null}

        {loading ? (
          <div className="stack">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={46} />
            ))}
          </div>
        ) : stages.length === 0 ? (
          <EmptyState
            icon="layers"
            title="No pipeline stages"
            text="Run the seed script, or create stages once the pipeline CRUD endpoint exists."
          />
        ) : (
          <>
            <ol className="stages">
              {stages.map((stage) => (
                <li className="stage" key={stage.id}>
                  <span className="stage__index tabular">{stage.position + 1}</span>
                  <span className="stage__name">{stage.pipeline}</span>
                  {stage.isDefault ? <span className="badge badge--brand">Default</span> : null}
                </li>
              ))}
            </ol>

            <div className="notice" style={{ marginTop: 20 }}>
              <Icon name="info" size={15} />
              <span>
                Read-only for now. Creating, renaming and reordering stages needs <code>POST/PATCH/DELETE
                /api/pipelines</code>, which is not built yet.
              </span>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default PipelineTab;
