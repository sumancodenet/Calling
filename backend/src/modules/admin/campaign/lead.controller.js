import { campaignUpload } from "../../../middleware/upload.js";
import { sendSuccess } from "../../../utils/response.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { badRequest } from "../../../utils/AppError.js";
import { uploadLeads, listLeads, listUploadLeads, deleteUpload, getUploadDownloadUrl, MAX_UPLOAD_BYTES } from "./lead.service.js";
import { getCampaignAnalytics } from "./analytics.service.js";

export const analyticsController = asyncHandler(async (req, res) => {
  const data = await getCampaignAnalytics({ tenantId: req.tenantId, campaignId: Number(req.params.id) });
  return sendSuccess(res, { data });
});

export const uploadLeadsController = asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest("Choose a .csv, .xls or .xlsx file to upload");

  const result = await uploadLeads({
    tenantId: req.tenantId,
    campaignId: Number(req.params.id),
    file: req.file,
    uploadedByName: req.user?.fullName ?? null,
  });

  return sendSuccess(res, { message: "Leads imported", data: result });
});

export const listUploadLeadsController = asyncHandler(async (req, res) => {
  const result = await listUploadLeads({
    tenantId: req.tenantId,
    campaignId: Number(req.params.id),
    uploadId: Number(req.params.uploadId),
    page: req.query.page,
    limit: req.query.limit,
  });
  return sendSuccess(res, { data: result });
});

export const deleteUploadController = asyncHandler(async (req, res) => {
  const result = await deleteUpload({
    tenantId: req.tenantId,
    campaignId: Number(req.params.id),
    uploadId: Number(req.params.uploadId),
  });
  return sendSuccess(res, { message: "Import deleted", data: result });
});

export const downloadUploadController = asyncHandler(async (req, res) => {
  const result = await getUploadDownloadUrl({
    tenantId: req.tenantId,
    campaignId: Number(req.params.id),
    uploadId: Number(req.params.uploadId),
  });
  return sendSuccess(res, { data: result });
});

export const listController = asyncHandler(async (req, res) => {
  const result = await listLeads({
    tenantId: req.tenantId,
    campaignId: Number(req.params.id),
    page: req.query.page,
    limit: req.query.limit,
  });
  return sendSuccess(res, { data: result.items, meta: result.meta });
});

export { MAX_UPLOAD_BYTES };
