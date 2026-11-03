type ChargePreset = {
  label: string;
  invoiceKind: "deposit" | "other";
  lineKind: "deposit" | "fee" | "other";
  description: string;
  hint: string;
};

/** Descriptive one-off charges using the existing protected invoice/line kinds. */
export const CHARGE_PRESETS = {
  deposit: {
    label: "Security deposit", invoiceKind: "deposit", lineKind: "deposit", description: "Security deposit",
    hint: "Enter the agreed security deposit for this boarder.",
  },
  water: {
    label: "Water bill", invoiceKind: "other", lineKind: "fee", description: "Water bill",
    hint: "For water not included in monthly rent. Add the billing period or meter reading to the description.",
  },
  electricity: {
    label: "Electricity bill", invoiceKind: "other", lineKind: "fee", description: "Electricity bill",
    hint: "For electricity not included in monthly rent. Add the billing period or meter reading to the description.",
  },
  internet: {
    label: "Internet / Wi-Fi", invoiceKind: "other", lineKind: "fee", description: "Internet / Wi-Fi",
    hint: "For internet not included in monthly rent. Add the coverage period to the description.",
  },
  damage: {
    label: "Damage / repair", invoiceKind: "other", lineKind: "fee", description: "Damage / repair",
    hint: "Describe what was damaged and the repair or replacement charge.",
  },
  cleaning: {
    label: "Cleaning fee", invoiceKind: "other", lineKind: "fee", description: "Cleaning fee",
    hint: "Describe the extra cleaning service or move-out cleaning.",
  },
  key: {
    label: "Lost key / lock replacement", invoiceKind: "other", lineKind: "fee", description: "Key / lock replacement",
    hint: "Describe the key or lock being replaced.",
  },
  late_fee: {
    label: "Late payment fee", invoiceKind: "other", lineKind: "fee", description: "Late payment fee",
    hint: "Enter the late fee agreed with the boarder and identify the unpaid bill in the description.",
  },
  other: {
    label: "Other charges", invoiceKind: "other", lineKind: "other", description: "",
    hint: "Describe the separate charge. Add a line for each item.",
  },
} as const satisfies Record<string, ChargePreset>;

export type ChargeType = keyof typeof CHARGE_PRESETS;
export const chargeTypes = Object.keys(CHARGE_PRESETS) as ChargeType[];
