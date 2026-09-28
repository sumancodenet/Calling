import { DataTypes } from "sequelize";
import sequelize from "../../../config/sequelize.js";

export const IMPORT_STATUS = Object.freeze({
  COMPLETED: "COMPLETED",
  PARTIAL: "PARTIAL",
  FAILED: "FAILED",
});

/**
 * One spreadsheet import into a campaign.
 *
 * Kept separately from the leads so the campaign can show what was uploaded,
 * by whom and when, long after the individual rows have moved on. Without it the
 * "Campaign CSV details" table has nothing to show.
 */
const CampaignUploads = sequelize.define(
  "CampaignUploads",
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
    pipelineId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // S3 object key for the original file. Null when storage is not configured,
    // or for rows recorded before storage existed.
    fileKey: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    source: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    sizeBytes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Rows read from the sheet, before any duplicate policy was applied.
    totalRows: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    created: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    merged: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    ignored: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    allowedDuplicates: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    skipped: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    Status: {
      type: DataTypes.ENUM(...Object.values(IMPORT_STATUS)),
      allowNull: false,
      defaultValue: IMPORT_STATUS.COMPLETED,
    },
    // Nobody can be deleted outright, so the name is copied rather than joined.
    uploadedByName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "CampaignUploads",
    paranoid: true,
    deletedAt: "DeletedAt",
    timestamps: true,
    createdAt: "CreatedAt",
    updatedAt: "UpdatedAt",
    indexes: [
      { fields: ["tenantId"] },
      { fields: ["campaignId", "CreatedAt"] },
    ],
  },
);

export default CampaignUploads;
