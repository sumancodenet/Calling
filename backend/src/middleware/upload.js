import multer from "multer";
import { badRequest } from "../utils/AppError.js";
import { MAX_UPLOAD_BYTES } from "../modules/admin/campaign/lead.service.js";

const ALLOWED_EXTENSIONS = new Set(["csv", "xls", "xlsx"]);

/**
 * Spreadsheet upload for campaign leads.
 *
 * The file is only ever held in memory: it is parsed and its rows become
 * database records, so there is nothing to keep on disk afterwards. memoryStorage
 * plus the size limit is therefore both simpler and safer than writing to a
 * temp path - nothing is left behind if the request fails midway.
 */
const storage = multer.memoryStorage();

const ALLOWED_MIME = new Set([
  "text/csv",
  "text/plain",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream", // some browsers send this for .xlsx
]);

const fileFilter = (_req, file, cb) => {
  const ext = String(file.originalname ?? "").toLowerCase().split(".").pop();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(badRequest("Only .csv, .xls and .xlsx files are allowed"));
  }
  if (file.mimetype && !ALLOWED_MIME.has(file.mimetype)) {
    return cb(badRequest("That file type is not accepted"));
  }
  return cb(null, true);
};

export const campaignUpload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter,
}).single("file");

/** Turns multer's own errors into the project's standard error shape. */
export const handleUploadError = (err, _req, _res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(badRequest(`That file is too large. The limit is ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`));
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return next(badRequest('Upload the file under the field name "file"'));
    }
    return next(badRequest("That file could not be uploaded"));
  }
  if (err?.statusCode) return next(err);
  return next(err);
};

export default campaignUpload;
