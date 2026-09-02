import { Router, type IRouter } from "express";
import {
  CreateAttachmentBody,
  CreateAttachmentResponse,
  DeleteAttachmentParams,
  ListAttachmentsResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { attachmentsTable, purchasesTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";

const router: IRouter = Router();
const MAX_FILE_SIZE = 8 * 1024 * 1024;

function toAttachment(
  row: typeof attachmentsTable.$inferSelect & { purchaseName: string | null },
) {
  return {
    id: row.id,
    purchaseId: row.purchaseId,
    quotationName: row.quotationName,
    attachmentName: row.attachmentName,
    purchaseName: row.purchaseName ?? row.quotationName ?? "Cotação avulsa",
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    createdAt: row.createdAt,
    downloadUrl: `/api/attachments/${row.id}/download`,
  };
}

router.get("/attachments", async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        id: attachmentsTable.id,
        purchaseId: attachmentsTable.purchaseId,
        quotationName: attachmentsTable.quotationName,
        attachmentName: attachmentsTable.attachmentName,
        fileName: attachmentsTable.fileName,
        mimeType: attachmentsTable.mimeType,
        fileSize: attachmentsTable.fileSize,
        data: attachmentsTable.data,
        createdAt: attachmentsTable.createdAt,
        purchaseName: purchasesTable.productName,
      })
      .from(attachmentsTable)
      .leftJoin(purchasesTable, eq(attachmentsTable.purchaseId, purchasesTable.id))
      .orderBy(desc(attachmentsTable.createdAt));
    res.json(ListAttachmentsResponse.parse(rows.map(toAttachment)));
  } catch (error) {
    next(error);
  }
});

router.post("/attachments", async (req, res, next) => {
  try {
    const parsed = CreateAttachmentBody.safeParse(req.body);
    if (!parsed.success || parsed.data.fileSize > MAX_FILE_SIZE) {
      res.status(400).json({ error: "O anexo precisa ser válido e ter no máximo 8 MB." });
      return;
    }
    const quotationName = parsed.data.quotationName?.trim() || null;
    const attachmentName = parsed.data.attachmentName?.trim() || null;
    if (!parsed.data.purchaseId && !quotationName) {
      res.status(400).json({ error: "Informe o nome da cotação para um anexo sem compra vinculada." });
      return;
    }
    let purchaseName: string | null = null;
    if (parsed.data.purchaseId) {
      const purchase = await db
        .select({ id: purchasesTable.id, productName: purchasesTable.productName })
        .from(purchasesTable)
        .where(eq(purchasesTable.id, parsed.data.purchaseId))
        .limit(1);
      if (!purchase[0]) {
        res.status(400).json({ error: "Compra não encontrada para este anexo." });
        return;
      }
      purchaseName = purchase[0].productName;
    }
    const [row] = await db
      .insert(attachmentsTable)
      .values({
        fileName: parsed.data.fileName,
        mimeType: parsed.data.mimeType,
        fileSize: parsed.data.fileSize,
        data: parsed.data.data,
        purchaseId: parsed.data.purchaseId ?? null,
        quotationName: parsed.data.purchaseId ? null : quotationName,
        attachmentName,
      })
      .returning();
    res.status(201).json(CreateAttachmentResponse.parse(toAttachment({ ...row, purchaseName })));
  } catch (error) {
    next(error);
  }
});

router.get("/attachments/:id/download", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db
      .select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.id, id))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Anexo não encontrado." });
      return;
    }
    res.setHeader("Content-Type", row.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${row.fileName.replace(/["\r\n]/g, "")}"`);
    res.send(Buffer.from(row.data, "base64"));
  } catch (error) {
    next(error);
  }
});

router.delete("/attachments/:id", async (req, res, next) => {
  try {
    const parsed = DeleteAttachmentParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "Anexo inválido." });
      return;
    }
    const [row] = await db
      .delete(attachmentsTable)
      .where(eq(attachmentsTable.id, parsed.data.id))
      .returning({ id: attachmentsTable.id });
    if (!row) {
      res.status(404).json({ error: "Anexo não encontrado." });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;