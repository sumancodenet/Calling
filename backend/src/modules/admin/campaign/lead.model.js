import { DataTypes } from "sequelize";
import sequelize from "../../../config/sequelize.js";

export const LEAD_STATUS = Object.freeze({
  NEW: "NEW",
  ASSIGNED: "ASSIGNED",
  CONTACTED: "CONTACTED",
  QUALIFIED: "QUALIFIED",
  CONVERTED: "CONVERTED",
  DO_NOT_CALL: "DO_NOT_CALL",
});

export const LEAD_SOURCES = Object.freeze({
  CSV: "CSV",
  EXCEL: "EXCEL",
});

/**
 * One lead sitting in a campaign, i.e. one row of an uploaded spreadsheet.
 *
 * pipelineId is denormalised from the campaign so a lead can be moved between
 * stages without joining through Campaigns on every read.
 *
 * There is deliberately NO unique index on the dedupe key: a campaign set to
 * "allow duplicates" must be able to hold the same contact twice, and a unique
 * index would make that impossible. Uniqueness is a policy the upload decides,
 * not a database constraint - see dedupeKey in lead.service.js.
 */
const CampaignLeads = sequelize.define(
  "CampaignLeads",
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
    // Which import created this lead. Nullable so leads that predate upload
    // history, or arrive from anywhere other than a spreadsheet, are allowed.
    uploadId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    pipelineId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    stageId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Stable identity for duplicate detection - phone if present, else email.
    dedupeKey: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(LEAD_STATUS)),
      allowNull: false,
      defaultValue: LEAD_STATUS.NEW,
    },
    assignedTo: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    assignedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Set when this row was accepted despite matching an earlier lead.
    duplicateOf: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    source: {
      type: DataTypes.ENUM(...Object.values(LEAD_SOURCES)),
      allowNull: false,
      defaultValue: LEAD_SOURCES.CSV,
    },
    // Anything from the sheet we had no column for, kept rather than dropped.
    extra: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "CampaignLeads",
    paranoid: true,
    deletedAt: "DeletedAt",
    timestamps: true,
    createdAt: "CreatedAt",
    updatedAt: "UpdatedAt",
    indexes: [
      { fields: ["tenantId"] },
      { fields: ["campaignId"] },
      { fields: ["campaignId", "uploadId"] },
      { fields: ["campaignId", "dedupeKey"] },
      { fields: ["tenantId", "dedupeKey"] },
      { fields: ["stageId"] },
      { fields: ["assignedTo"] },
    ],
  },
);

export default CampaignLeads;
