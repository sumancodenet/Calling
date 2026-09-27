import { Op } from "sequelize";
import { Pipelines, PipelineStages, StageTags } from "../../../models/index.js";
import { badRequest, conflict, notFound } from "../../../utils/AppError.js";
import { reviveOrCreate } from "../../../utils/reviveOrCreate.js";

const trim = (v) => (v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim());
const WON_WORDS = ["won", "closed won", "converted", "sold", "success"];
const LOST_WORDS = ["lost", "closed lost", "junk", "rejected", "failed", "not interested"];

/** Derives the terminal flags from the stage name, unless explicitly supplied. */
const deriveFlags = (name, isWon, isLost) => {
  const lower = String(name).toLowerCase();
  const won = isWon === undefined ? WON_WORDS.includes(lower) : Boolean(isWon);
  const lost = isLost === undefined ? LOST_WORDS.includes(lower) : Boolean(isLost);
  return { isWon: won, isLost: lost, isTerminal: won || lost };
};

const publicTag = (tag) => ({ id: tag.id, name: tag.name, color: tag.color, position: tag.position });

const publicStage = (stage) => ({
  id: stage.id,
  pipelineId: stage.pipelineId,
  name: stage.name,
  description: stage.description,
  position: stage.position,
  probability: stage.probability,
  color: stage.color,
  isWon: stage.isWon,
  isLost: stage.isLost,
  isTerminal: stage.isTerminal,
  tags: (stage.tags ?? []).map(publicTag).sort((a, b) => a.position - b.position),
});

const publicPipeline = (pipeline) => ({
  id: pipeline.id,
  name: pipeline.pipeline,
  description: pipeline.description,
  isDefault: pipeline.isDefault,
  position: pipeline.position,
  Status: pipeline.Status,
  stageCount: pipeline.stages?.length ?? 0,
  stages: (pipeline.stages ?? []).map(publicStage).sort((a, b) => a.position - b.position),
});

// ---------------------------------------------------------------- pipelines

export const listPipelines = async ({ tenantId, query = {} }) => {
  const where = { tenantId };
  if (query.Status) where.Status = query.Status;

  const pipelines = await Pipelines.findAll({
    where,
    include: [
      {
        model: PipelineStages,
        as: "stages",
        required: false,
        include: [{ model: StageTags, as: "tags", required: false }],
        order: [
          [{ model: PipelineStages, as: "stages" }, "position", "ASC"],
          [{ model: StageTags, as: "tags" }, "position", "ASC"],
        ],
      },
    ],
    order: [
      ["position", "ASC"],
      ["id", "ASC"],
    ],
  });

  return pipelines.map(publicPipeline);
};

const findPipeline = async (tenantId, id) => {
  const pipeline = await Pipelines.findOne({
    where: { id, tenantId },
    include: [
      {
        model: PipelineStages,
        as: "stages",
        required: false,
        include: [{ model: StageTags, as: "tags", required: false }],
      },
    ],
  });
  if (!pipeline) throw notFound("Pipeline not found");
  return pipeline;
};

export const getPipeline = async ({ tenantId, id }) => publicPipeline(await findPipeline(tenantId, id));

/**
 * `paranoid: false` sees soft-deleted rows, and their key is still held by the
 * unique index. Two gotchas, both hit while building this:
 *   - the column is physically `DeletedAt`, so request it by that name
 *   - an attribute fetched via an alias has no plain property, so it must be
 *     read with .get() - `row.DeletedAt` is silently undefined
 */
const isSoftDeleted = (row) => Boolean(row?.get?.("DeletedAt") ?? row?.DeletedAt);

const findAny = (Model, where) => Model.findOne({ where, attributes: ["id", "DeletedAt"], paranoid: false });

