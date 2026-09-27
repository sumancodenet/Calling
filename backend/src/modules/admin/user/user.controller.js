import { Op } from "sequelize";
import { Users } from "../../../models/index.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { sendSuccess, sendCreated } from "../../../utils/response.js";
import { createUsers, getUser, updateUser, changePassword, deleteUser } from "./user.service.js";
import { MAX_BULK_USERS } from "./user.validators.js";

// Explicit allow-list. `password` is never selectable, so a future edit to the
// model cannot accidentally start leaking hashes through this endpoint.
const LISTABLE = [
  "id",
  "userId",
  "userName",
  "fullName",
  "email",
  "phone",
  "employeeId",
  "role",
  "Status",
  "IsReset",
  "lastLogin",
  "ProfileImage",
  "CreatedAt",
];

const MAX_LIMIT = 200;

export const listUsers = asyncHandler(async (req, res) => {
  const { q, role, status } = req.query;

  // Scoped to the caller's own tenant, taken from the verified token.
  const where = { tenantId: req.tenantId };

  if (role) where.role = String(role).toUpperCase();
  if (status) where.Status = String(status).toUpperCase();
  if (q) {
    const term = `%${String(q).trim()}%`;
    where[Op.or] = [
      { userName: { [Op.like]: term } },
      { fullName: { [Op.like]: term } },
      { email: { [Op.like]: term } },
      { phone: { [Op.like]: term } },
    ];
  }

  const users = await Users.findAll({
    where,
    attributes: LISTABLE,
    order: [
      ["CreatedAt", "DESC"],
      ["id", "ASC"],
    ],
    limit: MAX_LIMIT,
  });

  return sendSuccess(res, {
    message: "Users retrieved",
    data: users,
    meta: { count: users.length, limit: MAX_LIMIT },
  });
});

export const createManyUsers = asyncHandler(async (req, res) => {
  const created = await createUsers({
    tenantId: req.tenantId,
    userId: req.user.id,
    users: req.body.users,
  });

  return sendCreated(res, {
    message: `${created.length} user${created.length === 1 ? "" : "s"} created`,
    data: created,
    meta: { created: created.length, requested: req.body.users.length, maxPerRequest: MAX_BULK_USERS },
  });
});

export const getController = asyncHandler(async (req, res) => {
  return sendSuccess(res, { data: await getUser({ tenantId: req.tenantId, id: req.params.id }) });
});

export const updateController = asyncHandler(async (req, res) => {
  const data = await updateUser({ tenantId: req.tenantId, id: req.params.id, body: req.body });
  return sendSuccess(res, { message: "User updated", data });
});

export const passwordController = asyncHandler(async (req, res) => {
  const data = await changePassword({
    tenantId: req.tenantId,
    id: req.params.id,
    newPassword: req.body.newPassword,
  });
  return sendSuccess(res, { message: "Password reset. Their sessions were signed out.", data });
});

export const deleteController = asyncHandler(async (req, res) => {
  const data = await deleteUser({
    tenantId: req.tenantId,
    actorId: req.user.id,
    id: req.params.id,
  });
  return sendSuccess(res, { message: `Deleted ${data.userName}`, data });
});

export default listUsers;
