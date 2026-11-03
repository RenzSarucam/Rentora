const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES: [number, string][] = [
  [1_000_000_000, "billion"],
  [1_000_000, "million"],
  [1_000, "thousand"],
];

function underThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(n % 10 ? `${TENS[Math.floor(n / 10)]}-${ONES[n % 10]}` : TENS[Math.floor(n / 10)]);
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(" ");
}

function integerWords(n: number): string {
  if (n === 0) return "zero";
  const parts: string[] = [];
  for (const [size, name] of SCALES) {
    if (n >= size) {
      parts.push(`${underThousand(Math.floor(n / size))} ${name}`);
      n %= size;
    }
  }
  if (n > 0) parts.push(underThousand(n));
  return parts.join(" ");
}

/** 350050 -> "Three thousand five hundred pesos and 50/100". For receipts. */
export function amountInWords(centavos: number): string {
  if (!Number.isSafeInteger(centavos) || centavos < 0) throw new Error("Invalid amount");
  const pesos = Math.floor(centavos / 100);
  const cents = centavos % 100;
  const words = `${integerWords(pesos)} ${pesos === 1 ? "peso" : "pesos"}`;
  const text = cents ? `${words} and ${String(cents).padStart(2, "0")}/100` : `${words} only`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
