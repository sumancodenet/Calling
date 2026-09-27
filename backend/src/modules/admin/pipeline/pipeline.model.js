import { DataTypes } from "sequelize";
import sequelize from "../../../config/sequelize.js";

/**
 * A pipeline, e.g. "Real Estate Sales". Owns an ordered list of
 * PipelineStages, each of which owns StageTags.
 */
const Pipelines = sequelize.define(
  "Pipelines",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tenantId: { type: DataTypes.INTEGER, allowNull: false },
    pipeline: { type: DataTypes.STRING, allowNull: false, validate: { notEmpty: true } },
    description: { type: DataTypes.STRING(255), allowNull: true },
    isDefault: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    Status: { type: DataTypes.ENUM("ACTIVE", "ARCHIVED"), allowNull: false, defaultValue: "ACTIVE" },
  },
  {
    tableName: "Pipelines",
    paranoid: true,
    deletedAt: "DeletedAt",
    timestamps: true,
    createdAt: "CreatedAt",
    updatedAt: "UpdatedAt",
    indexes: [
      { unique: true, fields: ["tenantId", "pipeline"] },
      { fields: ["tenantId", "position"] },
    ],
  },
);

export default Pipelines;
