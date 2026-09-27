import { Router } from "express";
import { listPipelines } from "./pipeline.controller.js";
import { authenticate } from "../auth/auth.middleware.js";

const router = Router();

router.get("/", authenticate, listPipelines);

export default router;
