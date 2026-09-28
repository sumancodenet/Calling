import { Op } from "sequelize";
// The sync parser, not the async one: in csv-parse v7 the async parse() resolves
// to a *stream* rather than to the records, so awaiting it gave a stream object
// and rows[0] came back undefined. The upload is already fully in memory
// (multer memoryStorage), so there is nothing to stream.
import { parse as parseCsv } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { CampaignLeads, Campaigns, Users, PipelineStages, CampaignUploads } from "../../../models/index.js";
import { badRequest, notFound } from "../../../utils/AppError.js";
import env from "../../../config/env.js";
import { buildKey, uploadBuffer, removeObject, presignDownload } from "../../../config/storage.js";
import { LEAD_STATUS, LEAD_SOURCES } from "./lead.model.js";
import { LEAD_DISTRIBUTIONS, DUPLICATE_SCOPES, DUPLICATE_ACTIONS } from "./campaign.model.js";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_ROWS = 5000;

/** The lead fields an admin can map a spreadsheet column onto. */
export const MAPPABLE_FIELDS = Object.freeze([
  { field: "name", label: "Name", required: false, hint: "Falls back to phone or email when empty" },
  { field: "phone", label: "Phone", required: false, hint: "Primary duplicate key" },
  { field: "email", label: "Email", required: false, hint: "Used for duplicate checks when phone is absent" },
  { field: "city", label: "City", required: false, hint: "Optional" },
]);

const MAPPABLE = new Set(MAPPABLE_FIELDS.map((f) => f.field));

/** Header names people actually type, used to pre-fill the mapping. */
const COLUMN_ALIASES = {
  name: ["name", "fullname", "full name", "lead", "lead name", "contact", "contact name", "customer"],
  phone: ["phone", "phoneno", "phone no", "phone number", "mobile", "mobile no", "contact number", "number"],
  email: ["email", "e-mail", "emailaddress", "email address", "mail"],
  city: ["city", "town", "location", "district"],
};

const norm = (header) => String(header ?? "").trim().toLowerCase().replace(/[_.\-]+/g, " ").replace(/\s+/g, " ");

const findColumn = (headers, field) => {
  const aliases = COLUMN_ALIASES[field];
  return headers.findIndex((h) => aliases.includes(norm(h)));
};

/**
 * Works out which spreadsheet column feeds which lead field.
 *
 * The admin's explicit choice always wins. Where they left something unmapped
 * we fall back to the alias guess, so a simple CSV still imports with no
 * mapping step at all.
 */
const resolveMapping = (headers, mapping) => {
  const resolved = {};
  const headerSet = new Set(headers.map((h) => String(h).trim()));

  for (const { field } of MAPPABLE_FIELDS) {
    const chosen = mapping?.[field];
    // A mapping value must be a header that actually exists in the file,
    // otherwise a caller could name any column it liked.
    if (chosen && headerSet.has(String(chosen).trim())) {
      resolved[field] = headers.indexOf(String(chosen).trim());
    } else if (chosen) {
      throw badRequest(`"${chosen}" is not a column in this file`);
    } else {
      resolved[field] = findColumn(headers, field);
    }
  }

  if (resolved.name === -1 && resolved.phone === -1 && resolved.email === -1) {
    throw badRequest(
      `Map at least one of ${MAPPABLE_FIELDS.filter((f) => f.field !== "city").map((f) => f.label).join(", ")} to a column`,
    );
  }

  return resolved;
};

/** Strips a leading + and separators so the same number matches across formats. */
const normalisePhone = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  return digits.length > 15 ? digits.slice(0, 15) : digits;
};

const normaliseEmail = (value) => {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw.includes("@") ? raw : null;
};

/**
 * Phone first, because it is the more stable identifier for a call campaign;
 * email is the fallback. Whichever is used becomes the dedupe key.
 */
const buildDedupeKey = (phone, email) => phone ? `p:${phone}` : email ? `e:${email}` : null;

