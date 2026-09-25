import bcrypt from "bcryptjs";
import Users from "./auth.model.js";
import { string } from "../../../constants/string.js";
import { sendCreated, sendError } from "../../../utils/response.js";

const SALT_ROUNDS = 10;

export const createSuperAdmin = async (req, res) => {
  try {
    const { userName, fullName, email, phone, password } = req.body;

    const missing = ["userName", "fullName", "password"].filter((field) => !req.body[field]);
    if (missing.length) {
      return sendError(res, {
        statusCode: 422,
        message: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    if (typeof password === "string" && password.length < 8) {
      return sendError(res, { statusCode: 422, message: "Password must be at least 8 characters" });
    }

    const existingSuperAdmin = await Users.findOne({ where: { role: roleMap.SUPER_ADMIN } });
    if (existingSuperAdmin) {
      return sendError(res, { statusCode: 409, message: "Super admin already exists" });
    }

    if (email) {
      const emailTaken = await Users.findOne({ where: { email } });
      if (emailTaken) {
        return sendError(res, { statusCode: 409, message: "Email already in use" });
      }
    }

    if (phone) {
      const phoneTaken = await Users.findOne({ where: { phone } });
      if (phoneTaken) {
        return sendError(res, { statusCode: 409, message: "Phone already in use" });
      }
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const superAdmin = await Users.create({
      userId: 'ADMIN-' + Date.now(),
      userName,
      fullName,
      email: email || null,
      phone: phone || null,
      password: hashedPassword,
      role: string.ADMIN,
      Status: "ACTIVE",
      IsReset: false,
    });

    return sendCreated(res, {
      message: "Super admin created successfully",
      data: {
        userId: superAdmin.userId,
        userName: superAdmin.userName,
        fullName: superAdmin.fullName,
        email: superAdmin.email,
        phone: superAdmin.phone,
        role: superAdmin.role,
        status: superAdmin.Status,
      },
    });
  } catch (error) {
    return sendError(res, {
      statusCode: error.name === "SequelizeUniqueConstraintError" ? 409 : 500,
      message: error.name === "SequelizeUniqueConstraintError" ? "Email or phone already in use" : error.message,
    });
  }
};
