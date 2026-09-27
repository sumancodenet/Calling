import { asyncHandler } from "../../../utils/asyncHandler.js";
import { sendSuccess, sendCreated } from "../../../utils/response.js";
import {
  listPipelines,
  getPipeline,
  createPipeline,
  updatePipeline,
  deletePipeline,
  createStage,
  getStage,
  updateStage,
  deleteStage,
  createTag,
  updateTag,
  deleteTag,
} from "./pipeline.service.js";

const meta = (data) => ({ count: Array.isArray(data) ? data.length : 1 });

export const listController = asyncHandler(async (req, res) => {
  const data = await listPipelines({ tenantId: req.tenantId, query: req.query });
  return sendSuccess(res, { message: "Pipelines retrieved", data, meta: meta(data) });
});

export const getController = asyncHandler(async (req, res) => {
  return sendSuccess(res, { data: await getPipeline({ tenantId: req.tenantId, id: req.params.pipelineId }) });
});

export const createController = asyncHandler(async (req, res) => {
  const data = await createPipeline({ tenantId: req.tenantId, body: req.body });
  return sendCreated(res, { message: "Pipeline created", data });
});

export const updateController = asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    message: "Pipeline updated",
    data: await updatePipeline({ tenantId: req.tenantId, id: req.params.pipelineId, body: req.body }),
  });
});

export const deleteController = asyncHandler(async (req, res) => {
  const data = await deletePipeline({ tenantId: req.tenantId, id: req.params.pipelineId });
  return sendSuccess(res, { message: `Deleted ${data.name}`, data });
});

// ---- stages ----

export const createStageController = asyncHandler(async (req, res) => {
  const data = await createStage({
    tenantId: req.tenantId,
    pipelineId: req.params.pipelineId,
    body: req.body,
  });
  return sendCreated(res, { message: "Stage created", data });
});

export const getStageController = asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    data: await getStage({
      tenantId: req.tenantId,
      pipelineId: req.params.pipelineId,
      stageId: req.params.stageId,
    }),
  });
});

export const updateStageController = asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    message: "Stage updated",
    data: await updateStage({
      tenantId: req.tenantId,
      pipelineId: req.params.pipelineId,
      stageId: req.params.stageId,
      body: req.body,
    }),
  });
});

export const deleteStageController = asyncHandler(async (req, res) => {
  const data = await deleteStage({
    tenantId: req.tenantId,
    pipelineId: req.params.pipelineId,
    stageId: req.params.stageId,
  });
  return sendSuccess(res, { message: `Deleted stage ${data.name}`, data });
});

// ---- tags ----

export const createTagController = asyncHandler(async (req, res) => {
  const data = await createTag({
    tenantId: req.tenantId,
    pipelineId: req.params.pipelineId,
    stageId: req.params.stageId,
    body: req.body,
  });
  return sendCreated(res, { message: "Tag created", data });
});

export const updateTagController = asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    message: "Tag updated",
    data: await updateTag({
      tenantId: req.tenantId,
      pipelineId: req.params.pipelineId,
      stageId: req.params.stageId,
      tagId: req.params.tagId,
      body: req.body,
    }),
  });
});

export const deleteTagController = asyncHandler(async (req, res) => {
  const data = await deleteTag({
    tenantId: req.tenantId,
    pipelineId: req.params.pipelineId,
    stageId: req.params.stageId,
    tagId: req.params.tagId,
  });
  return sendSuccess(res, { message: `Deleted tag ${data.name}`, data });
});
