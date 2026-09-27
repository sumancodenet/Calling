import Users from "../modules/admin/auth/auth.model.js";
import RefreshTokens from "../modules/admin/auth/refreshToken.model.js";
import Tenants from "../modules/admin/tenant/tenant.model.js";
import Pipelines from "../modules/admin/pipeline/pipeline.model.js";
import PipelineStages from "../modules/admin/pipeline/stage.model.js";
import StageTags from "../modules/admin/pipeline/tag.model.js";

Tenants.hasMany(Users, { foreignKey: "tenantId", as: "users" });
Users.belongsTo(Tenants, { foreignKey: "tenantId", as: "tenant" });

Tenants.hasMany(Pipelines, { foreignKey: "tenantId", as: "pipelines" });
Pipelines.belongsTo(Tenants, { foreignKey: "tenantId", as: "tenant" });

// Pipeline -> Stage -> Tag
Pipelines.hasMany(PipelineStages, { foreignKey: "pipelineId", as: "stages", onDelete: "CASCADE" });
PipelineStages.belongsTo(Pipelines, { foreignKey: "pipelineId", as: "pipeline" });

PipelineStages.hasMany(StageTags, { foreignKey: "stageId", as: "tags", onDelete: "CASCADE" });
StageTags.belongsTo(PipelineStages, { foreignKey: "stageId", as: "stage" });

Tenants.hasMany(PipelineStages, { foreignKey: "tenantId", as: "stages" });
PipelineStages.belongsTo(Tenants, { foreignKey: "tenantId", as: "tenant" });

Users.hasMany(RefreshTokens, { foreignKey: "userId", as: "refreshTokens", onDelete: "CASCADE" });
RefreshTokens.belongsTo(Users, { foreignKey: "userId", as: "user" });

export { Users, RefreshTokens, Tenants, Pipelines, PipelineStages, StageTags };
export default { Users, RefreshTokens, Tenants, Pipelines, PipelineStages, StageTags };
