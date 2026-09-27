import { Router } from "express";
import { query } from "express-validator";
import { listUsers } from "./user.controller.js";
import { authenticate } from "../auth/auth.middleware.js";
import { validate } from "../../../middleware/validate.js";

const router = Router();

const listRules = [
  query("q").optional().trim().isLength({ max: 64 }).withMessage("Search term is too long"),
  query("role").optional().trim().isIn(["ADMIN", "SUBADMIN", "AGENT"]).withMessage("Unknown role"),
  query("status").optional().trim().isIn(["ACTIVE", "INACTIVE", "BLOCKED"]).withMessage("Unknown status"),
];

router.get("/", authenticate, listRules, validate, listUsers);

export default router;
