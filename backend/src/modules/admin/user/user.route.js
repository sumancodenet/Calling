import { Router } from "express";
import { body, param, query } from "express-validator";
import {
  listUsers,
  createManyUsers,
  getController,
  updateController,
  passwordController,
  deleteController,
} from "./user.controller.js";
import { createUsersValidator, PASSWORD_MIN } from "./user.validators.js";
import { authenticate } from "../auth/auth.middleware.js";
import { validate } from "../../../middleware/validate.js";
import { authLimiter, apiLimiter } from "../../../config/rateLimit.js";

const router = Router();

const idParam = [param("id").isInt({ min: 1 }).withMessage("Invalid user id").toInt()];

const listRules = [
  query("q").optional().trim().isLength({ max: 64 }).withMessage("Search term is too long"),
  query("role").optional().trim().isIn(["ADMIN", "SUBADMIN", "AGENT"]).withMessage("Unknown role"),
  query("status").optional().trim().isIn(["ACTIVE", "INACTIVE", "BLOCKED"]).withMessage("Unknown status"),
];

const updateRules = [
  body("fullName").optional({ values: "null" }).trim().isLength({ min: 1, max: 120 }).withMessage("Full name must be 1-120 characters"),
  body("email").optional({ values: "null" }).trim().isEmail().withMessage("Invalid email"),
  body("phone").optional({ values: "null" }).trim().isLength({ min: 6, max: 20 }).withMessage("Phone must be 6-20 characters"),
  body("employeeId").optional({ values: "null" }).trim().isLength({ min: 6, max: 50 }).withMessage("EmployeeId must be at least 6 characters"),
  body("role").optional({ values: "null" }).trim().toUpperCase().isIn(["ADMIN", "SUBADMIN", "AGENT"]).withMessage("Unknown role"),
  body("Status").optional({ values: "null" }).trim().toUpperCase().isIn(["ACTIVE", "INACTIVE", "BLOCKED"]).withMessage("Unknown status"),
];

const passwordRules = [
  body("newPassword")
    .isLength({ min: PASSWORD_MIN, max: 128 })
    .withMessage(`Password must be at least ${PASSWORD_MIN} characters`),
];

router.get("/", authenticate, listRules, validate, listUsers);

// Declared before "/:id" so the literal path is never captured as an id.
router.post("/bulk", authenticate, authLimiter, createUsersValidator, validate, createManyUsers);

router.get("/:id", authenticate, idParam, validate, getController);
router.patch("/:id", authenticate, apiLimiter, idParam, updateRules, validate, updateController);
router.post("/:id/password", authenticate, authLimiter, idParam, passwordRules, validate, passwordController);
router.delete("/:id", authenticate, idParam, validate, deleteController);

export default router;
