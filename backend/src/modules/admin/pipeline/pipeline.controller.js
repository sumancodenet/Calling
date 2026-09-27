import { Pipelines } from "../../../models/index.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { sendSuccess } from "../../../utils/response.js";

export const listPipelines = asyncHandler(async (req, res) => {
  const pipelines = await Pipelines.findAll({
    where: { tenantId: req.tenantId },
    order: [
      ["position", "ASC"],
      ["id", "ASC"],
    ],
  });

  return sendSuccess(res, {
    message: "Pipelines retrieved",
    data: pipelines,
    meta: { count: pipelines.length },
  });
});

export default listPipelines;