const assertNameFree = async (tenantId, name, pipelineId) => {
  const clash = await findAny(Pipelines, {
    tenantId,
    pipeline: name,
    ...(pipelineId ? { id: { [Op.ne]: pipelineId } } : {}),
  });
  if (clash && !isSoftDeleted(clash)) {
    throw conflict(`A pipeline named "${name}" already exists`);
  }
  return isSoftDeleted(clash) ? { revive: clash } : null;
};

export const createPipeline = async ({ tenantId, body }) => {
  const name = trim(body.name);
  if (!name) throw badRequest("Pipeline name is required");

  const soft = await assertNameFree(tenantId, name, null);

  // A pipeline can be created with its stages in one call, which is the common
  // admin flow: define the whole flow, not an empty shell.
  const stageInput = Array.isArray(body.stages) ? body.stages : [];

  const created = await Pipelines.sequelize.transaction(async (t) => {
    const pipeline = soft?.revive
      ? await reviveOrCreate(
          Pipelines,
          { where: { tenantId, pipeline: name }, defaults: {}, transaction: t },
        ).then((r) => r.instance)
      : await Pipelines.create(
          {
            tenantId,
            pipeline: name,
            description: trim(body.description),
            isDefault: Boolean(body.isDefault),
            position: Number.isInteger(body.position) ? body.position : await nextPipelinePosition(tenantId, t),
            Status: "ACTIVE",
          },
          { transaction: t },
        );

    if (soft?.revive) {
      await pipeline.update(
        {
          description: trim(body.description),
          isDefault: Boolean(body.isDefault),
          Status: "ACTIVE",
          ...(Number.isInteger(body.position) ? { position: body.position } : {}),
        },
        { transaction: t },
      );
    }

    if (stageInput.length > 0) {
      const stages = await PipelineStages.bulkCreate(
        stageInput.map((s, i) => {
          const stageName = trim(s.name);
          return {
            tenantId,
            pipelineId: pipeline.id,
            name: stageName,
            description: trim(s.description),
            position: Number.isInteger(s.position) ? s.position : i,
            probability: s.probability ?? null,
            color: trim(s.color),
            ...deriveFlags(stageName, s.isWon, s.isLost),
          };
        }),
        { transaction: t },
      );

      // Stages can carry their tags inline too, otherwise a stage created here
      // would come back with none while createStage() accepts tags.
      const rows = [];
      stages.forEach((stage, i) => {
        (stageInput[i].tags ?? []).forEach((tag, tagIndex) => {
          const tagName = trim(typeof tag === "string" ? tag : tag?.name);
          if (tagName) {
            rows.push({
              tenantId,
              stageId: stage.id,
              name: tagName,
              color: trim(typeof tag === "string" ? null : tag?.color),
              position: tagIndex,
            });
          }
        });
      });
      if (rows.length > 0) await StageTags.bulkCreate(rows, { transaction: t });
    }

    return pipeline;
  });

  return getPipeline({ tenantId, id: created.id });
};

export const updatePipeline = async ({ tenantId, id, body }) => {
  const pipeline = await Pipelines.findOne({ where: { id, tenantId } });
  if (!pipeline) throw notFound("Pipeline not found");

  const patch = {};
  if (body.name !== undefined) {
    const name = trim(body.name);
    if (!name) throw badRequest("Pipeline name cannot be empty");
    await assertNameFree(tenantId, name, pipeline.id);
    patch.pipeline = name;
  }
  if (body.description !== undefined) patch.description = trim(body.description);
  if (body.position !== undefined && Number.isInteger(body.position)) patch.position = body.position;
  if (body.Status !== undefined) patch.Status = String(body.Status).toUpperCase() === "ARCHIVED" ? "ARCHIVED" : "ACTIVE";

  if (body.isDefault !== undefined && Boolean(body.isDefault) !== pipeline.isDefault) {
    await Pipelines.update({ isDefault: false }, { where: { tenantId } });
    patch.isDefault = Boolean(body.isDefault);
  }

  if (Object.keys(patch).length === 0) throw badRequest("Nothing to update");

  await pipeline.update(patch);
  return getPipeline({ tenantId, id: pipeline.id });
};

