import { Router } from "express";
import { body, param, query } from "express-validator";
import {
  listController,
  getController,
  createController,
  updateController,
  deleteController,
  createStageController,
  getStageController,
  updateStageController,
  deleteStageController,
  createTagController,
  updateTagController,
  deleteTagController,
} from "./pipeline.controller.js";
import { authenticate } from "../auth/auth.middleware.js";
import { validate } from "../../../middleware/validate.js";
import { apiLimiter } from "../../../config/rateLimit.js";

const router = Router();

const pipeId = [param("pipelineId").isInt({ min: 1 }).withMessage("Invalid pipeline id").toInt()];
const stageId = [...pipeId, param("stageId").isInt({ min: 1 }).withMessage("Invalid stage id").toInt()];
const tagId = [...stageId, param("tagId").isInt({ min: 1 }).withMessage("Invalid tag id").toInt()];

const nameRule = (field, label) =>
  body(field).trim().notEmpty().withMessage(`${label} is required`).isLength({ min: 1, max: 120 });

const stageInputRules = [
  body("stages").optional().isArray({ min: 1, max: 100 }).withMessage("stages must be an array"),
  body("stages.*.name").trim().notEmpty().withMessage("Each stage needs a name").isLength({ max: 120 }),
  body("stages.*.probability").optional({ values: "null" }).isInt({ min: 0, max: 100 }).withMessage("probability must be 0-100"),
];

const stageRules = [
  nameRule("name", "Stage name"),
  body("description").optional({ values: "null" }).trim().isLength({ max: 255 }),
  body("position").optional().isInt({ min: 0 }).withMessage("position must be 0 or more"),
  body("probability").optional({ values: "null" }).isInt({ min: 0, max: 100 }).withMessage("probability must be 0-100"),
  body("color").optional({ values: "null" }).trim().isLength({ max: 20 }),
  body("isWon").optional().isBoolean(),
  body("isLost").optional().isBoolean(),
];

const updateStageRules = [
  body("name").optional().trim().notEmpty().withMessage("Stage name cannot be empty").isLength({ max: 120 }),
  body("description").optional({ values: "null" }).trim().isLength({ max: 255 }),
  body("position").optional().isInt({ min: 0 }),
  body("probability").optional({ values: "null" }).isInt({ min: 0, max: 100 }),
  body("color").optional({ values: "null" }).trim().isLength({ max: 20 }),
  body("isWon").optional().isBoolean(),
  body("isLost").optional().isBoolean(),
];

const tagRules = [nameRule("name", "Tag name"), body("color").optional({ values: "null" }).trim().isLength({ max: 20 })];

const updateTagRules = [
  body("name").optional().trim().notEmpty().withMessage("Tag name cannot be empty").isLength({ max: 120 }),
  body("color").optional({ values: "null" }).trim().isLength({ max: 20 }),
  body("position").optional().isInt({ min: 0 }),
];

router.get("/", authenticate, [query("Status").optional().trim().isIn(["ACTIVE", "ARCHIVED"])], validate, listController);
router.post("/", authenticate, apiLimiter, [nameRule("name", "Pipeline name"), ...stageInputRules], validate, createController);

router.get("/:pipelineId", authenticate, pipeId, validate, getController);
router.patch("/:pipelineId", authenticate, apiLimiter, pipeId, [
  body("name").optional().trim().notEmpty().withMessage("Pipeline name cannot be empty").isLength({ max: 120 }),
  body("description").optional({ values: "null" }).trim().isLength({ max: 255 }),
  body("position").optional().isInt({ min: 0 }),
  body("isDefault").optional().isBoolean(),
  body("Status").optional().trim().toUpperCase().isIn(["ACTIVE", "ARCHIVED"]).withMessage("Unknown status"),
], validate, updateController);
router.delete("/:pipelineId", authenticate, pipeId, validate, deleteController);

// ---- stages ----
router.post("/:pipelineId/stages", authenticate, apiLimiter, pipeId, stageRules, validate, createStageController);
router.get("/:pipelineId/stages/:stageId", authenticate, stageId, validate, getStageController);
router.patch("/:pipelineId/stages/:stageId", authenticate, apiLimiter, stageId, updateStageRules, validate, updateStageController);
router.delete("/:pipelineId/stages/:stageId", authenticate, stageId, validate, deleteStageController);

// ---- tags ----
router.post("/:pipelineId/stages/:stageId/tags", authenticate, apiLimiter, stageId, tagRules, validate, createTagController);
router.patch("/:pipelineId/stages/:stageId/tags/:tagId", authenticate, apiLimiter, tagId, updateTagRules, validate, updateTagController);
router.delete("/:pipelineId/stages/:stageId/tags/:tagId", authenticate, tagId, validate, deleteTagController);

export default router;
