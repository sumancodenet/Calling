import { useEffect, useState } from "react";
import { auth, ApiError } from "../lib/api.js";
import Icon from "../components/Icon.jsx";
import Alert from "../components/Alert.jsx";
import Spinner from "../components/Spinner.jsx";

/** Fallback tints, so a stage saved without a colour still gets a band. */
const STAGE_TINTS = ["#3b82f6", "#a855f7", "#ec4899", "#f97316", "#10b981", "#6366f1", "#ef4444"];

const tintFor = (stage, index) => stage.color ?? STAGE_TINTS[index % STAGE_TINTS.length];

const Ring = ({ value, label, percent, tone }) => (
  <div className="funnel__ringwrap">
    <span className={tone ? `funnel__ring funnel__ring--${tone}` : "funnel__ring"}>
      <span className="funnel__ringValue tabular">{value}</span>
      <span className="funnel__ringPct tabular">{percent.toFixed(1)}%</span>
    </span>
    <span className="funnel__ringLabel">{label}</span>
  </div>
);

/**
 * Lead funnel for a whole pipeline - every lead across all of its campaigns,
 * grouped by the stage it currently sits in.
 *
 * Leads land in the first stage on import, so until leads are moved between
 * stages the funnel is front-loaded by design.
 */
export const StageFunnel = ({ pipelineId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    auth
      .pipelineFunnel(pipelineId)
      .then((payload) => {
        if (!active) return;
        setData(payload.data);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof ApiError ? err.message : "Could not load the funnel.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pipelineId]);

  if (loading) return <Spinner label="Loading funnel" />;
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data) return null;

  const { totals, stages, campaignCount } = data;
  const totalPct = (n) => (totals.totalLeads === 0 ? 0 : (n / totals.totalLeads) * 100);

  return (
    <div className="funnel">
      <h2 className="funnel__title">Lead Funnel by Stages</h2>

      {/* ---- overview ---- */}
      <section className="funnel__overview">
        <header className="funnel__overviewHead">
          <Icon name="trending" size={15} />
          <span>Funnel Overview</span>
          <span className="funnel__overviewMeta">
            {campaignCount} campaign{campaignCount === 1 ? "" : "s"} in this pipeline
          </span>
        </header>

        <div className="funnel__rings">
          <Ring value={totals.totalLeads} label="Total Leads" percent={totalPct(totals.totalLeads)} tone="blue" />
          <Ring value={totals.inProgress} label="In Progress" percent={totalPct(totals.inProgress)} />
          <Ring value={totals.closed} label="Closed" percent={totalPct(totals.closed)} />
        </div>

        <div className="funnel__rule" />

        <div className="funnel__stats">
          <div className="funnel__stat">
            <span className="funnel__statLabel">Conversion rate</span>
            <span className="funnel__statValue funnel__statValue--blue tabular">{totals.conversionRate}%</span>
            <span className="funnel__statHint">Leads that reached a won stage</span>
          </div>
          <div className="funnel__stat">
            <span className="funnel__statLabel">Avg stage dropoff</span>
            <span className="funnel__statValue funnel__statValue--purple tabular">{totals.avgDropoff}%</span>
            <span className="funnel__statHint">Average fall between one stage and the next</span>
          </div>
        </div>

        {totals.unplaced > 0 ? (
          <p className="funnel__note">
            {totals.unplaced} lead(s) sit on a stage that no longer exists and are not in the breakdown.
          </p>
        ) : null}
      </section>

      {/* ---- per-stage breakdown ---- */}
      <section className="panel">
        <h3 className="funnel__breakdownTitle">Stage Breakdown</h3>

        {stages.length === 0 ? (
          <p className="muted">This pipeline has no stages yet.</p>
        ) : (
          <ul className="funnel__rows">
            {stages.map((stage, index) => {
              const tint = tintFor(stage, index);
              return (
                <li key={stage.stageId} className="funnel__row">
                  <div className="funnel__rowTop">
                    <span className="funnel__rowLabel" style={{ background: `${tint}1a`, color: tint, borderColor: `${tint}40` }}>
                      {stage.name}
                    </span>
                    <span className="funnel__rowCount tabular">
                      {stage.leads}
                      <span className="funnel__rowPct">{stage.percent}%</span>
                    </span>
                  </div>
                  <div className="funnel__rowTrack">
                    {/* A small floor so a stage holding any lead is still visible. */}
                    <span
                      className="funnel__rowFill"
                      style={{ width: `${Math.max(stage.percent, stage.leads > 0 ? 2 : 0)}%`, background: tint }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

export default StageFunnel;
