import { useCallback, useEffect, useRef, useState } from "react";
import { auth, ApiError } from "../../lib/api.js";
import Icon from "../../components/Icon.jsx";
import Alert from "../../components/Alert.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import FormModal from "../../components/FormModal.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import KebabMenu from "../../components/KebabMenu.jsx";
import { useToast } from "../../components/Toast.jsx";
import { usePipelines } from "../../context/PipelineContext.jsx";

const TERMINAL = { isWon: "Won", isLost: "Lost" };

const PIPELINE_FIELDS = (initial) => [
  { name: "name", label: "Name", required: true, span: true, placeholder: "Real Estate Sales", initial: initial?.name ?? "" },
  { name: "description", label: "Description", type: "textarea", span: true, placeholder: "What this pipeline is for", initial: initial?.description ?? "" },
  { name: "isDefault", label: "Set as the default pipeline", type: "checkbox", span: true, initial: Boolean(initial?.isDefault) },
];

const STAGE_FIELDS = (initial) => [
  { name: "name", label: "Stage name", required: true, span: true, placeholder: "Fresh Enquiry", initial: initial?.name ?? "" },
  { name: "description", label: "Description", span: true, placeholder: "Optional", initial: initial?.description ?? "" },
  {
    name: "probability",
    label: "Probability",
    type: "number",
    placeholder: "0-100",
    hint: "Used for forecasting.",
    initial: initial?.probability ?? "",
  },
  { name: "color", label: "Colour", type: "color", initial: initial?.color ?? "#6366f1" },
  { name: "isWon", label: "Winning stage (closes deals)", type: "checkbox", span: true, initial: Boolean(initial?.isWon) },
  { name: "isLost", label: "Losing stage (closes deals)", type: "checkbox", span: true, initial: Boolean(initial?.isLost) },
];

const TAG_FIELDS = (initial) => [
  { name: "name", label: "Tag name", required: true, span: true, placeholder: "Hot lead", initial: initial?.name ?? "" },
  { name: "color", label: "Colour", type: "color", initial: initial?.color ?? "#05945a" },
];

