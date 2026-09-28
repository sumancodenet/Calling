import { DataTypes } from "sequelize";
import sequelize from "../../../config/sequelize.js";

/** How leads are handed out to the agents on a campaign. */
export const LEAD_DISTRIBUTIONS = Object.freeze({
  ON_DEMAND: "ON_DEMAND",
  EQUAL: "EQUAL",
  CONDITIONAL: "CONDITIONAL",
});

/** How wide the duplicate search reaches. */
export const DUPLICATE_SCOPES = Object.freeze({
  GLOBAL: "GLOBAL",
  CAMPAIGN: "CAMPAIGN",
});

/** What to do with a lead that is already on file. */
export const DUPLICATE_ACTIONS = Object.freeze({
  IGNORE: "IGNORE",
  MERGE: "MERGE",
  ALLOW: "ALLOW",
});

export const CAMPAIGN_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  ARCHIVED: "ARCHIVED",
});

export const PRIORITY_MIN = 1;
export const PRIORITY_MAX = 5;

/**
 * A campaign is one push of leads through a pipeline, owned by a manager and
 * worked by a set of agents. The lead records themselves are not modelled yet;
 * this table carries the configuration those records will be handed out by.
 */
const Campaigns = sequelize.define(
  "Campaigns",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    pipelineId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true, len: [1, 120] },
    },
    // The admin or subadmin accountable for this campaign.
    managerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    leadDistribution: {
      type: DataTypes.ENUM(...Object.values(LEAD_DISTRIBUTIONS)),
      allowNull: false,
      defaultValue: LEAD_DISTRIBUTIONS.EQUAL,
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
      validate: { min: PRIORITY_MIN, max: PRIORITY_MAX },
    },
    // "Check for duplicates" - how far the search reaches.
    duplicateScope: {
      type: DataTypes.ENUM(...Object.values(DUPLICATE_SCOPES)),
      allowNull: false,
      defaultValue: DUPLICATE_SCOPES.CAMPAIGN,
    },
    // "If duplicate found" - what happens to it.
    duplicateAction: {
      type: DataTypes.ENUM(...Object.values(DUPLICATE_ACTIONS)),
      allowNull: false,
      defaultValue: DUPLICATE_ACTIONS.IGNORE,
    },
    Status: {
      type: DataTypes.ENUM(...Object.values(CAMPAIGN_STATUS)),
      allowNull: false,
      defaultValue: CAMPAIGN_STATUS.DRAFT,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "Campaigns",
    paranoid: true,
    deletedAt: "DeletedAt",
    timestamps: true,
    createdAt: "CreatedAt",
    updatedAt: "UpdatedAt",
    indexes: [
      { unique: true, fields: ["tenantId", "pipelineId", "name"] },
      { fields: ["tenantId"] },
      { fields: ["managerId"] },
      { fields: ["tenantId", "Status"] },
    ],
  },
);

export default Campaigns;
