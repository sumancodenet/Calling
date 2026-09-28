-- Stores the S3 object key for the original uploaded spreadsheet, so a download
-- can mint a presigned URL for that exact object.
--
-- Nullable: rows written before S3 storage existed have no key, and those
-- uploads were parsed and discarded, so there is nothing to point at.
--
-- Apply with:  node scripts/apply-sql.js sql/004_upload_file_key.sql

ALTER TABLE `CampaignUploads`
  ADD COLUMN `fileKey` VARCHAR(512) NULL AFTER `fileName`;

CREATE INDEX `campaign_uploads_file_key` ON `CampaignUploads` (`fileKey`);