export const deletePipeline = async ({ tenantId, id }) => {
  const pipeline = await Pipelines.findOne({ where: { id, tenantId } });
  if (!pipeline) throw notFound("Pipeline not found");

  const stages = await PipelineStages.findAll({ where: { pipelineId: id, tenantId }, attributes: ["id"] });
  const stageIds = stages.map((s) => s.id);
  const tagsRemoved = stageIds.length
    ? await StageTags.destroy({ where: { stageId: { [Op.in]: stageIds }, tenantId } })
    : 0;

  // These models are paranoid, so a soft delete does NOT cascade in the
  // database - the children have to be removed explicitly or they would be
  // left orphaned and invisible.
  await PipelineStages.destroy({ where: { pipelineId: id, tenantId } });
  await pipeline.destroy();

  return { id, name: pipeline.pipeline, deleted: true, stagesRemoved: stages.length, tagsRemoved };
};

// ---------------------------------------------------------------- stages

const nextPipelinePosition = async (tenantId, t) => {
  const max = await Pipelines.max("position", { where: { tenantId }, transaction: t });
  return (max ?? -1) + 1;
};

const nextStagePosition = async (pipelineId, t) => {
  const max = await PipelineStages.max("position", { where: { pipelineId }, transaction: t });
  return (max ?? -1) + 1;
};

const findStage = async (tenantId, pipelineId, stageId) => {
  const stage = await PipelineStages.findOne({ where: { id: stageId, pipelineId, tenantId } });
  if (!stage) throw notFound("Stage not found");
  return stage;
};

export const createStage = async ({ tenantId, pipelineId, body }) => {
  const pipeline = await Pipelines.findOne({ where: { id: pipelineId, tenantId }, attributes: ["id"] });
  if (!pipeline) throw notFound("Pipeline not found");

  const name = trim(body.name);
  if (!name) throw badRequest("Stage name is required");

  const clash = await findAny(PipelineStages, { pipelineId, name });
  if (clash && !isSoftDeleted(clash)) {
    throw conflict(`This pipeline already has a stage called "${name}"`);
  }

  const tagInput = Array.isArray(body.tags) ? body.tags : [];

  const created = await PipelineStages.sequelize.transaction(async (t) => {
    if (isSoftDeleted(clash)) {
      const { instance: revived } = await reviveOrCreate(PipelineStages, { where: { id: clash.id }, transaction: t });
      await revived.update(
        {
          name,
          description: trim(body.description),
          probability: body.probability ?? null,
          color: trim(body.color),
          position: Number.isInteger(body.position) ? body.position : revived.position,
          ...deriveFlags(name, body.isWon, body.isLost),
        },
        { transaction: t },
      );
      return revived;
    }

    const stage = await PipelineStages.create(
      {
        tenantId,
        pipelineId,
        name,
        description: trim(body.description),
        position: Number.isInteger(body.position) ? body.position : await nextStagePosition(pipelineId, t),
        probability: body.probability ?? null,
        color: trim(body.color),
        ...deriveFlags(name, body.isWon, body.isLost),
      },
      { transaction: t },
    );

    if (tagInput.length > 0) {
      await StageTags.bulkCreate(
        tagInput
          .map((tag, i) => ({ name: trim(tag.name ?? tag), position: i }))
          .filter((tag) => tag.name)
          .map((tag) => ({ tenantId, stageId: stage.id, ...tag })),
        { transaction: t },
      );
    }

    return stage;
  });

  return getStage({ tenantId, pipelineId, stageId: created.id });
};

export const getStage = async ({ tenantId, pipelineId, stageId }) => {
  const stage = await PipelineStages.findOne({
    where: { id: stageId, pipelineId, tenantId },
    include: [{ model: StageTags, as: "tags", required: false, order: [["position", "ASC"]] }],
  });
  if (!stage) throw notFound("Stage not found");
  return publicStage(stage);
};

