import { Router } from "express";
import { body, param, query } from "express-validator";
import {
  listController,
  createController,
  getController,
  updateStatusController,
  deleteController,
  optionsController,
} from "./campaign.controller.js";
import {
  uploadLeadsController,
  listController as listLeadsController,
  analyticsController,
  listUploadLeadsController,
  deleteUploadController,
  downloadUploadController,
} from "./lead.controller.js";
import { handleUploadError } from "../../../middleware/upload.js";
import { createCampaignRules } from "./campaign.validators.js";
import { CAMPAIGN_STATUS } from "./campaign.model.js";
import { authenticate, requireRole } from "../auth/auth.middleware.js";
import { campaignUpload } from "../../../middleware/upload.js";
import { validate } from "../../../middleware/validate.js";
import { apiLimiter, authLimiter } from "../../../config/rateLimit.js";
import { PIPELINE_MANAGER_ROLES } from "../../../constants/roles.js";

const router = Router();

// Same split as pipelines: anyone in the workspace may read, only admins and
// sub admins may change the configuration.
const canManage = requireRole(...PIPELINE_MANAGER_ROLES);
const idParam = [param("id").isInt({ min: 1 }).withMessage("Invalid campaign id").toInt()];
const uploadIdParam = [param("uploadId").isInt({ min: 1 }).withMessage("Invalid import id").toInt()];

router.get(
  "/",
  authenticate,
  [
    query("pipelineId").optional().isInt({ min: 1 }),
    query("page").optional().isInt({ min: 1 }).withMessage("Page must be 1 or more").toInt(),
    query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("Limit must be 1-50").toInt(),
  ],
  validate,
  listController,
);
router.get("/options", authenticate, optionsController);

router.post("/", authenticate, canManage, authLimiter, createCampaignRules, validate, createController);
router.get("/:id", authenticate, idParam, validate, getController);
router.get("/:id/analytics", authenticate, idParam, validate, analyticsController);
// Pause / resume / archive. Separate from the full edit form on purpose: this is
// the one change the action menu needs.
router.patch(
  "/:id/status",
  authenticate,
  canManage,
  apiLimiter,
  idParam,
  [body("Status").trim().toUpperCase().isIn(Object.values(CAMPAIGN_STATUS)).withMessage("Unknown status")],
  validate,
  updateStatusController,
);
router.delete("/:id", authenticate, canManage, apiLimiter, idParam, validate, deleteController);

// ---- leads ----
// Nested under the campaign so the id in the path is the campaign's.
router.get(
  "/:id/leads",
  authenticate,
  idParam,
  [query("page").optional().isInt({ min: 1 }).toInt(), query("limit").optional().isInt({ min: 1, max: 100 }).toInt()],
  validate,
  listLeadsController,
);
router.post(
  "/:id/leads/upload",
  authenticate,
  canManage,
  authLimiter,
  idParam,
  campaignUpload,
  handleUploadError,
  validate,
  uploadLeadsController,
);

// ---- import history ----
router.get(
  "/:id/uploads/:uploadId/leads",
  authenticate,
  idParam,
  uploadIdParam,
  [query("page").optional().isInt({ min: 1 }).toInt(), query("limit").optional().isInt({ min: 1, max: 200 }).toInt()],
  validate,
  listUploadLeadsController,
);
router.get(
  "/:id/uploads/:uploadId/download",
  authenticate,
  idParam,
  uploadIdParam,
  validate,
  downloadUploadController,
);
router.delete("/:id/uploads/:uploadId", authenticate, canManage, authLimiter, idParam, uploadIdParam, validate, deleteUploadController);

export default router;
