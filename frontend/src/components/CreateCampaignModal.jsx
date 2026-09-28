import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { auth, ApiError } from "../lib/api.js";
import { usePipelines } from "../context/PipelineContext.jsx";
import Icon from "./Icon.jsx";
import Alert from "./Alert.jsx";
import Spinner from "./Spinner.jsx";

/**
 * Create campaign.
 *
 * Dropdown options are not hardcoded: the pipeline list comes from the shared
 * pipeline context (so it reflects what an admin has actually added), and the
 * manager / agent lists plus the enum labels come from /api/campaigns/options.
 *
 * "Additional settings" is a disclosure rather than extra always-visible fields,
 * because most campaigns never change them.
 */
export const CreateCampaignModal = ({ open, defaultPipelineId, onClose, onCreated }) => {
  const { pipelines } = usePipelines();

  const [options, setOptions] = useState(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState(null);

  const [form, setForm] = useState({
    name: "",
    pipelineId: "",
    managerId: "",
    agentIds: [],
    leadDistribution: "EQUAL",
    priority: 3,
    duplicateScope: "CAMPAIGN",
    duplicateAction: "IGNORE",
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [agentsOpen, setAgentsOpen] = useState(false);
  const agentsRootRef = useRef(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const reset = useCallback(() => {
    setForm({
      name: "",
      pipelineId: defaultPipelineId ? String(defaultPipelineId) : "",
      managerId: "",
      agentIds: [],
      leadDistribution: "EQUAL",
      priority: 3,
      duplicateScope: "CAMPAIGN",
      duplicateAction: "IGNORE",
    });
    setShowAdvanced(false);
    setAgentsOpen(false);
    setErrors({});
    setError(null);
    setBusy(false);
  }, [defaultPipelineId]);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  // Dropdown data is only needed while the dialog is open.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingOptions(true);
    auth
      .campaignOptions()
      .then((payload) => {
        if (!active) return;
        setOptions(payload.data);
        setOptionsError(null);
      })
      .catch((err) => {
        if (!active) return;
        setOptionsError(err instanceof ApiError ? err.message : "Could not load campaign options.");
      })
      .finally(() => {
        if (active) setLoadingOptions(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) {
        // Escape closes the agent list first, then the whole dialog.
        if (agentsOpen) setAgentsOpen(false);
        else onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose, agentsOpen]);

  // Outside click closes the agent list.
  useEffect(() => {
    if (!agentsOpen) return;
    const onPointerDown = (event) => {
      if (agentsRootRef.current && !agentsRootRef.current.contains(event.target)) setAgentsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [agentsOpen]);

  if (!open) return null;

  const set = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const toggleAgent = (id) => {
    setForm((prev) => ({
      ...prev,
      agentIds: prev.agentIds.includes(id) ? prev.agentIds.filter((x) => x !== id) : [...prev.agentIds, id],
    }));
    setErrors((prev) => ({ ...prev, agentIds: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Campaign name is required";
    if (!form.pipelineId) next.pipelineId = "Select a pipeline";
    if (!form.managerId) next.managerId = "Select a campaign manager";
    if (form.agentIds.length === 0) next.agentIds = "Select at least one agent";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setBusy(true);
    setError(null);
    try {
      const payload = await auth.createCampaign({
        name: form.name.trim(),
        pipelineId: Number(form.pipelineId),
        managerId: Number(form.managerId),
        agentIds: form.agentIds,
        leadDistribution: form.leadDistribution,
        priority: Number(form.priority),
        duplicateScope: form.duplicateScope,
        duplicateAction: form.duplicateAction,
      });
      onCreated?.(payload.data);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        const next = {};
        for (const detail of Array.isArray(err.details) ? err.details : []) {
          const key = String(detail.field ?? "").split(".").pop();
          if (key) next[key] = detail.message;
        }
        setErrors(next);
      } else {
        setError("Unexpected error. Please try again.");
      }
      setBusy(false);
    }
  };

  const distributions = options?.leadDistributions ?? [
    { value: "ON_DEMAND", label: "On Demand", description: "Agents can manually claim leads" },
    { value: "EQUAL", label: "Equal", description: "Leads distributed equally among agents" },
    { value: "CONDITIONAL", label: "Conditional", description: "Smart distribution based on rules" },
  ];
  const scopes = options?.duplicateScopes ?? [
    { value: "GLOBAL", label: "Global" },
    { value: "CAMPAIGN", label: "This campaign" },
  ];
  const actions = options?.duplicateActions ?? [
    { value: "IGNORE", label: "Ignore" },
    { value: "MERGE", label: "Merge" },
    { value: "ALLOW", label: "Allow" },
  ];
  const priorityRange = options?.priority ?? { min: 1, max: 5 };

  const managers = options?.managers ?? [];
  const agents = options?.agents ?? [];

  // Rendered into <body> on purpose. .page carries a transform-filling animation
  // (rise-in), and a transformed ancestor becomes the containing block for any
  // position:fixed descendant - which pinned this dialog to the page card
  // instead of the viewport.
  return createPortal(
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-campaign-title"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="modal__panel modal__panel--lg">
        <header className="modal__head">
          <div>
            <h2 className="modal__title" id="create-campaign-title">
              Create campaign
            </h2>
            <p className="modal__desc">Set up how leads are handed to your agents.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close">
            <Icon name="x" size={17} />
          </button>
        </header>

        {error ? (
          <div style={{ padding: "16px 24px 0" }}>
            <Alert tone="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          </div>
        ) : null}

        {loadingOptions ? (
          <Spinner label="Loading options" />
        ) : optionsError ? (
          <div className="modal__body">
            <Alert tone="error" onDismiss={onClose}>
              {optionsError}
            </Alert>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="modal__body cc-body">
              <div className="cc-grid">
                <div className="field">
                  <label htmlFor="cc-name">
                    Campaign name<span className="field__required">*</span>
                  </label>
                  <input
                    id="cc-name"
                    className="input"
                    placeholder="Telecalling Q1"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    aria-invalid={Boolean(errors.name)}
                    disabled={busy}
                  />
                  {errors.name ? <span className="field__error">{errors.name}</span> : null}
                </div>

                <div className="field">
                  <label htmlFor="cc-pipeline">
                    Select pipeline<span className="field__required">*</span>
                  </label>
                  <select
                    id="cc-pipeline"
                    className="input"
                    value={form.pipelineId}
                    onChange={(e) => set("pipelineId", e.target.value)}
                    aria-invalid={Boolean(errors.pipelineId)}
                    disabled={busy}
                  >
                    <option value="">Choose a pipeline</option>
                    {pipelines.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {errors.pipelineId ? (
                    <span className="field__error">{errors.pipelineId}</span>
                  ) : pipelines.length === 0 ? (
                    <span className="field__hint">No pipelines yet. Add one from Settings first.</span>
                  ) : null}
                </div>

                <div className="field">
                  <label htmlFor="cc-manager">
                    Who will be managing this campaign<span className="field__required">*</span>
                  </label>
                  <select
                    id="cc-manager"
                    className="input"
                    value={form.managerId}
                    onChange={(e) => set("managerId", e.target.value)}
                    aria-invalid={Boolean(errors.managerId)}
                    disabled={busy}
                  >
                    <option value="">Choose a manager</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} - {m.role}
                      </option>
                    ))}
                  </select>
                  {errors.managerId ? <span className="field__error">{errors.managerId}</span> : null}
                </div>

                <div className="field">
                  <label>Lead distribution</label>
                  {/* Stacked rather than side by side: the descriptions are long
                      enough that three columns wrapped them to three lines. */}
                  <div className="cc-choice" role="radiogroup" aria-label="Lead distribution">
                    {distributions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={form.leadDistribution === option.value}
                        className={
                          form.leadDistribution === option.value ? "cc-choice__box cc-choice__box--on" : "cc-choice__box"
                        }
                        onClick={() => set("leadDistribution", option.value)}
                        disabled={busy}
                      >
                        <span className="cc-choice__tick" aria-hidden="true" />
                        <span className="cc-choice__text">
                          <span className="cc-choice__label">{option.label}</span>
                          {option.description ? (
                            <span className="cc-choice__desc">{option.description}</span>
                          ) : null}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="field">
                <label htmlFor="cc-agents-trigger">
                  Select agents<span className="field__required">*</span>
                </label>
                <div className="cc-multi" ref={agentsRootRef}>
                  <button
                    id="cc-agents-trigger"
                    type="button"
                    className={errors.agentIds ? "cc-multi__trigger cc-multi__trigger--invalid" : "cc-multi__trigger"}
                    onClick={() => setAgentsOpen((prev) => !prev)}
                    aria-haspopup="listbox"
                    aria-expanded={agentsOpen}
                    disabled={busy}
                  >
                    <span className={form.agentIds.length ? "cc-multi__value" : "cc-multi__placeholder"}>
                      {form.agentIds.length === 0
                        ? "Select agents"
                        : form.agentIds
                            .map((id) => agents.find((a) => a.id === id)?.fullName)
                            .filter(Boolean)
                            .join(", ")}
                    </span>
                    <span className="cc-multi__chev" aria-hidden="true">
                      <Icon name="chevronRight" size={14} />
                    </span>
                  </button>

                  {agentsOpen ? (
                    <div className="cc-multi__panel" role="listbox" aria-multiselectable="true">
                      {agents.length === 0 ? (
                        <span className="cc-multi__empty">No active members to assign.</span>
                      ) : (
                        <>
                          {agents.map((agent) => {
                            const on = form.agentIds.includes(agent.id);
                            return (
                              <button
                                key={agent.id}
                                type="button"
                                role="option"
                                aria-selected={on}
                                className={on ? "cc-multi__option cc-multi__option--on" : "cc-multi__option"}
                                onClick={() => toggleAgent(agent.id)}
                                disabled={busy}
                              >
                                <span className="cc-multi__tick" aria-hidden="true">
                                  <Icon name="check" size={13} />
                                </span>
                                <span className="cc-multi__name">{agent.fullName}</span>
                                <span className="cc-multi__role">{agent.role}</span>
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            className="cc-multi__clear"
                            onClick={() => set("agentIds", [])}
                            disabled={busy || form.agentIds.length === 0}
                          >
                            Clear selection
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
                {errors.agentIds ? <span className="field__error">{errors.agentIds}</span> : null}
              </div>

              <div className="cc-advanced">
                <button
                  type="button"
                  className="cc-advanced__toggle"
                  onClick={() => setShowAdvanced((prev) => !prev)}
                  aria-expanded={showAdvanced}
                  aria-controls="cc-advanced-body"
                >
                  <Icon name="settings" size={15} />
                  <span className="cc-advanced__label">Additional settings</span>
                  <span className="cc-advanced__hint">Priority, lead duplicacy</span>
                  <span className={showAdvanced ? "cc-advanced__chev" : "cc-advanced__chev cc-advanced__chev--open"}>
                    <Icon name="chevronRight" size={14} />
                  </span>
                </button>

                {showAdvanced ? (
                  <div className="cc-advanced__body" id="cc-advanced-body">
                    <div className="field">
                      <label htmlFor="cc-priority">Priority</label>
                      <select
                        id="cc-priority"
                        className="input"
                        value={form.priority}
                        onChange={(e) => set("priority", e.target.value)}
                        disabled={busy}
                      >
                        {Array.from(
                          { length: priorityRange.max - priorityRange.min + 1 },
                          (_, i) => priorityRange.min + i,
                        ).map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label htmlFor="cc-scope">Lead duplicacy - check for duplicates</label>
                      <select
                        id="cc-scope"
                        className="input"
                        value={form.duplicateScope}
                        onChange={(e) => set("duplicateScope", e.target.value)}
                        disabled={busy}
                      >
                        {scopes.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label htmlFor="cc-action">If duplicate found</label>
                      <select
                        id="cc-action"
                        className="input"
                        value={form.duplicateAction}
                        onChange={(e) => set("duplicateAction", e.target.value)}
                        disabled={busy}
                      >
                        {actions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <footer className="modal__foot modal__foot--end">
              <button type="button" className="btn btn--secondary" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={busy}>
                {busy ? "Creating..." : "Create campaign"}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default CreateCampaignModal;
