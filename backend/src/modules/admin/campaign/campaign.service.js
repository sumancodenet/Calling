import { Op } from "sequelize";
import { Campaigns, CampaignAgents, Users, Pipelines } from "../../../models/index.js";
import { badRequest, conflict, notFound } from "../../../utils/AppError.js";
import { reviveOrCreate } from "../../../utils/reviveOrCreate.js";
import { PIPELINE_MANAGER_ROLES } from "../../../constants/roles.js";
import {
  LEAD_DISTRIBUTIONS,
  DUPLICATE_SCOPES,
  DUPLICATE_ACTIONS,
  CAMPAIGN_STATUS,
  PRIORITY_MIN,
  PRIORITY_MAX,
} from "./campaign.model.js";

const trim = (v) => (v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim());

const AGENT_SELECT = ["id", "userName", "fullName", "role", "Status"];

const withRelations = [
  { model: Pipelines, as: "pipeline", attributes: ["id", "pipeline"] },
  { model: Users, as: "manager", attributes: ["id", "userName", "fullName", "role"] },
  {
    model: CampaignAgents,
    as: "campaignAgents",
    attributes: ["id", "userId", "position"],
    order: [["position", "ASC"]],
  },
];

/** Adds the agent name to each campaignAgents row so the client need not re-join. */
const attachAgents = (campaign) => {
  const rows = campaign.campaignAgents ?? [];
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    pipelineId: campaign.pipelineId,
    pipeline: campaign.pipeline ? campaign.pipeline.pipeline : null,
    managerId: campaign.managerId,
    manager: campaign.manager
      ? {
          id: campaign.manager.id,
          userName: campaign.manager.userName,
          fullName: campaign.manager.fullName,
          role: campaign.manager.role,
        }
      : null,
    leadDistribution: campaign.leadDistribution,
    priority: campaign.priority,
    duplicateScope: campaign.duplicateScope,
    duplicateAction: campaign.duplicateAction,
    Status: campaign.Status,
    agentIds: rows.map((row) => row.userId),
    agentCount: rows.length,
    CreatedAt: campaign.CreatedAt,
  };
};

const withAgentRows = async (campaign) => {
  const rows = campaign.campaignAgents ?? [];
  if (rows.length === 0) return [];
  const users = await Users.findAll({ where: { id: { [Op.in]: rows.map((r) => r.userId) } }, attributes: AGENT_SELECT });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows
    .map((row) => {
      const user = byId.get(row.userId);
      if (!user) return null;
      return {
        id: user.id,
        userName: user.userName,
        fullName: user.fullName,
        role: user.role,
        Status: user.Status,
        position: row.position,
      };
    })
    .filter(Boolean);
};

/** Admins and subadmins who can own a campaign. */
export const listManagers = async (tenantId) =>
  Users.findAll({
    where: { tenantId, role: { [Op.in]: [...PIPELINE_MANAGER_ROLES] }, Status: "ACTIVE" },
    attributes: AGENT_SELECT,
    order: [["fullName", "ASC"]],
  }).then((rows) =>
    rows.map((u) => ({ id: u.id, userName: u.userName, fullName: u.fullName, role: u.role })),
  );

/** Everyone in the workspace who can be handed leads, i.e. every active member. */
export const listAssignableAgents = async (tenantId) =>
  Users.findAll({
    where: { tenantId, Status: "ACTIVE" },
    attributes: AGENT_SELECT,
    order: [["fullName", "ASC"]],
  }).then((rows) =>
    rows.map((u) => ({ id: u.id, userName: u.userName, fullName: u.fullName, role: u.role })),
  );

const isSoftDeleted = (row) => Boolean(row?.get?.("DeletedAt") ?? row?.DeletedAt);

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;

export const updateCampaignStatus = async ({ tenantId, id, Status }) => {
  const campaign = await Campaigns.findOne({ where: { id, tenantId }, attributes: ["id", "Status"] });
  if (!campaign) throw notFound("Campaign not found");

  const next = String(Status ?? "").toUpperCase();
  if (!Object.values(CAMPAIGN_STATUS).includes(next)) {
    throw badRequest(`Status must be one of: ${Object.values(CAMPAIGN_STATUS).join(", ")}`);
  }

  await campaign.update({ Status: next });
  return getCampaign({ tenantId, id });
};

export const listCampaigns = async ({ tenantId, pipelineId, page = 1, limit = DEFAULT_PAGE_SIZE }) => {
  const where = { tenantId };
  if (pipelineId) where.pipelineId = Number(pipelineId);

  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const safePage = Math.max(Number(page) || 1, 1);

  // Counted without the includes on purpose. findAndCountAll runs its COUNT over
  // the same joins, so including CampaignAgents (a hasMany) counts agent rows
  // instead of campaign rows - total came out as 8 for 6 campaigns, which makes
  // hasMore wrong and leaves infinite scroll fetching empty pages forever.
  const total = await Campaigns.count({ where });
  const campaigns = await Campaigns.findAll({
    where,
    include: withRelations,
    order: [
      ["priority", "DESC"],
      ["CreatedAt", "DESC"],
    ],
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  });

  const detailed = await Promise.all(campaigns.map((c) => withAgentRows(c).then((agents) => ({ campaign: c, agents }))));
  const byId = new Map(detailed.map((d) => [d.campaign.id, d.agents]));

  return {
    items: campaigns.map((c) => ({ ...attachAgents(c), agents: byId.get(c.id) ?? [] })),
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(Math.ceil(total / safeLimit), 1),
      hasMore: safePage * safeLimit < total,
    },
  };
};

