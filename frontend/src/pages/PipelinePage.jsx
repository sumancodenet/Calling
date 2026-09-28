import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { auth, ApiError } from "../lib/api.js";
import { usePipelines } from "../context/PipelineContext.jsx";
import Icon from "../components/Icon.jsx";
import Alert from "../components/Alert.jsx";
import Spinner from "../components/Spinner.jsx";
import EmptyState from "../components/EmptyState.jsx";
import StageFunnel from "../components/StageFunnel.jsx";
import CreateCampaignModal from "../components/CreateCampaignModal.jsx";
import { useToast } from "../components/Toast.jsx";

/**
 * Read-only view of one pipeline: the lead funnel across all of its campaigns,
 * plus the campaigns themselves.
 *
 * Deals are not modelled yet, so the stage columns stay empty - this page is the
 * shell they will render into.
 */
export const PipelinePage = () => {
  const { pipelineId } = useParams();
  const navigate = useNavigate();
  const { refresh } = usePipelines();
  const toast = useToast();

  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignsLoadingMore, setCampaignsLoadingMore] = useState(false);
  const [campaignsError, setCampaignsError] = useState(null);
  const [campaignPage, setCampaignPage] = useState(1);
  const [campaignHasMore, setCampaignHasMore] = useState(false);
  const sentinelRef = useRef(null);
  const requestSeq = useRef(0);

  const CAMPAIGN_PAGE_SIZE = 5;

  const loadCampaigns = useCallback(
    async ({ append = false } = {}) => {
      const page = append ? campaignPage + 1 : 1;

      if (append) setCampaignsLoadingMore(true);
      else setCampaignsLoading(true);

      try {
        const payload = await auth.listCampaigns({ pipelineId, page, limit: CAMPAIGN_PAGE_SIZE });
        const items = payload.data ?? [];
        setCampaigns((prev) => (append ? [...prev, ...items] : items));
        setCampaignPage(page);
        setCampaignHasMore(Boolean(payload.meta?.hasMore));
        setCampaignsError(null);
      } catch (err) {
        if (!append) {
          setCampaigns([]);
          setCampaignError(err instanceof ApiError ? err.message : "Could not load campaigns.");
        }
      } finally {
        setCampaignsLoading(false);
        setCampaignsLoadingMore(false);
      }
    },
    [pipelineId, campaignPage],
  );

  useEffect(() => {
    loadCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineId]);

  // Infinite scroll: fetch the next page when the sentinel scrolls into view.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || campaignHasMore === null) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && campaignHasMore && !campaignsLoading && !campaignsLoadingMore) {
          loadCampaigns({ append: true });
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [campaignHasMore, campaignsLoading, campaignsLoadingMore, loadCampaigns]);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const payload = await auth.getPipeline(pipelineId);
      if (seq !== requestSeq.current) return;
      setPipeline(payload.data);
      setError(null);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setPipeline(null);
      setError(err instanceof ApiError ? err.message : "Could not load this pipeline.");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner label="Loading pipeline" />;

  if (error) {
    return (
      <div className="stack stack--lg">
        <Alert tone="error">{error}</Alert>
        <button type="button" className="btn" onClick={() => navigate("/")}>
          Back to overview
        </button>
      </div>
    );
  }

  if (!pipeline) return null;

  return (
    <div className="page">
      <header className="page__header page__header--row">
        <div className="pipeline__headtitle">
          {/* Icon-only, so it carries its own accessible name and tooltip. */}
          <button
            type="button"
            className="icon-btn"
            onClick={() => navigate(-1)}
            aria-label="Back"
            title="Back"
          >
            <Icon name="chevronLeft" size={16} />
          </button>
          <h1 className="page__title">Pipeline</h1>
        </div>

        {/* Placeholder actions: the leads, calls and campaign data models do not
            exist yet, so these are inert until their endpoints are built. */}
        <div className="page__actions">
          <button type="button" className="btn btn--sm">
            <Icon name="trending" size={14} />
            Lead summary
          </button>
          <button type="button" className="btn btn--sm">
            <Icon name="file" size={14} />
            CSV upload
          </button>
          <button type="button" className="btn btn--sm">
            <Icon name="phone" size={14} />
            Call logs
          </button>
          <button type="button" className="btn btn--sm btn--primary" onClick={() => setCreatingCampaign(true)}>
            <Icon name="plus" size={14} />
            Create campaign
          </button>
          <div className="input-affix pipeline__search">
            <span className="input-affix__icon">
              <Icon name="search" size={14} />
            </span>
            <input
              className="input"
              type="search"
              placeholder="Search campaign"
              aria-label="Search campaign"
            />
          </div>
        </div>
      </header>

      <div className="page__body">
        <div className="pipeline-layout">
          <div className="pipeline-layout__main">
            {/* The stage cards were replaced by the funnel report: it covers the
                same stages but shows the actual lead numbers across every
                campaign in this pipeline. */}
            <StageFunnel pipelineId={pipeline?.id} />

            <div className="row">
              <button type="button" className="btn" onClick={refresh}>
                Refresh
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => navigate("/settings/pipeline")}>
                Manage stages
              </button>
            </div>
          </div>

          <aside className="pipeline-layout__side">
            <section className="panel">
              <div className="panel__head">
                <div>
                  <h2 className="panel__title">Campaigns</h2>
                  <p className="panel__desc">Running against this pipeline.</p>
                </div>
                {campaigns.length > 0 ? <span className="badge badge--neutral">{campaigns.length}</span> : null}
              </div>

              {campaignsLoading ? (
                <Spinner label="Loading campaigns" />
              ) : campaignsError ? (
                <Alert tone="error">{campaignsError}</Alert>
              ) : campaigns.length === 0 ? (
                <EmptyState
                  icon="zap"
                  title="No campaigns yet"
                  text="Create a campaign to start handing leads to your agents."
                />
              ) : (
                <ul className="camp-list">
                  {campaigns.map((campaign) => (
                    <li key={campaign.id}>
                      <button
                        type="button"
                        className="camp camp--click"
                        onClick={() => navigate(`/campaigns/${campaign.id}`)}
                      >
                        <div className="camp__head">
                          <span className="camp__name">{campaign.name}</span>
                          <span className="camp__prio" title={`Priority ${campaign.priority} of 5`}>
                            P{campaign.priority}
                          </span>
                        </div>

                        <div className="camp__meta">
                          <span className={campaign.Status === "ACTIVE" ? "badge badge--ok" : "badge badge--neutral"}>
                            {campaign.Status}
                          </span>
                          <span className="camp__tag">{campaign.leadDistribution.replace(/_/g, " ").toLowerCase()}</span>
                        </div>

                        <div className="camp__foot">
                          <span className="camp__owner">{campaign.manager?.fullName ?? "Unassigned"}</span>
                          <span className="camp__agents">
                            <Icon name="users" size={12} /> {campaign.agentCount}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Observed by IntersectionObserver to pull the next page. */}
              {campaigns.length > 0 ? (
                <div ref={sentinelRef} className="camp-more">
                  {campaignsLoadingMore ? <span className="muted">Loading more...</span> : null}
                  {!campaignHasMore ? <span className="muted">All campaigns shown</span> : null}
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      </div>

      <CreateCampaignModal
        open={creatingCampaign}
        defaultPipelineId={pipeline?.id}
        onClose={() => setCreatingCampaign(false)}
        onCreated={(campaign) => {
          toast.success("Campaign created", `${campaign.name} is ready. Add your leads next.`);
          // Straight to the import step - a campaign with no leads cannot do anything.
          navigate(`/campaigns/${campaign.id}/leads/upload`);
        }}
      />
    </div>
  );
};

export default PipelinePage;
