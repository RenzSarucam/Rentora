import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PaymentReceivingAccount, ReceivingMethod } from "./payment-receiving";

export async function getPaymentReceivingAccounts(orgId: string): Promise<PaymentReceivingAccount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("payment_receiving_accounts")
    .select("method,account_name,institution_name,account_number,qr_path").eq("organization_id", orgId)
    .returns<{ method: ReceivingMethod; account_name: string; institution_name: string | null; account_number: string | null; qr_path: string }[]>();
  if (error) throw new Error("Could not load payment receiving details");
  return Promise.all((data ?? []).map(async (row) => {
    const signed = await supabase.storage.from("payment-qrs").createSignedUrl(row.qr_path, 60);
    return {
      method: row.method, accountName: row.account_name, institutionName: row.institution_name,
      accountNumber: row.account_number, qrUrl: signed.data?.signedUrl ?? null,
    };
  }));
}
