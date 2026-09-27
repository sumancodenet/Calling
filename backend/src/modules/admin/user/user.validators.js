import { body } from "express-validator";
import { string } from "../../../constants/string.js";
import { ROLES } from "../../../constants/roles.js";

const ROLES_ALLOWED = ROLES.map((role) => role.key);

/** A bulk import of a 1000-row CSV should not be allowed to exhaust memory. */
export const MAX_BULK_USERS = 100;

/** Minimum password length, shared with the change-password validator. */
export const PASSWORD_MIN = 8;

/**
 * Validates a bulk create. Every row is checked before anything is written, so
 * a malformed row is reported with its index (`users.2.phone`) rather than
 * half-applying the batch.
 *
 * Deviations from the original spec, both deliberate:
 *  - `role` is validated against the role enum (ADMIN/SUBADMIN/AGENT) rather than
 *    isInt(), because Users.role is a string and is what the auth middleware
 *    and /api/auth/roles already speak.
 *  - `password` requires 8 characters, matching the login validator. Allowing 6
 *    here would mint accounts that can never sign in.
 */
export const createUsersValidator = [
  body("users")
    .isArray({ min: 1, max: MAX_BULK_USERS })
    .withMessage(`Users must be an array of 1-${MAX_BULK_USERS} entries`),

  body("users.*.userName")
    .trim()
    .notEmpty()
    .withMessage("Username required")
    .bail()
    .isLength({ min: 3, max: 64 })
    .withMessage("Username must be 3-64 characters")
    .matches(/^[A-Za-z0-9._-]+$/)
    .withMessage("Username may only contain letters, numbers, dot, underscore and hyphen"),

  body("users.*.phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number required")
    .bail()
    .isLength({ min: 6, max: 20 })
    .withMessage("Phone number must be 6-20 characters"),

  body("users.*.fullName")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 120 })
    .withMessage("Full name is too long"),

  // Optional - an empty string is allowed and stored as NULL.
  body("users.*.email")
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage("Invalid email"),

  // Optional - an empty string is allowed and stored as NULL.
  body("users.*.employeeId")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 6, max: 50 })
    .withMessage("EmployeeId must be at least 6 characters"),

  body("users.*.password")
    .notEmpty()
    .withMessage("Password required")
    .bail()
    .isLength({ min: PASSWORD_MIN, max: 128 })
    .withMessage(`Password min ${PASSWORD_MIN} characters`),

  body("users.*.role")
    .optional({ checkFalsy: true })
    .trim()
    .toUpperCase()
    .isIn(ROLES_ALLOWED)
    .withMessage(`Role must be one of: ${ROLES_ALLOWED.join(", ")}`),
];

/** Used when no role is supplied on a row. */
export const DEFAULT_ROLE = string.AGENT;
