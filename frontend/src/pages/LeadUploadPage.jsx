import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { auth, ApiError } from "../lib/api.js";
import Icon from "../components/Icon.jsx";
import Alert from "../components/Alert.jsx";
import Spinner from "../components/Spinner.jsx";
import { useToast } from "../components/Toast.jsx";

const ACCEPT = ".csv,.xls,.xlsx";
const MAX_BYTES = 5 * 1024 * 1024;

const formatBytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

/**
 * Import leads for a campaign from a spreadsheet.
 *
 * The file is posted as multipart to /api/campaigns/:id/leads/upload. The
 * server decides what happens to duplicates - the campaign's own
 * duplicateScope / duplicateAction settings - so this screen only reports the
 * outcome back rather than second-guessing it.
 */
export const LeadUploadPage = () => {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  // Mapping step: what the sheet actually contains, and what the admin picked.
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [previewing, setPreviewing] = useState(false);

  const reset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setMapping({});
    setError(null);
    setUploading(false);
    setPreviewing(false);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const pick = useCallback(
    (next) => {
      setError(null);
      setPreview(null);
      setMapping({});
      if (!next) return;
      const ext = next.name.toLowerCase().split(".").pop();
      if (!["csv", "xls", "xlsx"].includes(ext)) {
        setError("Only .csv, .xls and .xlsx files are accepted");
        return;
      }
      if (next.size > MAX_BYTES) {
        setError(`That file is ${formatBytes(next.size)}. The limit is ${formatBytes(MAX_BYTES)}.`);
        return;
      }
      setFile(next);

      // Read the sheet so the admin can map its columns. Nothing is imported yet.
      setPreviewing(true);
      const form = new FormData();
      form.append("file", next);
      auth
        .previewCampaignLeads(campaignId, form)
        .then((payload) => {
          setPreview(payload.data);
          // Pre-select the server's suggestion so this is a confirmation, not a
          // blank form the admin has to fill from scratch.
          setMapping(
            Object.fromEntries(payload.data.mapping.map((m) => [m.field, m.suggested ?? ""])),
          );
        })
        .catch((err) => {
          setFile(null);
          if (inputRef.current) inputRef.current.value = "";
          setError(err instanceof ApiError ? err.message : "Could not read that file.");
        })
        .finally(() => setPreviewing(false));
    },
    [campaignId],
  );

  const clearFile = () => {
    reset();
  };

  const upload = async (event) => {
    event.preventDefault();
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      // Blank fields are sent as empty strings and the server treats them as
      // "unmapped", falling back to its own suggestion for that field.
      for (const [field, column] of Object.entries(mapping)) {
        form.append(field, column ?? "");
      }

      const payload = await auth.uploadCampaignLeadsMapped(campaignId, form);
      setFile(null);
      toast.success("Leads imported", `${payload.data.created} new lead(s) added`);

      // Straight to the campaign that just received the leads. Reached from
      // either entry point - right after creating a campaign, or from an
      // existing campaign - so the destination is the same both times.
      // Replaces rather than pushes, so Back does not land on this page again.
      navigate(`/campaigns/${campaignId}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    auth
      .getCampaign(campaignId)
      .then((payload) => {
        if (!active) return;
        setCampaign(payload.data);
        setLoadError(null);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err instanceof ApiError ? err.message : "Could not load this campaign.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [campaignId]);

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files?.[0] ?? null);
  };

  if (loading) return <Spinner label="Loading campaign" />;

  if (loadError) {
    return (
      <div className="page">
        <div className="page__body">
          <Alert tone="error">{loadError}</Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page__header">
        <div className="pipeline__headtitle">
          <button
            type="button"
            className="icon-btn"
            onClick={() => navigate(-1)}
            aria-label="Back"
            title="Back"
          >
            <Icon name="chevronLeft" size={16} />
          </button>
          <div>
            <h1 className="page__title">Upload leads</h1>
            <p className="page__subtitle">
              Import a spreadsheet into <strong>{campaign?.name}</strong>.
            </p>
          </div>
        </div>
        <div className="page__actions">
          <button type="button" className="btn btn--sm" onClick={() => navigate(`/pipelines/${campaign?.pipelineId}`)}>
            Back to pipeline
          </button>
        </div>
      </header>

      <div className="page__body">
        <div className="upload">
          <section className="panel">
            <div className="panel__head">
              <div>
                <h2 className="panel__title">Spreadsheet</h2>
                <p className="panel__desc">CSV, XLS or XLSX. The first row must be a header row.</p>
              </div>
              <Icon name="file" size={18} className="muted" />
            </div>

            <form onSubmit={upload}>
              <div
                className={dragging ? "dropzone dropzone--over" : "dropzone"}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => !uploading && inputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                aria-label="Choose a file to upload"
              >
                <span className="dropzone__icon">
                  <Icon name="file" size={22} />
                </span>

                {file ? (
                  <span className="dropzone__file">
                    <strong>{file.name}</strong>
                    <span className="muted">{formatBytes(file.size)}</span>
                  </span>
                ) : (
                  <span className="dropzone__hint">
                    <strong>Drop a file here</strong> or click to browse
                    <span className="muted">Maximum {formatBytes(MAX_BYTES)}, 5000 rows per upload</span>
                  </span>
                )}

                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPT}
                  className="dropzone__input"
                  onChange={(e) => pick(e.target.files?.[0] ?? null)}
                  disabled={uploading}
                />
              </div>

              {error ? <Alert tone="error" onDismiss={() => setError(null)}>{error}</Alert> : null}

              {/* ---- mapping step ---- */}
              {previewing ? <Spinner label="Reading columns" /> : null}

              {/* Guarded on `file` as well as `preview`: clearing the file must
                  never leave the mapping block mounted with a null file. */}
              {preview && file ? (
                <div className="map">
                  <div className="map__head">
                    <div>
                      <h3 className="map__title">Map your columns</h3>
                      <p className="map__sub">
                        Tell us which column in <strong>{file?.name}</strong> is which field. We guessed what we
                        could — change anything that looks wrong.
                      </p>
                    </div>
                    <span className="badge badge--neutral">{preview.totalRows} rows</span>
                  </div>

                  <div className="map__fields">
                    {preview.mapping.map((m) => (
                      <div className="field" key={m.field}>
                        <label htmlFor={`map-${m.field}`}>{m.label}</label>
                        <select
                          id={`map-${m.field}`}
                          className="input"
                          value={mapping[m.field] ?? ""}
                          onChange={(e) => setMapping((prev) => ({ ...prev, [m.field]: e.target.value }))}
                          disabled={uploading}
                        >
                          <option value="">Do not import</option>
                          {preview.headers.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                        {m.hint ? <span className="field__hint">{m.hint}</span> : null}
                      </div>
                    ))}
                  </div>

                  <details className="map__sample">
                    <summary>Preview first {preview.sampleRows.length} rows</summary>
                    <div className="table-wrap map__table">
                      <table className="table">
                        <thead>
                          <tr>
                            {preview.headers.map((header) => (
                              <th key={header}>{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.sampleRows.map((row, i) => (
                            <tr key={i}>
                              {row.map((cell, j) => (
                                <td key={j} className="table__truncate">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </div>
              ) : null}

              <div className="row upload__actions">
                <button type="submit" className="btn btn--primary" disabled={!file || uploading || previewing}>
                  {uploading ? "Importing..." : previewing ? "Reading file..." : "Proceed with import"}
                </button>
                {file ? (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={clearFile}
                    disabled={uploading}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <aside className="upload__side">
            <section className="panel">
              <div className="panel__head">
                <div>
                  <h2 className="panel__title">About the import</h2>
                </div>
              </div>
              <dl className="details">
                <div className="details__row">
                  <dt>Mapped fields</dt>
                  <dd>Name, Phone, Email, City</dd>
                </div>
                <div className="details__row">
                  <dt>Columns you skip</dt>
                  <dd>Kept on the lead as extra</dd>
                </div>
                <div className="details__row">
                  <dt>Duplicates</dt>
                  <dd>
                    {campaign?.duplicateScope?.toLowerCase()} scope,{" "}
                    {campaign?.duplicateAction?.toLowerCase()} when found
                  </dd>
                </div>
                <div className="details__row">
                  <dt>Leads land in</dt>
                  <dd>The first stage of the pipeline</dd>
                </div>
              </dl>
              <div className="notice" style={{ marginTop: "var(--sp-4)" }}>
                <Icon name="info" size={15} />
                <span>
                  Duplicates are handled by this campaign&apos;s own settings:{" "}
                  <strong>{campaign?.duplicateScope?.toLowerCase()}</strong> scope,{" "}
                  <strong>{campaign?.duplicateAction?.toLowerCase()}</strong> when found. Leads land in the first
                  stage.
                </span>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default LeadUploadPage;
