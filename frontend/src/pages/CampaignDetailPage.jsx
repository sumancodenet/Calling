import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { auth, ApiError } from "../lib/api.js";
import Icon from "../components/Icon.jsx";
import Alert from "../components/Alert.jsx";
import Spinner from "../components/Spinner.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { useToast } from "../components/Toast.jsx";

const formatBytes = (bytes) => (bytes ? `${(bytes / 1024).toFixed(0)} KB` : "-");
const formatDate = (value) =>
  value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "-";

/**
 * Campaign analytics: totals, how leads sit across the pipeline stages, the tags
 * on each stage, and the import history.
 *
 * A campaign with no leads has nothing to report, so it is redirected to the
 * import screen rather than showing a page full of zeroes.
 */
export const CampaignDetailPage = () => {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionOpen, setActionOpen] = useState(false);

  // View modal
  const [viewing, setViewing] = useState(null);
  const [viewRows, setViewRows] = useState([]);
  const [viewMeta, setViewMeta] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Delete
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteLeads, setDeleteLeads] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await auth.campaignAnalytics(campaignId);
      setData(payload.data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this campaign.");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!actionOpen) return;
    const close = (e) => {
      if (!e.target.closest?.(".analytics__action")) setActionOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [actionOpen]);

  const openUpload = async (upload) => {
    setViewing(upload);
    setViewRows([]);
    setViewMeta(null);
    setViewLoading(true);
    try {
      const payload = await auth.listUploadLeads(campaignId, upload.id, { limit: 100 });
      setViewRows(payload.data.items ?? []);
      setViewMeta(payload.data.meta ?? null);
    } catch (err) {
      toast.error("Could not load leads", err instanceof ApiError ? err.message : "Please try again.");
      setViewing(null);
    } finally {
      setViewLoading(false);
    }
  };

  /**
   * The original file lives in a private S3 bucket, so the browser is handed a
   * short-lived presigned URL on demand. Nothing long-lived is ever exposed.
   */
  const downloadOriginal = async (upload) => {
    try {
      const payload = await auth.uploadDownloadUrl(campaignId, upload.id);
      // Handed to the browser as a navigation so the browser runs the download.
      window.open(payload.data.url, "_blank", "noopener");
    } catch (err) {
      toast.error(
        "Could not download",
        err instanceof ApiError ? err.message : "The stored file is not available for this import.",
      );
    }
  };

  /**
   * The dialog has to state the lead count, so it is fetched before the
   * confirmation appears rather than after.
   */
  const askDelete = async (upload) => {
    try {
      const payload = await auth.listUploadLeads(campaignId, upload.id, { limit: 1 });
      setDeleteLeads(payload.data.meta?.total ?? 0);
    } catch {
      setDeleteLeads(0);
    }
    setPendingDelete(upload);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const payload = await auth.deleteUpload(campaignId, pendingDelete.id);
      const removed = payload.data.leadsRemoved ?? 0;
      toast.success("Import deleted", `${pendingDelete.fileName} and ${removed} lead(s) removed`);
      setPendingDelete(null);
      if (viewing?.id === pendingDelete.id) setViewing(null);
      load();
    } catch (err) {
      toast.error("Could not delete", err instanceof ApiError ? err.message : "Please try again.");
      setPendingDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <Spinner label="Loading campaign analytics" />;

  if (error) {
    return (
      <div className="page">
        <div className="page__body">
          <Alert tone="error">{error}</Alert>
        </div>
      </div>
    );
  }

  const { campaign, pipeline, totals, stageDistribution, tagsByStage, uploads } = data;

  if (totals.totalLeads === 0) {
    return <Navigate to={`/campaigns/${campaignId}/leads/upload`} replace />;
  }

  const kpis = [
    { tone: "blue", label: "Total Leads", value: totals.totalLeads, icon: "trending" },
    { tone: "purple", label: "Active Leads", value: totals.activeLeads, icon: "users" },
    { tone: "green", label: "Avg Leads/Stage", value: totals.avgLeadsPerStage, icon: "checkCircle" },
    { tone: "orange", label: "Total Tags", value: totals.totalTags, icon: "palette" },
  ];

  // Only Upload Excel Sheet and Pause Campaign have a backend today. The rest
  // are listed so the menu matches the intended workflow, and are disabled
  // rather than silently doing nothing.
  const ACTION_ITEMS = [
    { key: "dispositions", label: "Dispositions", icon: "checkCircle", enabled: false },
    {
      key: "upload",
      label: "Upload Excel Sheet",
      icon: "file",
      enabled: true,
      onClick: () => {
        setActionOpen(false);
        navigate(`/campaigns/${campaignId}/leads/upload`);
      },
    },
    { key: "add-lead", label: "Add Lead", icon: "plus", enabled: false },
    { key: "engagement-form", label: "Engagement Form", icon: "file", enabled: false },
    { key: "tasks", label: "Tasks", icon: "check", enabled: false },
    {
      key: "pause",
      label: campaign.Status === "PAUSED" ? "Resume Campaign" : "Pause Campaign",
      icon: "clock",
      enabled: true,
      onClick: () => {
        setActionOpen(false);
        setStatusBusy(true);
        const next = campaign.Status === "PAUSED" ? "ACTIVE" : "PAUSED";
        auth
          .updateCampaignStatus(campaignId, next)
          .then(() => {
            toast.success(next === "PAUSED" ? "Campaign paused" : "Campaign resumed", campaign.name);
            load();
          })
          .catch((err) =>
            toast.error("Could not update", err instanceof ApiError ? err.message : "Please try again."),
          )
          .finally(() => setStatusBusy(false));
      },
    },
    { key: "settings", label: "Campaign Settings", icon: "settings", enabled: false },
  ];

  return (
    <div className="page">
      <div className="page__body analytics">
        {/* ---- header ---- */}
        <header className="analytics__head">
          <div className="analytics__ident">
            <span className="analytics__logo" aria-hidden="true">
              <Icon name="trending" size={20} />
            </span>
            <div>
              <h1 className="analytics__title">Campaign Analytics</h1>
              <p className="analytics__lede">
                {campaign.name}
                {pipeline ? ` · ${pipeline.name}` : ""} — real-time insights and performance metrics
              </p>
            </div>
          </div>

          <div className="analytics__controls">
            <span className="analytics__priority">
              Priority: <strong>{campaign.priority}</strong> {campaign.priorityLabel}
            </span>
            <button type="button" className="btn btn--sm" disabled>
              <Icon name="trending" size={14} />
              Lead Summary
            </button>
            <button type="button" className="btn btn--sm" disabled>
              <Icon name="phone" size={14} />
              Call Logs
            </button>

            <div className="analytics__action">
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => setActionOpen((prev) => !prev)}
                aria-expanded={actionOpen}
                aria-haspopup="menu"
                disabled={statusBusy}
              >
                {statusBusy ? "Updating..." : "Action"}
                <span className={actionOpen ? "analytics__actionChev" : "analytics__actionChev analytics__actionChev--open"}>
                  <Icon name="chevronRight" size={13} />
                </span>
              </button>

              {actionOpen ? (
                <div className="analytics__menu" role="menu">
                  {ACTION_ITEMS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      role="menuitem"
                      disabled={!item.enabled}
                      onClick={() => item.onClick?.()}
                      title={item.enabled ? item.label : `${item.label} — not available yet`}
                    >
                      <Icon name={item.icon} size={14} />
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {/* ---- mini totals, top right ---- */}
        <div className="analytics__mini">
          <div className="mini">
            <span className="mini__icon mini__icon--blue">
              <Icon name="users" size={16} />
            </span>
            <span className="mini__text">
              <span className="mini__label">Total Leads</span>
              <span className="mini__value tabular">{totals.totalLeads}</span>
            </span>
          </div>
          <div className="mini">
            <span className="mini__icon mini__icon--purple">
              <Icon name="layers" size={16} />
            </span>
            <span className="mini__text">
              <span className="mini__label">Total Stages</span>
              <span className="mini__value tabular">{totals.totalStages}</span>
            </span>
          </div>
        </div>

        {/* ---- kpi row ---- */}
        <div className="kpis">
          {kpis.map((kpi) => (
            <article key={kpi.label} className={`kpi kpi--${kpi.tone}`}>
              <span className="kpi__label">{kpi.label}</span>
              <span className="kpi__value tabular">{kpi.value}</span>
              <span className="kpi__icon" aria-hidden="true">
                <Icon name={kpi.icon} size={26} />
              </span>
            </article>
          ))}
        </div>

        {/* ---- distribution + tags ---- */}
        <div className="analytics__split">
          <section className="panel">
            <div className="panel__head">
              <div className="analytics__panelTitle">
                <span className="mini__icon mini__icon--blue">
                  <Icon name="clock" size={15} />
                </span>
                <span className="panel__title">Stage Distribution</span>
              </div>
              <span className="muted">Lead distribution</span>
            </div>

            <ul className="dist">
              {stageDistribution.map((stage) => (
                <li key={stage.stageId} className="dist__row">
                  <div className="dist__top">
                    <span className="dist__name">{stage.name}</span>
                    <span className="dist__count tabular">
                      {stage.leads} lead{stage.leads === 1 ? "" : "s"} ({stage.percent}%)
                    </span>
                  </div>
                  <div className="dist__track">
                    <span
                      className="dist__fill"
                      style={{ width: `${Math.max(stage.percent, stage.leads > 0 ? 2 : 0)}%`, background: stage.color ?? undefined }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            {totals.unplacedLeads > 0 ? (
              <p className="muted analytics__note">
                {totals.unplacedLeads} lead(s) are not on any stage yet.
              </p>
            ) : null}
          </section>

          <section className="panel">
            <div className="panel__head">
              <div className="analytics__panelTitle">
                <span className="mini__icon mini__icon--purple">
                  <Icon name="palette" size={15} />
                </span>
                <span className="panel__title">Tags Summary</span>
              </div>
              <span className="muted"># {totals.totalTags} total tags</span>
            </div>

            {tagsByStage.length === 0 ? (
              <p className="muted">No tags defined on this pipeline yet.</p>
            ) : (
              <div className="tagsum">
                {tagsByStage.map((group) => (
                  <div key={group.stageId} className="tagsum__group">
                    <span className="tagsum__stage">{group.stageName}</span>
                    <div className="tagsum__chips">
                      {group.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="tagsum__chip"
                          style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
                        >
                          <Icon name="palette" size={11} />
                          {tag.name}
                          <span className="tagsum__count">({tag.leads})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ---- import history ---- */}
        <section className="panel panel--flush">
          <div className="panel__head" style={{ padding: "var(--sp-5) var(--sp-5) var(--sp-4)" }}>
            <div className="analytics__panelTitle">
              <span className="mini__icon mini__icon--blue">
                <Icon name="search" size={15} />
              </span>
              <span className="panel__title">Campaign CSV Details</span>
              <span className="badge badge--neutral">{uploads.length} records</span>
            </div>
          </div>

          {uploads.length === 0 ? (
            <p className="muted" style={{ padding: "0 var(--sp-5) var(--sp-5)" }}>
              No imports recorded yet. Anything uploaded from now on is listed here.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="table table--wide">
                <thead>
                  <tr>
                    <th>Campaign name</th>
                    <th>File</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Total rows</th>
                    <th>Pipeline</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((upload) => (
                    <tr key={upload.id}>
                      <td>{campaign.name}</td>
                      <td>
                        <span className="upload-cell">
                          <Icon name="file" size={13} />
                          <span className="table__truncate">{upload.fileName}</span>
                          <span className="muted">{formatBytes(upload.sizeBytes)}</span>
                        </span>
                      </td>
                      <td className="tabular">{formatDate(upload.uploadedAt)}</td>
                      <td>
                        <span className={upload.Status === "COMPLETED" ? "badge badge--ok" : "badge badge--warning"}>
                          {upload.Status}
                        </span>
                      </td>
                      <td className="tabular">
                        {upload.totalRows}
                        <span className="muted"> · +{upload.created}</span>
                      </td>
                      <td>{upload.pipeline}</td>
                      <td className="table__actions">
                        <div className="rowacts">
                          <button
                            type="button"
                            className="icon-btn icon-btn--sm"
                            onClick={() => openUpload(upload)}
                            aria-label={`View leads from ${upload.fileName}`}
                            title="View leads"
                          >
                            <Icon name="eye" size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn--sm"
                            onClick={() => downloadOriginal(upload)}
                            disabled={!upload.fileStored}
                            aria-label={`Download ${upload.fileName}`}
                            title={upload.fileStored ? "Download original file" : "Original file was not stored"}
                          >
                            <Icon name="download" size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn--sm icon-btn--danger"
                            onClick={() => setPendingDelete(upload)}
                            aria-label={`Delete ${upload.fileName}`}
                            title="Delete import"
                          >
                            <Icon name="trash" size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* ---- view leads from one import ---- */}
      {viewing ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="view-upload-title">
          <div className="modal__panel modal__panel--lg">
            <header className="modal__head">
              <div>
                <h2 className="modal__title" id="view-upload-title">
                  {viewing.fileName}
                </h2>
                <p className="modal__desc">
                  {viewing.source} &middot; {viewing.totalRows} row(s) read &middot; {viewing.created} created
                </p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setViewing(null)} aria-label="Close">
                <Icon name="x" size={17} />
              </button>
            </header>

            {viewLoading ? (
              <Spinner label="Loading leads" />
            ) : viewRows.length === 0 ? (
              <div className="modal__body">
                <p className="muted">This import added no leads — they were all merged into existing records.</p>
              </div>
            ) : (
              <div className="modal__body" style={{ padding: 0, maxHeight: "min(60vh, 520px)" }}>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Assigned to</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.name}</td>
                          <td className="table__mono">{row.phone ?? "-"}</td>
                          <td className="table__truncate">{row.email ?? "-"}</td>
                          <td>
                            <span className="badge badge--neutral">{row.status}</span>
                          </td>
                          <td>{row.assignedTo?.fullName ?? <span className="muted">Unassigned</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <footer className="modal__foot modal__foot--end">
              <button type="button" className="btn btn--secondary" onClick={() => setViewing(null)}>
                Close
              </button>
              <button type="button" className="btn btn--primary" onClick={() => downloadOriginal(viewing)}>
                <Icon name="download" size={15} />
                Download original
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this import?"
        message={
          pendingDelete
            ? `"${pendingDelete.fileName}" and the ${deleteLeads} lead(s) it added will be removed from this campaign. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete import"
        confirmPhrase="delete"
        busy={deleting}
        onConfirm={confirmDelete}
        onClose={() => !deleting && setPendingDelete(null)}
      />
    </div>
  );
};

export default CampaignDetailPage;
