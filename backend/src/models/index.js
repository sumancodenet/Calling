import Users from "../modules/admin/auth/auth.model.js";
import RefreshTokens from "../modules/admin/auth/refreshToken.model.js";
import Tenants from "../modules/admin/tenant/tenant.model.js";
import Pipelines from "../modules/admin/pipeline/pipeline.model.js";
import PipelineStages from "../modules/admin/pipeline/stage.model.js";
import StageTags from "../modules/admin/pipeline/tag.model.js";
import Campaigns from "../modules/admin/campaign/campaign.model.js";
import CampaignAgents from "../modules/admin/campaign/campaignAgent.model.js";
import CampaignLeads from "../modules/admin/campaign/lead.model.js";
import CampaignUploads from "../modules/admin/campaign/upload.model.js";

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

// Campaigns sit under a pipeline and are run by a manager plus a set of agents.
Tenants.hasMany(Campaigns, { foreignKey: "tenantId", as: "campaigns" });
Campaigns.belongsTo(Tenants, { foreignKey: "tenantId", as: "tenant" });

Pipelines.hasMany(Campaigns, { foreignKey: "pipelineId", as: "campaigns" });
Campaigns.belongsTo(Pipelines, { foreignKey: "pipelineId", as: "pipeline" });

// The manager is just a user; the alias keeps it apart from `agents`.
Users.hasMany(Campaigns, { foreignKey: "managerId", as: "managedCampaigns" });
Campaigns.belongsTo(Users, { foreignKey: "managerId", as: "manager" });

Campaigns.hasMany(CampaignAgents, { foreignKey: "campaignId", as: "campaignAgents", onDelete: "CASCADE" });
CampaignAgents.belongsTo(Campaigns, { foreignKey: "campaignId", as: "campaign" });

CampaignAgents.belongsTo(Users, { foreignKey: "userId", as: "agent" });
Users.hasMany(CampaignAgents, { foreignKey: "userId", as: "campaignAgents" });

Campaigns.hasMany(CampaignLeads, { foreignKey: "campaignId", as: "leads", onDelete: "CASCADE" });
CampaignLeads.belongsTo(Campaigns, { foreignKey: "campaignId", as: "campaign" });

PipelineStages.hasMany(CampaignLeads, { foreignKey: "stageId", as: "leads" });
CampaignLeads.belongsTo(PipelineStages, { foreignKey: "stageId", as: "stage" });

CampaignLeads.belongsTo(Users, { foreignKey: "assignedTo", as: "assignee" });
Users.hasMany(CampaignLeads, { foreignKey: "assignedTo", as: "assignedLeads" });

Campaigns.hasMany(CampaignUploads, { foreignKey: "campaignId", as: "uploads", onDelete: "CASCADE" });
CampaignUploads.belongsTo(Campaigns, { foreignKey: "campaignId", as: "campaign" });

Users.hasMany(RefreshTokens, { foreignKey: "userId", as: "refreshTokens", onDelete: "CASCADE" });
RefreshTokens.belongsTo(Users, { foreignKey: "userId", as: "user" });

export {
  Users,
  RefreshTokens,
  Tenants,
  Pipelines,
  PipelineStages,
  StageTags,
  Campaigns,
  CampaignAgents,
  CampaignLeads,
  CampaignUploads,
};
export default {
  Users,
  RefreshTokens,
  Tenants,
  Pipelines,
  PipelineStages,
  StageTags,
  Campaigns,
  CampaignAgents,
  CampaignLeads,
  CampaignUploads,
};
