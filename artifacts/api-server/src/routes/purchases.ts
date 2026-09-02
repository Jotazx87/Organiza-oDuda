import { Router, type IRouter } from "express";
import {
  CreatePurchaseBody,
  CreatePurchaseResponse,
  DeletePurchaseParams,
  GetDashboardSummaryResponse,
  ListPurchasesResponse,
  UpdatePurchaseBody,
  UpdatePurchaseParams,
  UpdatePurchaseResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { purchasesTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";

const router: IRouter = Router();
type PurchaseRow = typeof purchasesTable.$inferSelect;

function isoDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getStatus(
  deliveryDate: string | null | undefined,
  storedStatus?: "pending" | "delivered" | "overdue",
): "pending" | "delivered" | "overdue" {
  if (storedStatus === "delivered") return "delivered";
  if (!deliveryDate) return "pending";
  return deliveryDate < isoDate(new Date()) ? "overdue" : "pending";
}

function toPurchase(row: PurchaseRow) {
  return {
    ...row,
    source: "manual" as const,
    status: getStatus(row.deliveryDate, row.status),
  };
}

router.get("/purchases", async (_req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(purchasesTable)
      .orderBy(desc(purchasesTable.createdAt));
    res.json(ListPurchasesResponse.parse(rows.map(toPurchase)));
  } catch (error) {
    next(error);
  }
});

router.post("/purchases", async (req, res, next) => {
  try {
    const parsed = CreatePurchaseBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Confira os campos obrigatórios." });
      return;
    }
    const [row] = await db
      .insert(purchasesTable)
      .values({
        ...parsed.data,
        purchaseDate: parsed.data.purchaseDate.toISOString().slice(0, 10),
        deliveryDate: parsed.data.deliveryDate
          ? parsed.data.deliveryDate.toISOString().slice(0, 10)
          : null,
        status: parsed.data.status ?? getStatus(
          parsed.data.deliveryDate?.toISOString().slice(0, 10),
        ),
        deliveredAt: parsed.data.status === "delivered" ? new Date().toISOString() : null,
      })
      .returning();
    res.status(201).json(CreatePurchaseResponse.parse(toPurchase(row)));
  } catch (error) {
    next(error);
  }
});

router.patch("/purchases/:id", async (req, res, next) => {
  try {
    const params = UpdatePurchaseParams.safeParse(req.params);
    const parsed = UpdatePurchaseBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Dados inválidos para atualização." });
      return;
    }

    const update: Partial<typeof purchasesTable.$inferInsert> = {};
    if (parsed.data.purchaseDate) {
      update.purchaseDate = parsed.data.purchaseDate.toISOString().slice(0, 10);
    }
    if (parsed.data.deliveryDate) {
      update.deliveryDate = parsed.data.deliveryDate.toISOString().slice(0, 10);
    } else if (parsed.data.deliveryDate === null) {
      update.deliveryDate = null;
    }
    if (parsed.data.supplier !== undefined) update.supplier = parsed.data.supplier;
    if (parsed.data.productName !== undefined) update.productName = parsed.data.productName;
    if (parsed.data.recipient !== undefined) update.recipient = parsed.data.recipient;
    if (parsed.data.base !== undefined) update.base = parsed.data.base;
    if (parsed.data.quantity !== undefined) update.quantity = parsed.data.quantity;
    if (parsed.data.totalValue !== undefined) update.totalValue = parsed.data.totalValue;
    if (parsed.data.paymentMethod !== undefined) update.paymentMethod = parsed.data.paymentMethod;
    if (parsed.data.source !== undefined) update.source = parsed.data.source;
    if (parsed.data.status !== undefined) {
      update.status = parsed.data.status;
      update.deliveredAt = parsed.data.status === "delivered" ? new Date().toISOString() : null;
    }

    const [row] = await db
      .update(purchasesTable)
      .set(update)
      .where(eq(purchasesTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Compra não encontrada." });
      return;
    }
    res.json(UpdatePurchaseResponse.parse(toPurchase(row)));
  } catch (error) {
    next(error);
  }
});

router.delete("/purchases/:id", async (req, res, next) => {
  try {
    const params = DeletePurchaseParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Compra inválida." });
      return;
    }
    const [row] = await db
      .delete(purchasesTable)
      .where(eq(purchasesTable.id, params.data.id))
      .returning({ id: purchasesTable.id });
    if (!row) {
      res.status(404).json({ error: "Compra não encontrada." });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard/summary", async (_req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(purchasesTable)
      .orderBy(desc(purchasesTable.createdAt));
    const purchases = rows.map(toPurchase);
    const currentMonth = isoDate(new Date()).slice(0, 7);
    res.json(
      GetDashboardSummaryResponse.parse({
        total: purchases.length,
        pending: purchases.filter((purchase) => purchase.status === "pending").length,
        delivered: purchases.filter((purchase) => purchase.status === "delivered").length,
        overdue: purchases.filter((purchase) => purchase.status === "overdue").length,
        thisMonth: purchases.filter((purchase) => purchase.purchaseDate.startsWith(currentMonth)).length,
        recent: purchases.slice(0, 4),
      }),
    );
  } catch (error) {
    next(error);
  }
});

export default router;