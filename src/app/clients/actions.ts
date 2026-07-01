"use server";

import { createClient } from "@/lib/supabase/server";

async function currentOrgId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  return (data?.org_id as string | undefined) ?? null;
}

export interface ClientInput {
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  gst: string;
}

export interface ActionResult {
  id?: string;
  error?: string;
}

export async function createClientAction(input: ClientInput): Promise<ActionResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in." };
  if (!input.company.trim() && !input.name.trim()) return { error: "Company or contact name is required." };

  const { data, error } = await supabase
    .from("clients")
    .insert({
      org_id: orgId,
      name: input.name.trim() || input.company.trim(),
      company: input.company.trim() || null,
      email: input.email.trim() || null,
      phone: input.phone.trim() || null,
      address: input.address.trim() || null,
      gst: input.gst.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data.id as string };
}

export async function updateClientAction(id: string, input: ClientInput): Promise<ActionResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("clients")
    .update({
      name: input.name.trim() || input.company.trim(),
      company: input.company.trim() || null,
      email: input.email.trim() || null,
      phone: input.phone.trim() || null,
      address: input.address.trim() || null,
      gst: input.gst.trim() || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  return { id };
}

export async function deleteClientAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in." };

  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return { error: error.message };
  return { id };
}
