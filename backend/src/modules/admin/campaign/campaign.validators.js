import { body } from "express-validator";
import {
  LEAD_DISTRIBUTIONS,
  DUPLICATE_SCOPES,
  DUPLICATE_ACTIONS,
  PRIORITY_MIN,
  PRIORITY_MAX,
} from "./campaign.model.js";

const oneOf = (values) => values.join(", ");

export const createCampaignRules = [
  body("name").trim().notEmpty().withMessage("Campaign name is required").isLength({ max: 120 }),
  body("description").optional({ values: "null" }).trim().isLength({ max: 255 }),
  body("pipelineId").isInt({ min: 1 }).withMessage("Select a pipeline").toInt(),
  body("managerId").isInt({ min: 1 }).withMessage("Select a campaign manager").toInt(),
  body("agentIds").isArray({ min: 1, max: 200 }).withMessage("Select at least one agent"),
  body("agentIds.*").isInt({ min: 1 }).withMessage("Invalid agent id").toInt(),
  body("leadDistribution")
    .optional()
    .trim()
    .toUpperCase()
    .isIn(Object.values(LEAD_DISTRIBUTIONS))
    .withMessage(`Lead distribution must be one of: ${oneOf(Object.values(LEAD_DISTRIBUTIONS))}`),
  body("priority")
    .optional()
    .isInt({ min: PRIORITY_MIN, max: PRIORITY_MAX })
    .withMessage(`Priority must be between ${PRIORITY_MIN} and ${PRIORITY_MAX}`)
    .toInt(),
  body("duplicateScope")
    .optional()
    .trim()
    .toUpperCase()
    .isIn(Object.values(DUPLICATE_SCOPES))
    .withMessage(`Duplicate scope must be one of: ${oneOf(Object.values(DUPLICATE_SCOPES))}`),
  body("duplicateAction")
    .optional()
    .trim()
    .toUpperCase()
    .isIn(Object.values(DUPLICATE_ACTIONS))
    .withMessage(`Duplicate action must be one of: ${oneOf(Object.values(DUPLICATE_ACTIONS))}`),
];
