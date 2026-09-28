-- Links each lead back to the spreadsheet import that created it, so the
-- campaign can show "leads from this file" and delete a file's leads together.
--
-- Nullable on purpose: leads imported before this column existed (or created by
-- anything other than an upload) have no upload to point at.
--
-- Apply with:  node scripts/apply-sql.js sql/003_lead_upload_id.sql

ALTER TABLE `CampaignLeads`
  ADD COLUMN `uploadId` INT NULL AFTER `campaignId`;

CREATE INDEX `campaign_leads_upload_id` ON `CampaignLeads` (`uploadId`);

-- The delete path looks rows up by campaign + upload together, so the index is
-- on the pair rather than uploadId alone.
CREATE INDEX `campaign_leads_campaign_upload` ON `CampaignLeads` (`campaignId`, `uploadId`);
