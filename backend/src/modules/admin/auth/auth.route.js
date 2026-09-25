import { Router } from "express";
import { createSuperAdmin } from "./auth.controller.js";

const router = Router();

router.post("/super-admin", createSuperAdmin);

export default router;
