import { z } from "zod";

export const transactionSchema = z.object({
  projectId: z.string().min(1),
  partyId: z.string().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  direction: z.enum(["in", "out"]),
  amount: z.number().positive("Amount must be greater than 0"),
  costCode: z.string().min(1),
  category: z.string().min(1),
  note: z.string(),
});

export const expenseSchema = z.object({
  projectId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.string().min(1),
  costCode: z.string().min(1),
  amount: z.number().positive("Amount must be greater than 0"),
  note: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
  byId: z.string(),
});

export const invoiceSchema = z.object({
  number: z.string().min(1),
  projectId: z.string().min(1),
  clientId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z.array(
    z.object({
      id: z.string(),
      description: z.string().min(1),
      qty: z.number().positive(),
      unit: z.string(),
      rate: z.number().nonnegative(),
    })
  ).min(1),
  taxRate: z.number().nonnegative(),
  received: z.number().nonnegative(),
  status: z.enum(["draft", "sent", "partial", "paid", "overdue"]),
});