/** Turns one sheet row into a lead candidate, or null when it is unusable. */
const rowToCandidate = (row, indexes) => {
  const pick = (field) => {
    const i = indexes[field];
    return i === -1 ? null : row[i];
  };

  const phone = normalisePhone(pick("phone"));
  const email = normaliseEmail(pick("email"));
  const city = String(pick("city") ?? "").trim() || null;
  const name = String(pick("name") ?? "").trim() || phone || email;

  if (!name) return null;

  const dedupeKey = buildDedupeKey(phone, email);
  // Nothing to dedupe on and nothing to call: keep it only if we have a name,
  // but it can never be detected as a duplicate later.
  return { name, phone, email, city, dedupeKey };
};

const parseCsvBuffer = (buffer) => {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  return parseCsv(text, {
    columns: false,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });
};

const parseExcelBuffer = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    // eachRow yields a 1-based row, so normalise to a 0-based array.
    const values = row.values;
    rows.push(Array.isArray(values) ? values.slice(1) : []);
  });
  return rows;
};

export const parseUpload = async ({ buffer, mimetype, originalname, mapping, previewOnly = false }) => {
  const ext = String(originalname ?? "").toLowerCase().split(".").pop();
  const isCsv = ext === "csv" || mimetype?.includes("csv") || mimetype === "text/plain";
  const isExcel = ["xlsx", "xls"].includes(ext) || mimetype?.includes("spreadsheet") || mimetype?.includes("excel");

  if (!isCsv && !isExcel) {
    throw badRequest("Upload a .csv, .xls or .xlsx file");
  }

  const rows = isCsv ? parseCsvBuffer(buffer) : await parseExcelBuffer(buffer);
  if (rows.length === 0) throw badRequest("That file is empty");
  if (rows.length - 1 > MAX_ROWS) {
    throw badRequest(`Too many rows. The limit is ${MAX_ROWS} per upload`);
  }

  const headers = rows[0].map((h, i) => String(h ?? "").trim() || `Column ${i + 1}`);
  const body = rows.slice(1);
  const indexes = resolveMapping(headers, mapping);

  // Preview stops here: the admin has not chosen a mapping yet, so nothing is
  // validated beyond "is this a file we can read at all".
  if (previewOnly) {
    return {
      source: isCsv ? LEAD_SOURCES.CSV : LEAD_SOURCES.EXCEL,
      headers,
      mapping: MAPPABLE_FIELDS.map(({ field, label, hint }) => ({
        field,
        label,
        hint,
        // Pre-selected suggestion so the admin confirms rather than starts blind.
        suggested: indexes[field] === -1 ? null : headers[indexes[field]],
      })),
      sampleRows: body.slice(0, 5).map((row) => headers.map((_, i) => String(row?.[i] ?? ""))),
      totalRows: body.length,
    };
  }

  const candidates = [];
  let skippedBlank = 0;
  const mappedIndexes = new Set(Object.values(indexes).filter((i) => i !== -1));

  for (const row of body) {
    const candidate = rowToCandidate(row, indexes);
    if (!candidate) {
      skippedBlank++;
      continue;
    }
    // Anything the sheet had that we have no column for is kept, not dropped.
    const extra = {};
    row.forEach((value, i) => {
      if (mappedIndexes.has(i)) return;
      const header = String(headers[i] ?? "").trim();
      if (!header || value === null || value === undefined || String(value).trim() === "") return;
      extra[header] = typeof value === "object" ? String(value) : value;
    });
    if (Object.keys(extra).length > 0) candidate.extra = extra;
    candidates.push(candidate);
  }

  if (candidates.length === 0) {
    throw badRequest("No usable rows found. Every row needs at least a name, phone or email.");
  }

  return {
    source: isCsv ? LEAD_SOURCES.CSV : LEAD_SOURCES.EXCEL,
    candidates,
    skippedBlank,
    headers,
  };
};

/** Picks the first stage of a pipeline to drop new leads into. */
const firstStage = async (pipelineId) => {
  const stage = await PipelineStages.findOne({
    where: { pipelineId },
    order: [["position", "ASC"], ["id", "ASC"]],
    attributes: ["id"],
  });
  return stage?.id ?? null;
};

