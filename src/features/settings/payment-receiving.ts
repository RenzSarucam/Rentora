export type ReceivingMethod = "gcash" | "bank_transfer";
export type PaymentReceivingAccount = {
  method: ReceivingMethod;
  accountName: string;
  institutionName: string | null;
  accountNumber: string | null;
  qrUrl: string | null;
};