export const PipelineTab = () => {
  const toast = useToast();
  const { refresh: refreshPipelines } = usePipelines();
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const requestSeq = useRef(0);

  const [pipelineModal, setPipelineModal] = useState(null); // { mode, pipeline }
  const [stageModal, setStageModal] = useState(null); // { mode, stage }
  const [tagModal, setTagModal] = useState(null); // { mode, stage, tag }
  const [confirm, setConfirm] = useState(null); // { kind, target, title, message }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async ({ keepSelection = true } = {}) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const payload = await auth.listPipelines();
      if (seq !== requestSeq.current) return;
      setRows(payload.data);
      setError(null);
      setSelectedId((prev) => {
        if (keepSelection && prev && payload.data.some((p) => p.id === prev)) return prev;
        return payload.data[0]?.id ?? null;
      });
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err instanceof ApiError ? err.message : "Could not load pipelines.");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load({ keepSelection: false });
  }, [load]);

  const selected = rows.find((p) => p.id === selectedId) ?? null;

  // After any mutation the sidebar must follow along, so the shared list that
  // feeds it is refreshed alongside this tab's own data.
  const refresh = () => {
    load();
    refreshPipelines();
  };

  const runDelete = async () => {
    setBusy(true);
    try {
      if (confirm.kind === "pipeline") {
        const res = await auth.deletePipeline(confirm.target.id);
        toast.success("Pipeline deleted", `${res.data.name} and ${res.data.stagesRemoved} stage(s) removed`);
        setSelectedId(null);
      } else if (confirm.kind === "stage") {
        const res = await auth.deleteStage(confirm.target.pipelineId, confirm.target.id);
        toast.success("Stage deleted", res.data.name);
      } else {
        const res = await auth.deleteTag(confirm.target.pipelineId, confirm.target.stageId, confirm.target.id);
        toast.success("Tag deleted", res.data.name);
      }
      setConfirm(null);
      refresh();
    } catch (err) {
      toast.error("Could not delete", err instanceof ApiError ? err.message : "Unexpected error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (loading && rows.length === 0) {
    return (
      <div className="pipeline">
        <div className="panel skeleton-panel" />
      </div>
    );
  }

  return (
    <div className="pipeline">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <aside className="pipeline__list panel panel--flush">
        <div className="pipeline__list-head">
          <h2 className="pipeline__list-title">Pipelines</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setPipelineModal({ mode: "create" })}
            aria-label="Add pipeline"
            title="Add pipeline"
          >
            <Icon name="plus" size={16} />
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="pipeline__list-empty">
            <span className="muted">No pipelines yet</span>
          </div>
        ) : (
          rows.map((pipeline) => (
            <button
              key={pipeline.id}
              type="button"
              className={pipeline.id === selectedId ? "pipeline__item pipeline__item--active" : "pipeline__item"}
              onClick={() => setSelectedId(pipeline.id)}
            >
              <span className="pipeline__item-name">{pipeline.name}</span>
              <span className="pipeline__item-meta">
                {pipeline.stageCount} {pipeline.stageCount === 1 ? "stage" : "stages"}
                {pipeline.isDefault ? <span className="badge badge--brand">Default</span> : null}
                {pipeline.Status === "ARCHIVED" ? <span className="badge badge--neutral">Archived</span> : null}
              </span>
            </button>
          ))
        )}
      </aside>

      <section className="pipeline__detail">
        {!selected ? (
          <div className="panel panel--flush">
            <EmptyState
              icon="layers"
              title="No pipeline selected"
              text="Create a pipeline, then add the stages a record moves through."
              action={
                <button type="button" className="btn btn--primary" onClick={() => setPipelineModal({ mode: "create" })}>
                  <Icon name="plus" size={16} />
                  New pipeline
                </button>
              }
            />
          </div>
        ) : (
          <>
            <div className="panel">
              <div className="panel__head">
                <div style={{ minWidth: 0 }}>
                  <h2 className="panel__title">{selected.name}</h2>
                  <p className="panel__desc">{selected.description || "No description"}</p>
                </div>
                <div className="row">
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => setPipelineModal({ mode: "edit", pipeline: selected })}
                  >
                    <Icon name="file" size={15} />
                    Edit
                  </button>
                  <KebabMenu
                    label={`Actions for ${selected.name}`}
                    items={[
                      {
                        key: "delete",
                        label: "Delete pipeline",
                        icon: "alert",
                        tone: "danger",
                        onSelect: () =>
                          setConfirm({
                            kind: "pipeline",
                            target: selected,
                            title: "Delete this pipeline?",
                            message: `"${selected.name}" and its ${selected.stageCount} stage(s) will be removed. Records already in this pipeline keep their data but lose their stage reference.`,
                          }),
                      },
                    ]}
                  />
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel__head">
                <div>
                  <h2 className="panel__title">Stages</h2>
                  <p className="panel__desc">The steps a record moves through, in order.</p>
                </div>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => setStageModal({ mode: "create" })}
                >
                  <Icon name="plus" size={15} />
                  Add stage
                </button>
              </div>

              <ol className="stages">
                {selected.stages.map((stage) => (
                  <li className="stage" key={stage.id}>
                    <span className="stage__index tabular">{stage.position + 1}</span>
                    <span className="stage__dot" style={{ background: stage.color ?? "var(--brand-500)" }} aria-hidden="true" />
                    <div className="stage__text">
                      <span className="stage__name">{stage.name}</span>
                      <span className="stage__meta">
                        {stage.probability !== null ? `${stage.probability}% probability` : "No probability"}
                        {stage.isWon ? <span className="badge badge--ok">{TERMINAL.isWon}</span> : null}
                        {stage.isLost ? <span className="badge badge--danger">{TERMINAL.isLost}</span> : null}
                      </span>
                    </div>

                    <div className="stage__tags">
                      {stage.tags.map((tag) => (
                        <span
                          className="chiptag"
                          key={tag.id}
                          style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
                          title="Double-click to edit"
                          onDoubleClick={() => setTagModal({ mode: "edit", stage, tag })}
                        >
                          {tag.name}
                          <button
                            type="button"
                            onClick={() => setTagModal({ mode: "edit", stage, tag })}
                            aria-label={`Edit tag ${tag.name}`}
                          >
                            <Icon name="x" size={11} />
                          </button>
                        </span>
                      ))}
                      <button
                        type="button"
                        className="chiptag chiptag--add"
                        onClick={() => setTagModal({ mode: "create", stage })}
                      >
                        <Icon name="plus" size={11} /> Tag
                      </button>
                    </div>

                    <KebabMenu
                      label={`Actions for ${stage.name}`}
                      items={[
                        { key: "edit", label: "Edit stage", icon: "file", onSelect: () => setStageModal({ mode: "edit", stage }) },
                        {
                          key: "delete",
                          label: "Delete stage",
                          icon: "alert",
                          tone: "danger",
                          onSelect: () =>
                            setConfirm({
                              kind: "stage",
                              target: { ...stage, pipelineId: selected.id },
                              title: "Delete this stage?",
                              message: `"${stage.name}" and its ${stage.tags.length} tag(s) will be removed. A pipeline must keep at least one stage.`,
                            }),
                        },
                      ]}
                    />
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
      </section>

      <FormModal
        open={Boolean(pipelineModal)}
        title={pipelineModal?.mode === "edit" ? "Edit pipeline" : "New pipeline"}
        description={
          pipelineModal?.mode === "edit"
            ? "Rename it, or make it the default for this workspace."
            : "A pipeline is a named flow, e.g. Real Estate Sales. You will add its stages next."
        }
        fields={PIPELINE_FIELDS(pipelineModal?.pipeline)}
        submitLabel={pipelineModal?.mode === "edit" ? "Save changes" : "Create pipeline"}
        onClose={() => setPipelineModal(null)}
        onSubmit={async (values) => {
          if (pipelineModal.mode === "edit") {
            const res = await auth.updatePipeline(pipelineModal.pipeline.id, values);
            toast.success("Pipeline updated", res.data.name);
          } else {
            const res = await auth.createPipeline(values);
            toast.success("Pipeline created", res.data.name);
            setSelectedId(res.data.id);
          }
          refresh();
        }}
      />

      <FormModal
        open={Boolean(stageModal)}
        title={stageModal?.mode === "edit" ? "Edit stage" : "New stage"}
        description={selected ? `Adds a step to "${selected.name}".` : undefined}
        fields={STAGE_FIELDS(stageModal?.stage)}
        submitLabel={stageModal?.mode === "edit" ? "Save changes" : "Add stage"}
        onClose={() => setStageModal(null)}
        onSubmit={async (values) => {
          const payload = {
            ...values,
            probability: values.probability === "" ? null : Number(values.probability),
          };
          if (stageModal.mode === "edit") {
            await auth.updateStage(selected.id, stageModal.stage.id, payload);
            toast.success("Stage updated", payload.name);
          } else {
            await auth.createStage(selected.id, payload);
            toast.success("Stage added", payload.name);
          }
          refresh();
        }}
      />

      <FormModal
        open={Boolean(tagModal)}
        title={tagModal?.mode === "edit" ? "Edit tag" : "New tag"}
        description={tagModal?.stage ? `Tags available on "${tagModal.stage.name}".` : undefined}
        fields={TAG_FIELDS(tagModal?.tag)}
        submitLabel={tagModal?.mode === "edit" ? "Save changes" : "Add tag"}
        onClose={() => setTagModal(null)}
        onSubmit={async (values) => {
          if (tagModal.mode === "edit") {
            await auth.updateTag(selected.id, tagModal.stage.id, tagModal.tag.id, values);
          } else {
            await auth.createTag(selected.id, tagModal.stage.id, values);
          }
          refresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmLabel="Delete"
        confirmPhrase="delete"
        busy={busy}
        onConfirm={runDelete}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
};

export default PipelineTab;