/**
 * Applies the campaign's duplicate policy.
 *
 * duplicateScope GLOBAL searches the whole tenant; CAMPAIGN only this campaign.
 * IGNORE drops the new row, MERGE updates the existing lead, ALLOW keeps both.
 */
const resolveDuplicates = async ({ tenantId, campaign, candidates }) => {
  const keys = candidates.map((c) => c.dedupeKey).filter(Boolean);
  const scopeIsGlobal = campaign.duplicateScope === DUPLICATE_SCOPES.GLOBAL;

  const existing = new Map();
  if (keys.length > 0) {
    const rows = await CampaignLeads.findAll({
      where: {
        tenantId,
        dedupeKey: { [Op.in]: keys },
        ...(scopeIsGlobal ? {} : { campaignId: campaign.id }),
      },
      attributes: ["id", "dedupeKey", "campaignId", "name", "phone", "email"],
    });
    for (const row of rows) existing.set(row.dedupeKey, row);
  }

  const toCreate = [];
  const toMerge = [];
  const seenInFile = new Map();
  let ignored = 0;
  let allowed = 0;
  let merged = 0;

  for (const candidate of candidates) {
    if (!candidate.dedupeKey) {
      toCreate.push({ ...candidate, duplicateOf: null });
      continue;
    }

    // A repeat inside the same file counts as a duplicate too.
    const match = existing.get(candidate.dedupeKey) ?? seenInFile.get(candidate.dedupeKey) ?? null;
    if (!match) {
      const record = { ...candidate, duplicateOf: null };
      toCreate.push(record);
      seenInFile.set(candidate.dedupeKey, record);
      continue;
    }

    const targetId = typeof match === "object" && "id" in match && match.id ? match.id : null;

    if (campaign.duplicateAction === DUPLICATE_ACTIONS.IGNORE) {
      ignored++;
    } else if (campaign.duplicateAction === DUPLICATE_ACTIONS.MERGE && targetId) {
      toMerge.push({ id: targetId, candidate });
      merged++;
    } else {
      // ALLOW, or MERGE with no real row yet to merge into.
      toCreate.push({ ...candidate, duplicateOf: targetId });
      allowed++;
    }
  }

  return { toCreate, toMerge, ignored, merged, allowed };
};

/**
 * Assigns new leads to the campaign's agents according to the distribution mode.
 * ON_DEMAND leaves them unassigned so agents claim them; EQUAL round-robins;
 * CONDITIONAL has no rule builder yet, so it currently behaves as EQUAL.
 */
const assignLeads = ({ rows, campaign, agents, cursor }) => {
  if (campaign.leadDistribution === LEAD_DISTRIBUTIONS.ON_DEMAND || agents.length === 0) {
    return { rows, cursor };
  }

  let next = cursor;
  for (const row of rows) {
    row.assignedTo = agents[next % agents.length].userId;
    row.assignedAt = new Date();
    row.status = LEAD_STATUS.ASSIGNED;
    next += 1;
  }
  return { rows, cursor: next };
};

