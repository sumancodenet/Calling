import Users from "../modules/admin/auth/auth.model.js";
import RefreshTokens from "../modules/admin/auth/refreshToken.model.js";
import Tenants from "../modules/admin/tenant/tenant.model.js";
import Pipelines from "../modules/admin/pipeline/pipeline.model.js";

Tenants.hasMany(Users, { foreignKey: "tenantId", as: "users" });
Users.belongsTo(Tenants, { foreignKey: "tenantId", as: "tenant" });

Tenants.hasMany(Pipelines, { foreignKey: "tenantId", as: "pipelines" });
Pipelines.belongsTo(Tenants, { foreignKey: "tenantId", as: "tenant" });

Users.hasMany(RefreshTokens, { foreignKey: "userId", as: "refreshTokens", onDelete: "CASCADE" });
RefreshTokens.belongsTo(Users, { foreignKey: "userId", as: "user" });

export { Users, RefreshTokens, Tenants, Pipelines };
export default { Users, RefreshTokens, Tenants, Pipelines };
