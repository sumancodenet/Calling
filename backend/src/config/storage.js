import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import env from "./env.js";

/**
 * S3 storage for the original uploaded spreadsheets.
 *
 * The bucket is private. Nothing is served through a public URL: downloads go
 * out as short-lived presigned URLs minted here, because these files contain
 * lead names, phone numbers and email addresses.
 */
let client = null;

const getClient = () => {
  if (client) return client;
  client = new S3Client({
    region: env.aws.region,
    // Falls back to the SDK's own chain (instance role, env, shared config) when
    // explicit keys are not set, which is what production should use.
    ...(env.aws.accessKeyId && env.aws.secretAccessKey
      ? {
          credentials: {
            accessKeyId: env.aws.accessKeyId,
            secretAccessKey: env.aws.secretAccessKey,
          },
        }
      : {}),
  });
  return client;
};

/**
 * Namespaced key, so two tenants uploading "leads.csv" cannot collide and a
 * key can never be guessed into another tenant's folder.
 */
export const buildKey = ({ tenantId, campaignId, fileName }) => {
  const safe = String(fileName ?? "upload")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-80) || "upload";
  // Timestamp prefix keeps repeated uploads of the same filename distinct.
  return `tenants/${tenantId}/campaigns/${campaignId}/${Date.now()}-${safe}`;
};

export const uploadBuffer = async ({ key, body, contentType }) => {
  await getClient().send(
    new PutObjectCommand({
      Bucket: env.aws.bucket,
      Key: key,
      Body: body,
      ContentType: contentType ?? "application/octet-stream",
    }),
  );
  return key;
};

/** Used to clean up if the database step fails after the object is stored. */
export const removeObject = async (key) => {
  if (!key) return;
  try {
    await getClient().send(new DeleteObjectCommand({ Bucket: env.aws.bucket, Key: key }));
  } catch (error) {
    // A leftover object is untidy but harmless; never fail the request over it.
    console.warn(`[s3] could not remove orphaned object ${key}: ${error.message}`);
  }
};

const SIGNED_URL_TTL_SECONDS = 900; // 15 minutes

export const presignDownload = async (key, fileName) => {
  const command = new GetObjectCommand({
    Bucket: env.aws.bucket,
    Key: key,
    // So the browser saves it under the original name rather than the key.
    ...(fileName ? { ResponseContentDisposition: `attachment; filename="${fileName}"` } : {}),
  });
  return getSignedUrl(getClient(), command, { expiresIn: SIGNED_URL_TTL_SECONDS });
};

export default { buildKey, uploadBuffer, removeObject, presignDownload };