export const uploadLeads = async ({ tenantId, campaignId, file, uploadedByName, mapping }) => {
  const campaign = await Campaigns.findOne({ where: { id: campaignId, tenantId } });
  if (!campaign) throw notFound("Campaign not found");

  const parsed = await parseUpload({ ...file, mapping });
  const { toCreate, toMerge, ignored, merged, allowed } = await resolveDuplicates({
    tenantId,
    campaign,
    candidates: parsed.candidates,
  });

  const agentRows = await campaign.getCampaignAgents({ attributes: ["userId"], order: [["position", "ASC"]] });
  const agents = agentRows.map((r) => ({ userId: r.userId }));

  const stageId = await firstStage(campaign.pipelineId);
  const stamp = new Date();

  const prepared = toCreate.map((candidate) => ({
    tenantId,
    campaignId: campaign.id,
    uploadId: null,
    pipelineId: campaign.pipelineId,
    stageId,
    name: candidate.name,
    phone: candidate.phone,
    email: candidate.email,
    city: candidate.city,
    dedupeKey: candidate.dedupeKey ?? `n:${campaign.id}:${Math.random().toString(36).slice(2, 12)}`,
    status: LEAD_STATUS.NEW,
    assignedTo: null,
    assignedAt: null,
    duplicateOf: candidate.duplicateOf ?? null,
    source: parsed.source,
    extra: candidate.extra ?? null,
  }));

  // Continue the rotation where the campaign left off, so repeated uploads do
  // not keep handing the first agent every lead.
  const previous = await CampaignLeads.count({ where: { campaignId: campaign.id, assignedTo: { [Op.ne]: null } } });
  const cursor = agents.length > 0 ? previous % agents.length : 0;
  const { rows } = assignLeads({ rows: prepared, campaign, agents, cursor });

  const partial = ignored > 0 || merged > 0 || allowed > 0 || parsed.skippedBlank > 0;
  const finalStatus = partial ? "PARTIAL" : "COMPLETED";

  // Store the original file first. If this throws, nothing has been written to
  // the database, which is the behaviour asked for: a failed upload must not
  // leave leads behind without their source file.
  let fileKey = null;
  if (env.aws.bucket) {
    fileKey = buildKey({ tenantId, campaignId: campaign.id, fileName: file.originalname });
    try {
      await uploadBuffer({ key: fileKey, body: file.buffer, contentType: file.mimetype });
    } catch (error) {
      throw badRequest(`Could not store the file: ${error.message}`);
    }
  }

  let uploadId = null;
  try {
    // The upload row is written first, inside the same transaction, purely so
    // the leads can carry its id. If anything throws, neither survives.
    uploadId = await CampaignLeads.sequelize.transaction(async (t) => {
      const upload = await CampaignUploads.create(
        {
          tenantId,
          campaignId: campaign.id,
          pipelineId: campaign.pipelineId,
          fileName: file.originalname ?? "upload",
          fileKey,
          source: parsed.source,
          sizeBytes: file.size ?? null,
          totalRows: parsed.candidates.length + parsed.skippedBlank,
          created: rows.length,
          merged,
          ignored,
          allowedDuplicates: allowed,
          skipped: parsed.skippedBlank,
          Status: finalStatus,
          uploadedByName: uploadedByName ?? null,
        },
        { transaction: t },
      );

      for (const row of rows) row.uploadId = upload.id;

      for (const item of toMerge) {
        await CampaignLeads.update(
          {
            // MERGE: the newer sheet wins for the contact details it supplied.
            name: item.candidate.name,
            phone: item.candidate.phone ?? undefined,
            email: item.candidate.email ?? undefined,
            city: item.candidate.city ?? undefined,
            extra: item.candidate.extra ?? undefined,
            uploadId: upload.id,
          },
          { where: { id: item.id, tenantId }, transaction: t },
        );
      }

      if (rows.length > 0) {
        // Chunked so a large sheet does not build one enormous INSERT.
        for (let i = 0; i < rows.length; i += 500) {
          await CampaignLeads.bulkCreate(rows.slice(i, i + 500), { transaction: t });
        }
      }

      return upload.id;
    });
  } catch (error) {
    // The object is already in S3 but the database rolled back, so drop it
    // rather than leaving an unreferenced file in the bucket.
    await removeObject(fileKey);
    throw error;
  }

  const total = await CampaignLeads.count({ where: { campaignId: campaign.id } });

  return {
    campaignId: campaign.id,
    uploadId,
    fileStored: Boolean(fileKey),
    source: parsed.source,
    read: parsed.candidates.length + parsed.skippedBlank,
    created: rows.length,
    merged,
    ignored,
    allowedDuplicates: allowed,
    skippedRows: parsed.skippedBlank,
    stageId,
    totalInCampaign: total,
    uploadedAt: stamp.toISOString(),
  };
};

