import { Op } from "sequelize";
import { Users } from "../../../models/index.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { sendSuccess } from "../../../utils/response.js";

// Explicit allow-list. `password` is never selectable, so a future edit to the
// model cannot accidentally start leaking hashes through this endpoint.
const LISTABLE = [
  "id",
  "userId",
  "userName",
  "fullName",
  "email",
  "phone",
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

export default listUsers;