export const updateStage = async ({ tenantId, pipelineId, stageId, body }) => {
  const stage = await findStage(tenantId, pipelineId, stageId);

  const patch = {};
  if (body.name !== undefined) {
    const name = trim(body.name);
    if (!name) throw badRequest("Stage name cannot be empty");
    const clash = await PipelineStages.findOne({ where: { pipelineId, name, id: { [Op.ne]: stageId } }, attributes: ["id"] });
    if (clash) throw conflict(`This pipeline already has a stage called "${name}"`);
    patch.name = name;
  }
  if (body.description !== undefined) patch.description = trim(body.description);
  if (body.position !== undefined && Number.isInteger(body.position)) patch.position = body.position;
  if (body.probability !== undefined) patch.probability = body.probability === null ? null : Number(body.probability);
  if (body.color !== undefined) patch.color = trim(body.color);

  if (body.isWon !== undefined || body.isLost !== undefined || patch.name !== undefined) {
    Object.assign(patch, deriveFlags(patch.name ?? stage.name, body.isWon, body.isLost));
  }

  if (Object.keys(patch).length === 0) throw badRequest("Nothing to update");

  await stage.update(patch);
  return getStage({ tenantId, pipelineId, stageId });
};

export const deleteStage = async ({ tenantId, pipelineId, stageId }) => {
  const stage = await findStage(tenantId, pipelineId, stageId);

  const remaining = await PipelineStages.count({ where: { pipelineId } });
  if (remaining <= 1) {
    throw conflict("A pipeline needs at least one stage");
  }

  await StageTags.destroy({ where: { stageId, tenantId } });
  await stage.destroy();

  return { id: stageId, name: stage.name, deleted: true };
};

// ---------------------------------------------------------------- tags

export const createTag = async ({ tenantId, pipelineId, stageId, body }) => {
  const stage = await findStage(tenantId, pipelineId, stageId);

  const name = trim(body.name);
  if (!name) throw badRequest("Tag name is required");

  const clash = await findAny(StageTags, { stageId, name });
  if (clash && !isSoftDeleted(clash)) {
    throw conflict(`"${stage.name}" already has a tag called "${name}"`);
  }

  if (isSoftDeleted(clash)) {
    const { instance: revived } = await reviveOrCreate(StageTags, { where: { id: clash.id } });
    await revived.update({ name, color: trim(body.color) });
    return publicTag(revived);
  }

  const max = await StageTags.max("position", { where: { stageId } });

  const tag = await StageTags.create({
    tenantId,
    stageId,
    name,
    color: trim(body.color),
    position: (max ?? -1) + 1,
  });

  return publicTag(tag);
};

export const updateTag = async ({ tenantId, pipelineId, stageId, tagId, body }) => {
  await findStage(tenantId, pipelineId, stageId);

  const tag = await StageTags.findOne({ where: { id: tagId, stageId, tenantId } });
  if (!tag) throw notFound("Tag not found");

  if (body.name !== undefined) {
    const name = trim(body.name);
    if (!name) throw badRequest("Tag name cannot be empty");
    const clash = await StageTags.findOne({ where: { stageId, name, id: { [Op.ne]: tagId } }, attributes: ["id"] });
    if (clash) throw conflict(`This stage already has a tag called "${name}"`);
    tag.name = name;
  }
  if (body.color !== undefined) tag.color = trim(body.color);
  if (body.position !== undefined && Number.isInteger(body.position)) tag.position = body.position;

  await tag.save();
  return publicTag(tag);
};

export const deleteTag = async ({ tenantId, pipelineId, stageId, tagId }) => {
  await findStage(tenantId, pipelineId, stageId);

  const tag = await StageTags.findOne({ where: { id: tagId, stageId, tenantId } });
  if (!tag) throw notFound("Tag not found");

  await tag.destroy();
  return { id: tagId, name: tag.name, deleted: true };
};

export { deriveFlags, publicPipeline, publicStage, publicTag };
