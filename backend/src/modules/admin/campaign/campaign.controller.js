import {
  createCampaign,
  listCampaigns,
  getCampaign,
  deleteCampaign,
  listManagers,
  listAssignableAgents,
  updateCampaignStatus,
} from "./campaign.service.js";
import { sendSuccess, sendCreated } from "../../../utils/response.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { PRIORITY_MIN, PRIORITY_MAX } from "./campaign.model.js";

export const listController = asyncHandler(async (req, res) => {
  const { items, meta } = await listCampaigns({
    tenantId: req.tenantId,
    pipelineId: req.query.pipelineId,
    page: req.query.page,
    limit: req.query.limit,
  });
  return sendSuccess(res, { message: "Campaign list", data: items, meta });
});

export const createController = asyncHandler(async (req, res) => {
  const campaign = await createCampaign({ tenantId: req.tenantId, body: req.body });
  return sendCreated(res, { message: "Campaign created successfully", data: campaign });
});

export const getController = asyncHandler(async (req, res) => {
  const campaign = await getCampaign({ tenantId: req.tenantId, id: req.params.id });
  return sendSuccess(res, { data: campaign });
});

export const updateStatusController = asyncHandler(async (req, res) => {
  const campaign = await updateCampaignStatus({
    tenantId: req.tenantId,
    id: req.params.id,
    Status: req.body.Status,
  });
  return sendSuccess(res, { message: "Campaign updated", data: campaign });
});

export const deleteController = asyncHandler(async (req, res) => {
  const result = await deleteCampaign({ tenantId: req.tenantId, id: req.params.id });
  return sendSuccess(res, { message: "Campaign deleted", data: result });
});

/** Options for the create form: the two dropdowns plus the enum catalogs. */
export const optionsController = asyncHandler(async (req, res) => {
  const [managers, agents] = await Promise.all([
    listManagers(req.tenantId),
    listAssignableAgents(req.tenantId),
  ]);

  return sendSuccess(res, {
    data: {
      managers,
      agents,
      leadDistributions: [
        { value: "ON_DEMAND", label: "On Demand", description: "Agents can manually claim leads" },
        { value: "EQUAL", label: "Equal", description: "Leads distributed equally among agents" },
        { value: "CONDITIONAL", label: "Conditional", description: "Smart distribution based on rules" },
      ],
      duplicateScopes: [
        { value: "GLOBAL", label: "Global" },
        { value: "CAMPAIGN", label: "This campaign" },
      ],
      duplicateActions: [
        { value: "IGNORE", label: "Ignore the new lead" },
        { value: "MERGE", label: "Merge into the existing lead" },
        { value: "ALLOW", label: "Allow the duplicate" },
      ],
      priority: { min: PRIORITY_MIN, max: PRIORITY_MAX, default: 3 },
    },
  });
});
