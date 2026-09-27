import { Tenants } from "../../models/index.js";
import { notFound, badRequest } from "../../utils/AppError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/**
 * Resolves the tenant for a public (unauthenticated) request, e.g. the login form
 * needs a slug to scope the credential lookup. Authenticated requests get their
 * tenant from the verified access token instead (see auth.middleware.js).
 */
export const resolveTenant = asyncHandler(async (req, res, next) => {
  const slug = req.body?.tenantSlug ?? req.query?.tenantSlug;

  if (!slug) {
    throw badRequest("tenantSlug is required");
  }

  const tenant = await Tenants.findOne({
    where: { slug: String(slug).toLowerCase() },
    attributes: ["id", "name", "slug", "plan", "Status"],
  });

  if (!tenant) throw notFound("Unknown workspace");

  req.tenant = tenant;
  return next();
});

export default resolveTenant;