/** Leads that came from one specific import, for the "view" modal. */
export const listUploadLeads = async ({ tenantId, campaignId, uploadId, page = 1, limit = 50 }) => {
  const upload = await CampaignUploads.findOne({ where: { id: uploadId, campaignId, tenantId } });
  if (!upload) throw notFound("Import not found");

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safePage = Math.max(Number(page) || 1, 1);

  const total = await CampaignLeads.count({ where: { tenantId, campaignId, uploadId } });
  const rows = await CampaignLeads.findAll({
    where: { tenantId, campaignId, uploadId },
    include: [{ model: Users, as: "assignee", attributes: ["id", "fullName"] }],
    order: [["id", "ASC"]],
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  });

  return {
    upload: {
      id: upload.id,
      fileName: upload.fileName,
      source: upload.source,
      totalRows: upload.totalRows,
      created: upload.created,
      merged: upload.merged,
      ignored: upload.ignored,
      Status: upload.Status,
      uploadedAt: upload.CreatedAt,
    },
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      city: row.city,
      status: row.status,
      assignedTo: row.assignee ? { id: row.assignee.id, fullName: row.assignee.fullName } : null,
    })),
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(Math.ceil(total / safeLimit), 1),
      hasMore: safePage * safeLimit < total,
    },
  };
};

/**
 * Removes an import and every lead it created.
 *
 * Scoped by tenant AND campaign on both lookups, so a guessed id from another
 * workspace cannot be used to delete a file or its leads.
 */
export const deleteUpload = async ({ tenantId, campaignId, uploadId }) => {
  const upload = await CampaignUploads.findOne({
    where: { id: uploadId, campaignId, tenantId },
    attributes: ["id", "fileName", "fileKey"],
  });
  if (!upload) throw notFound("Import not found");

  const removedLeads = await CampaignLeads.sequelize.transaction(async (t) => {
    // paranoid, so this is a soft delete and the rows are recoverable.
    const count = await CampaignLeads.destroy({
      where: { tenantId, campaignId, uploadId },
      transaction: t,
    });
    await upload.destroy({ transaction: t });
    return count;
  });

  // The stored spreadsheet goes with it, otherwise deleting an import would
  // leave the PII sitting in the bucket forever.
  await removeObject(upload.fileKey);

  return {
    uploadId: upload.id,
    fileName: upload.fileName,
    deleted: true,
    leadsRemoved: removedLeads,
    fileRemoved: Boolean(upload.fileKey),
  };
};

/**
 * Reads a file and reports its columns plus a few sample rows, so the admin can
 * decide how to map them. Nothing is written to the database.
 */
export const previewUpload = async ({ file }) => parseUpload({ ...file, previewOnly: true });

/**
 * A short-lived presigned URL for the original spreadsheet.
 *
 * The URL is minted on demand rather than stored, so it expires on its own and
 * nothing long-lived is handed out for a file full of lead contact details.
 */
export const getUploadDownloadUrl = async ({ tenantId, campaignId, uploadId }) => {
  const upload = await CampaignUploads.findOne({
    where: { id: uploadId, campaignId, tenantId },
    attributes: ["id", "fileName", "fileKey"],
  });
  if (!upload) throw notFound("Import not found");
  if (!upload.fileKey) throw badRequest("The original file was not stored for this import");

  const url = await presignDownload(upload.fileKey, upload.fileName);
  return { url, fileName: upload.fileName, expiresInSeconds: 900 };
};

export const listLeads = async ({ tenantId, campaignId, page = 1, limit = 25 }) => {
  const campaign = await Campaigns.findOne({ where: { id: campaignId, tenantId }, attributes: ["id"] });
  if (!campaign) throw notFound("Campaign not found");

  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);

  const total = await CampaignLeads.count({ where: { tenantId, campaignId } });
  const rows = await CampaignLeads.findAll({
    where: { tenantId, campaignId },
    include: [{ model: Users, as: "assignee", attributes: ["id", "fullName"] }],
    order: [["id", "ASC"]],
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  });

  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      city: row.city,
      status: row.status,
      source: row.source,
      duplicateOf: row.duplicateOf,
      assignedTo: row.assignee ? { id: row.assignee.id, fullName: row.assignee.fullName } : null,
      CreatedAt: row.CreatedAt,
    })),
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(Math.ceil(total / safeLimit), 1),
      hasMore: safePage * safeLimit < total,
    },
  };
};
