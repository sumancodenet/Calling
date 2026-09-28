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

  const pick = useCallback((next) => {
    setError(null);
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
  }, []);

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files?.[0] ?? null);
  };

  const upload = async (event) => {
    event.preventDefault();
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const payload = await auth.uploadCampaignLeads(campaignId, form);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
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

              <div className="row upload__actions">
                <button type="submit" className="btn btn--primary" disabled={!file || uploading}>
                  {uploading ? "Uploading..." : "Upload leads"}
                </button>
                {file ? (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      setFile(null);
                      if (inputRef.current) inputRef.current.value = "";
                    }}
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
                  <h2 className="panel__title">How this sheet is read</h2>
                </div>
              </div>
              <dl className="details">
                <div className="details__row">
                  <dt>Name</dt>
                  <dd>Name, Full Name, Contact, Lead</dd>
                </div>
                <div className="details__row">
                  <dt>Phone</dt>
                  <dd>Phone, Mobile, Mobile No, Contact Number</dd>
                </div>
                <div className="details__row">
                  <dt>Email</dt>
                  <dd>Email, E-Mail</dd>
                </div>
                <div className="details__row">
                  <dt>Other columns</dt>
                  <dd>Kept on the lead as extra</dd>
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
