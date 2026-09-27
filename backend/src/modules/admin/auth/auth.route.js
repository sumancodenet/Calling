import { Router } from "express";
import { body } from "express-validator";
import {
  loginController,
  refreshController,
  logoutController,
  meController,
  logoutAllController,
  sessionsController,
  rolesController,
  createSuperAdmin,
} from "./auth.controller.js";
import { authenticate } from "./auth.middleware.js";
import { authLimiter } from "../../../config/rateLimit.js";
import { validate } from "../../../middleware/validate.js";

const router = Router();

const loginRules = [
  body("tenantSlug")
    .trim()
    .notEmpty()
    .withMessage("Workspace is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Workspace must be 2-50 characters")
    .matches(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i)
    .withMessage("Workspace may only contain letters, numbers and hyphens"),
  body("userName")
    .trim()
    .notEmpty()
    .withMessage("Username is required")
    .isLength({ min: 3, max: 64 })
    .withMessage("Username must be 3-64 characters"),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be at least 8 characters"),
];

const createUserRules = [
  body("userName").trim().notEmpty().withMessage("Username is required").isLength({ min: 3, max: 64 }),
  body("fullName").trim().notEmpty().withMessage("Full name is required").isLength({ max: 120 }),
  body("password").notEmpty().withMessage("Password is required").isLength({ min: 8, max: 128 }),
  body("email").optional({ values: "falsy" }).trim().isEmail().withMessage("Email is not valid"),
  body("phone").optional({ values: "falsy" }).trim().isLength({ min: 6, max: 20 }),
];

router.post("/login", authLimiter, loginRules, validate, loginController);
router.post("/refresh", refreshController);
router.post("/logout", logoutController);

router.get("/me", authenticate, meController);
router.post("/logout-all", authenticate, logoutAllController);
router.get("/sessions", authenticate, sessionsController);
router.get("/roles", authenticate, rolesController);

router.post("/super-admin", authenticate, createUserRules, validate, createSuperAdmin);

export default router;
