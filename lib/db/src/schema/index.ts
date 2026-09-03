import {
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const purchaseSourceEnum = pgEnum("purchase_source", [
  "manual",
  "mercado_livre",
  "tracking",
]);

export const purchaseStatusEnum = pgEnum("purchase_status", [
  "pending",
  "delivered",
  "overdue",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "not_informed",
  "pix",
  "credit_card",
  "debit_card",
  "boleto",
  "cash",
  "other",
]);

export const exportFormatEnum = pgEnum("export_format", [
  "xlsx",
  "csv",
  "ods",
]);

export const purchasesTable = pgTable("purchases", {
  id: serial("id").primaryKey(),
  purchaseDate: date("purchase_date", { mode: "string" }).notNull(),
  deliveryDate: date("delivery_date", { mode: "string" }),
  supplier: varchar("supplier", { length: 160 }).notNull(),
  productName: text("product_name").notNull(),
  recipient: varchar("recipient", { length: 160 }).notNull(),
  base: varchar("base", { length: 160 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  totalValue: numeric("total_value", { precision: 12, scale: 2, mode: "number" })
    .notNull()
    .default(0),
  paymentMethod: paymentMethodEnum("payment_method")
    .notNull()
    .default("not_informed"),
  source: purchaseSourceEnum("source").notNull().default("manual"),
  status: purchaseStatusEnum("status").notNull().default("pending"),
  deliveredAt: timestamp("delivered_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

export const attachmentsTable = pgTable("attachments", {
  id: serial("id").primaryKey(),
  purchaseId: integer("purchase_id")
    .references(() => purchasesTable.id, { onDelete: "cascade" }),
  quotationName: varchar("quotation_name", { length: 200 }),
  attachmentName: varchar("attachment_name", { length: 200 }),
  attachmentDate: date("attachment_date", { mode: "string" }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 120 }).notNull(),
  fileSize: integer("file_size").notNull(),
  data: text("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

export const exportHistoryTable = pgTable("export_history", {
  id: serial("id").primaryKey(),
  format: exportFormatEnum("format").notNull(),
  rowCount: integer("row_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});