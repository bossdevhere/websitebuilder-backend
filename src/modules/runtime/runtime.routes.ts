import { Router } from "express";
import { RuntimeController } from "./runtime.controller.js";

const router = Router({ mergeParams: true });

router.get("/preview*", RuntimeController.servePreview);
router.get("/info", RuntimeController.getInfo);

export default router;
