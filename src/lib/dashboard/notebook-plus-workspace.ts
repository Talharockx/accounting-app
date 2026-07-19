import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isNotebookPlusWorkspace,
  NOTEBOOK_PLUS_WORKSPACE_NAME,
  NOTEBOOK_PLUS_WORKSPACE_VAT,
} from "@/lib/dashboard/notebook-plus";

/** Find or create the hidden storage workspace for command-center Notebook+. */
export async function ensureNotebookPlusWorkspaceId(
  client: SupabaseClient,
  ownerUserId: string,
): Promise<{ businessId: string; error: Error | null }> {
  const { data: existing, error: findError } = await client
    .from("businesses")
    .select("id, vat_number, name")
    .eq("vat_number", NOTEBOOK_PLUS_WORKSPACE_VAT)
    .limit(1)
    .maybeSingle();

  if (findError) {
    return { businessId: "", error: new Error(findError.message) };
  }
  if (existing?.id && isNotebookPlusWorkspace(existing)) {
    return { businessId: existing.id as string, error: null };
  }

  const { data: inserted, error: insertError } = await client
    .from("businesses")
    .insert({
      owner_user_id: ownerUserId,
      name: NOTEBOOK_PLUS_WORKSPACE_NAME,
      business_type: "restaurant",
      phone_number: "—",
      vat_number: NOTEBOOK_PLUS_WORKSPACE_VAT,
      address: "Command center Notebook+",
      contact_email: "notebook-plus@ledgerview.local",
    })
    .select("id")
    .single();

  if (insertError) {
    return { businessId: "", error: new Error(insertError.message) };
  }
  if (!inserted?.id || typeof inserted.id !== "string") {
    return { businessId: "", error: new Error("Could not create Notebook+ workspace.") };
  }
  return { businessId: inserted.id, error: null };
}
