import { DataTypes } from "sequelize";
import sequelize from "../../../config/sequelize.js";

/**
 * One step of a pipeline, e.g. "Fresh Enquiry" or "Deposit Status".
 * A stage marked isWon/isLost is terminal: deals reaching it are closed.
 */
const PipelineStages = sequelize.define(
  "PipelineStages",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tenantId: { type: DataTypes.INTEGER, allowNull: false },
    pipelineId: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false, validate: { notEmpty: true } },
    description: { type: DataTypes.STRING(255), allowNull: true },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    probability: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 0, max: 100 } },
    color: { type: DataTypes.STRING(20), allowNull: true },
    isWon: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    isLost: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    isTerminal: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    tableName: "PipelineStages",
    paranoid: true,
    deletedAt: "DeletedAt",
    timestamps: true,
    createdAt: "CreatedAt",
    updatedAt: "UpdatedAt",
    indexes: [
      { unique: true, fields: ["pipelineId", "name"] },
      { fields: ["pipelineId", "position"] },
      { fields: ["tenantId"] },
    ],
  },
);

export default PipelineStages;