export const getCampaign = async ({ tenantId, id }) => {
  const campaign = await Campaigns.findOne({ where: { id, tenantId }, include: withRelations });
  if (!campaign) throw notFound("Campaign not found");
  return { ...attachAgents(campaign), agents: await withAgentRows(campaign) };
};

const assertManager = async (tenantId, managerId) => {
  const manager = await Users.findOne({
    where: { id: managerId, tenantId, Status: "ACTIVE" },
    attributes: ["id", "userName", "role"],
  });
  if (!manager) throw badRequest("Select a manager for this campaign");
  if (!PIPELINE_MANAGER_ROLES.includes(manager.role)) {
    throw badRequest("The campaign manager must be an admin or a sub admin");
  }
  return manager;
};

const assertAgents = async (tenantId, agentIds) => {
  const ids = [...new Set(agentIds.map(Number))];
  if (ids.length === 0) throw badRequest("Select at least one agent for this campaign");

  const users = await Users.findAll({
    where: { id: { [Op.in]: ids }, tenantId, Status: "ACTIVE" },
    attributes: ["id", "userName"],
  });
  if (users.length !== ids.length) {
    const found = new Set(users.map((u) => u.id));
    const missing = ids.filter((id) => !found.has(id));
    throw badRequest(`Agent not found or not active: ${missing.join(", ")}`);
  }
  return ids;
};

export const createCampaign = async ({ tenantId, body }) => {
  const name = trim(body.name);
  if (!name) throw badRequest("Campaign name is required");

  const pipelineId = Number(body.pipelineId);
  const pipeline = await Pipelines.findOne({
    where: { id: pipelineId, tenantId },
    attributes: ["id"],
  });
  if (!pipeline) throw badRequest("Select a pipeline for this campaign");

  const managerId = Number(body.managerId);
  await assertManager(tenantId, managerId);

  const rawAgents = Array.isArray(body.agentIds) ? body.agentIds : [];
  const agentIds = await assertAgents(tenantId, rawAgents);

  const leadDistribution = String(body.leadDistribution ?? LEAD_DISTRIBUTIONS.EQUAL).toUpperCase();
  if (!Object.values(LEAD_DISTRIBUTIONS).includes(leadDistribution)) {
    throw badRequest("Unknown lead distribution");
  }

  const duplicateScope = String(body.duplicateScope ?? DUPLICATE_SCOPES.CAMPAIGN).toUpperCase();
  if (!Object.values(DUPLICATE_SCOPES).includes(duplicateScope)) {
    throw badRequest("Unknown duplicate scope");
  }

  const duplicateAction = String(body.duplicateAction ?? DUPLICATE_ACTIONS.IGNORE).toUpperCase();
  if (!Object.values(DUPLICATE_ACTIONS).includes(duplicateAction)) {
    throw badRequest("Unknown duplicate action");
  }

  const priority = body.priority === undefined || body.priority === null ? 3 : Number(body.priority);
  if (!Number.isInteger(priority) || priority < PRIORITY_MIN || priority > PRIORITY_MAX) {
    throw badRequest(`Priority must be a whole number between ${PRIORITY_MIN} and ${PRIORITY_MAX}`);
  }

  // Same rules as pipelines: a soft-deleted row still holds its unique key, so
  // creating the same name again revives that row rather than colliding.
  const clash = await Campaigns.findOne({
    where: { tenantId, pipelineId, name },
    attributes: ["id", "DeletedAt"],
    paranoid: false,
  });
  if (clash && !isSoftDeleted(clash)) {
    throw conflict(`A campaign named "${name}" already exists on this pipeline`);
  }

  const created = await Campaigns.sequelize.transaction(async (t) => {
    let campaign;
    if (isSoftDeleted(clash)) {
      const { instance } = await reviveOrCreate(
        Campaigns,
        { where: { id: clash.id }, transaction: t },
      );
      await instance.update(
        {
          name,
          description: trim(body.description),
          managerId,
          leadDistribution,
          priority,
          duplicateScope,
          duplicateAction,
          Status: CAMPAIGN_STATUS.DRAFT,
        },
        { transaction: t },
      );
      campaign = instance;
    } else {
      campaign = await Campaigns.create(
        {
          tenantId,
          pipelineId,
          name,
          description: trim(body.description),
          managerId,
          leadDistribution,
          priority,
          duplicateScope,
          duplicateAction,
          Status: CAMPAIGN_STATUS.DRAFT,
        },
        { transaction: t },
      );
    }

    // A revived campaign may still carry its old agents, so clear them first.
    await CampaignAgents.destroy({ where: { campaignId: campaign.id }, transaction: t });

    await CampaignAgents.bulkCreate(
      agentIds.map((id, position) => ({ tenantId, campaignId: campaign.id, userId: id, position })),
      { transaction: t },
    );

    return campaign;
  });

  return getCampaign({ tenantId, id: created.id });
};

export const deleteCampaign = async ({ tenantId, id }) => {
  const campaign = await Campaigns.findOne({ where: { id, tenantId }, attributes: ["id", "name"] });
  if (!campaign) throw notFound("Campaign not found");

  await CampaignAgents.destroy({ where: { campaignId: campaign.id } });
  await campaign.destroy();

  return { id, name: campaign.name, deleted: true };
};

export { LEAD_DISTRIBUTIONS, DUPLICATE_SCOPES, DUPLICATE_ACTIONS, CAMPAIGN_STATUS, PRIORITY_MIN, PRIORITY_MAX };
