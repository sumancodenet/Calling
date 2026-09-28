import { Op, fn, col } from "sequelize";
import {
  Campaigns,
  CampaignLeads,
  CampaignUploads,
  Pipelines,
  PipelineStages,
  StageTags,
} from "../../../models/index.js";
import { notFound } from "../../../utils/AppError.js";

/** A lead in any of these states still counts as live; the rest are closed out. */
const CLOSED_STATUSES = ["CONVERTED", "DO_NOT_CALL"];

const PRIORITY_LABEL = { 1: "Low", 2: "Low", 3: "Medium", 4: "High", 5: "High" };

/**
 * Everything the campaign analytics screen shows, in one round trip:
 * totals, how leads spread across the pipeline's stages, the tags available on
 * each stage, and the import history.
 *
 * Leads land in the first stage on upload, so the distribution is heavily
 * front-loaded until leads are moved between stages.
 */
export const getCampaignAnalytics = async ({ tenantId, campaignId }) => {
  const campaign = await Campaigns.findOne({ where: { id: campaignId, tenantId } });
  if (!campaign) throw notFound("Campaign not found");

  const pipeline = await Pipelines.findOne({
    where: { id: campaign.pipelineId, tenantId },
    attributes: ["id", "pipeline"],
  });

  const stages = await PipelineStages.findAll({
    where: { pipelineId: campaign.pipelineId },
    attributes: ["id", "name", "position", "probability", "color", "isWon", "isLost", "isTerminal"],
    order: [["position", "ASC"], ["id", "ASC"]],
  });

  const [totalLeads, totalActive, totalStages, totalTags, grouped, uploads] = await Promise.all([
    CampaignLeads.count({ where: { tenantId, campaignId } }),
    CampaignLeads.count({
      where: { tenantId, campaignId, status: { [Op.notIn]: CLOSED_STATUSES } },
    }),
    Promise.resolve(stages.length),
    StageTags.count({
      where: { tenantId, stageId: { [Op.in]: stages.map((s) => s.id) } },
    }),
    // Grouped here rather than per stage, so this is one query, not N.
    CampaignLeads.findAll({
      where: { tenantId, campaignId },
      attributes: ["stageId", [fn("COUNT", col("id")), "count"]],
      group: ["stageId"],
      raw: true,
    }),
    CampaignUploads.findAll({
      where: { tenantId, campaignId },
      order: [["CreatedAt", "DESC"]],
      limit: 25,
    }),
  ]);

  const countByStage = new Map(grouped.map((row) => [row.stageId, Number(row.count)]));

  // Stages with no leads still appear, at 0, so the shape of the pipeline is
  // visible instead of only the stage that happens to hold everyone.
  const stageDistribution = stages.map((stage) => {
    const count = countByStage.get(stage.id) ?? 0;
    return {
      stageId: stage.id,
      name: stage.name,
      color: stage.color,
      isWon: stage.isWon,
      isLost: stage.isLost,
      isTerminal: stage.isTerminal,
      leads: count,
      percent: totalLeads === 0 ? 0 : Number(((count / totalLeads) * 100).toFixed(1)),
    };
  });

  // Leads whose stageId is null, or points at a stage that has since been
  // deleted, so they belong to no column in the distribution above.
  const stageIds = new Set(stages.map((s) => s.id));
  const unplacedLeads = grouped
    .filter((row) => row.stageId === null || !stageIds.has(row.stageId))
    .reduce((sum, row) => sum + Number(row.count), 0);

  const tags = stages.length
    ? await StageTags.findAll({
        where: { tenantId, stageId: { [Op.in]: stages.map((s) => s.id) } },
        attributes: ["id", "stageId", "name", "color"],
        order: [["position", "ASC"]],
      })
    : [];

  const tagsByStage = stages.map((stage) => ({
    stageId: stage.id,
    stageName: stage.name,
    tags: tags
      .filter((tag) => tag.stageId === stage.id)
      .map((tag) => ({ id: tag.id, name: tag.name, color: tag.color, leads: 0 })),
  }));

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      Status: campaign.Status,
      priority: campaign.priority,
      priorityLabel: PRIORITY_LABEL[campaign.priority] ?? "Medium",
      leadDistribution: campaign.leadDistribution,
      duplicateScope: campaign.duplicateScope,
      duplicateAction: campaign.duplicateAction,
      createdAt: campaign.CreatedAt,
    },
    pipeline: pipeline ? { id: pipeline.id, name: pipeline.pipeline } : null,
    totals: {
      totalLeads,
      activeLeads: totalActive,
      totalStages,
      totalTags,
      // A pipeline with no stages would divide by zero; report 0 instead.
      avgLeadsPerStage: totalStages === 0 ? 0 : Number((totalLeads / totalStages).toFixed(1)),
      unplacedLeads,
    },
    stageDistribution,
    tagsByStage: tagsByStage.filter((group) => group.tags.length > 0),
    uploads: uploads.map((upload) => ({
      id: upload.id,
      fileName: upload.fileName,
      // Tells the UI whether the download button can do anything.
      fileStored: Boolean(upload.fileKey),
      source: upload.source,
      sizeBytes: upload.sizeBytes,
      totalRows: upload.totalRows,
      created: upload.created,
      merged: upload.merged,
      ignored: upload.ignored,
      skipped: upload.skipped,
      Status: upload.Status,
      uploadedBy: upload.uploadedByName,
      uploadedAt: upload.CreatedAt,
      pipeline: pipeline?.pipeline ?? null,
    })),
  };
};
