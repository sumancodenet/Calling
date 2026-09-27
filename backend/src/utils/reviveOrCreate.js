/**
 * Soft delete + unique index conflict.
 *
 * These tables are `paranoid`, but their unique indexes are built on business
 * keys only - e.g. UNIQUE (pipelineId, name) - and do NOT include DeletedAt.
 * So a soft-deleted row keeps occupying its name, and a later create() with the
 * same name fails with a raw duplicate-key error that surfaces as a 500.
 *
 * (MySQL cannot fix this in the index either: NULLs in a unique index are always
 * treated as distinct, so UNIQUE (pipelineId, name, DeletedAt) would stop
 * enforcing uniqueness for every *active* row.)
 *
 * So instead: find the soft-deleted row and revive it, updating it with the new
 * values. Re-adding a name you previously deleted revives that row and keeps its
 * history instead of colliding.
 */
export const reviveOrCreate = async (Model, { where, defaults = {}, transaction }) => {
  // paranoid: false is essential: the point is to find the soft-deleted row, and
  // the default scope hides it. Without this it falls through to create() and
  // dies on the unique index.
  const existing = await Model.findOne({ where, paranoid: false, transaction });

  if (!existing) {
    return { instance: await Model.create({ ...where, ...defaults }, { transaction }), revived: false };
  }

  // The physical column is `DeletedAt`; with no attributes override this reads
  // correctly. (An attribute fetched through an alias has no plain property, so
  // .get() is required if the select list is ever narrowed.)
  if (existing.get("DeletedAt")) {
    await existing.restore({ transaction });
    if (Object.keys(defaults).length > 0) {
      await existing.update(defaults, { transaction });
    }
    return { instance: existing, revived: true };
  }

  return { instance: existing, revived: false };
};

export default reviveOrCreate;
