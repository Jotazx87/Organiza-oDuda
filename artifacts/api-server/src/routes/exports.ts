import { Router, type IRouter } from "express";
import {
  CreateExportRecordBody,
  CreateExportRecordResponse,
  ListExportHistoryResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { exportHistoryTable } from "@workspace/db/schema";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/exports/history", async (_req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(exportHistoryTable)
      .orderBy(desc(exportHistoryTable.createdAt));
    res.json(ListExportHistoryResponse.parse(rows));
  } catch (error) {
    next(error);
  }
});

router.post("/exports/history", async (req, res, next) => {
  try {
    const parsed = CreateExportRecordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Formato de exportação inválido." });
      return;
    }
    const [row] = await db
      .insert(exportHistoryTable)
      .values(parsed.data)
      .returning();
    res.status(201).json(CreateExportRecordResponse.parse(row));
  } catch (error) {
    next(error);
  }
});

export default router;