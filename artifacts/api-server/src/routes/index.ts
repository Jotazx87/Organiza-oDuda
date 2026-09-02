import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import purchasesRouter from "./purchases";
import exportsRouter from "./exports";
import attachmentsRouter from "./attachments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(purchasesRouter);
router.use(exportsRouter);
router.use(attachmentsRouter);

export default router;
