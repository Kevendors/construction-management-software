import "server-only";

import type {
  MaterialItem,
  MaterialRequest,
  MaterialUsage,
  Project,
  PurchaseOrder,
  Supplier,
  User,
} from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient as createSupabase } from "@/lib/supabase/server";
import {
  mapMaterialItem,
  mapMaterialRequest,
  mapMaterialUsage,
  mapProject,
  mapPurchaseOrder,
  mapSupplier,
  mapUser,
  type MaterialItemRow,
  type MaterialRequestRow,
  type MaterialUsageRow,
  type ProjectRow,
  type PurchaseOrderRow,
  type SupplierRow,
  type UserRow,
} from "./mappers";

// mock fallback
import {
  goodsReceipts as mockReceipts,
  materialItems as mockItems,
  materialRequests as mockRequests,
  materialUsage as mockUsage,
  projects as mockProjects,
  purchaseBookings as mockBookings,
  purchaseOrders as mockPOs,
  suppliers as mockSuppliers,
  users as mockUsers,
} from "@/lib/mock/data";

export interface MaterialBoard {
  items: MaterialItem[];
  requests: MaterialRequest[];
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  usage: MaterialUsage[];
  receiptPoIds: string[];
  bookedPoIds: string[];
  projects: Project[];
  users: User[];
}

export async function getMaterialBoard(): Promise<MaterialBoard> {
  if (!isSupabaseConfigured()) {
    return {
      items: mockItems,
      requests: mockRequests,
      purchaseOrders: mockPOs,
      suppliers: mockSuppliers,
      usage: mockUsage,
      receiptPoIds: [...new Set(mockReceipts.map((g) => g.poId))],
      bookedPoIds: [...new Set(mockBookings.map((b) => b.poId))],
      projects: mockProjects,
      users: mockUsers,
    };
  }
  const supabase = await createSupabase();
  const [items, requests, pos, suppliers, usage, receipts, bookings, projects, profiles] =
    await Promise.all([
      supabase.from("material_items").select("*").order("name"),
      supabase.from("material_requests").select("*, material_request_lines(*)").order("date", { ascending: false }),
      supabase.from("purchase_orders").select("*, po_items(*)").order("date", { ascending: false }),
      supabase.from("suppliers").select("*").order("company"),
      supabase.from("material_usage").select("*").order("date", { ascending: false }),
      supabase.from("goods_receipts").select("po_id"),
      supabase.from("purchase_bookings").select("po_id"),
      supabase.from("projects").select("*"),
      supabase.from("profiles").select("id, name, avatar_color, initials"),
    ]);
  for (const res of [items, requests, pos, suppliers, usage, receipts, bookings, projects, profiles]) {
    if (res.error) throw res.error;
  }
  return {
    items: (items.data as MaterialItemRow[]).map(mapMaterialItem),
    requests: (requests.data as MaterialRequestRow[]).map(mapMaterialRequest),
    purchaseOrders: (pos.data as PurchaseOrderRow[]).map(mapPurchaseOrder),
    suppliers: (suppliers.data as SupplierRow[]).map(mapSupplier),
    usage: (usage.data as MaterialUsageRow[]).map(mapMaterialUsage),
    receiptPoIds: [...new Set((receipts.data as { po_id: string }[]).map((g) => g.po_id))],
    bookedPoIds: [...new Set((bookings.data as { po_id: string }[]).map((b) => b.po_id))],
    projects: (projects.data as ProjectRow[]).map(mapProject),
    users: (profiles.data as UserRow[]).map(mapUser),
  };
}

export interface PurchaseOrderView {
  po: PurchaseOrder;
  supplier: Supplier | null;
  project: Project | null;
}

export async function getAllPurchaseOrderIds(): Promise<string[]> {
  if (!isSupabaseConfigured()) return mockPOs.map((p) => p.id);
  const supabase = await createSupabase();
  const { data, error } = await supabase.from("purchase_orders").select("id");
  if (error) throw error;
  return (data as { id: string }[]).map((r) => r.id);
}

export async function getPurchaseOrderView(id: string): Promise<PurchaseOrderView | null> {
  if (!isSupabaseConfigured()) {
    const po = mockPOs.find((p) => p.id === id);
    if (!po) return null;
    return {
      po,
      supplier: mockSuppliers.find((s) => s.id === po.supplierId) ?? null,
      project: mockProjects.find((p) => p.id === po.projectId) ?? null,
    };
  }
  const supabase = await createSupabase();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("*, po_items(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const po = mapPurchaseOrder(data as PurchaseOrderRow);
  const [s, p] = await Promise.all([
    supabase.from("suppliers").select("*").eq("id", po.supplierId).maybeSingle(),
    supabase.from("projects").select("*").eq("id", po.projectId).maybeSingle(),
  ]);
  if (s.error) throw s.error;
  if (p.error) throw p.error;
  return {
    po,
    supplier: s.data ? mapSupplier(s.data as SupplierRow) : null,
    project: p.data ? mapProject(p.data as ProjectRow) : null,
  };
}
