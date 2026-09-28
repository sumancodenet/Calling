import { DataTypes } from "sequelize";
import sequelize from "../../../config/sequelize.js";

/**
 * Which agents work a campaign, and in what order they are offered leads.
 *
 * A join table rather than a JSON column on Campaigns: the agent list has to be
 * queryable on its own ("which campaigns is this agent on?") and the row order
 * is the rotation order used by EQUAL distribution.
 */
const CampaignAgents = sequelize.define(
  "CampaignAgents",
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
    campaignId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // Rotation order for EQUAL distribution; lowest first.
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "CampaignAgents",
    timestamps: true,
    createdAt: "CreatedAt",
    updatedAt: "UpdatedAt",
    indexes: [
      // One row per agent per campaign, so the same agent cannot be added twice.
      { unique: true, fields: ["campaignId", "userId"] },
      { fields: ["tenantId"] },
      { fields: ["userId"] },
    ],
  },
);

export default CampaignAgents;
