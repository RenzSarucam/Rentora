export type CsvColumn<T> = { header: string; value: (row: T) => string | number | null | undefined };

// Cells a spreadsheet would treat as a formula. Prefixing a quote makes Excel/Sheets show them as text.
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text) || text !== text.trim()) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** RFC 4180 CSV with CRLF line endings and a UTF-8 BOM so Excel opens ₱ and ñ correctly. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Plain pesos with two decimals for spreadsheets: 350050 -> "3500.50". Numbers are never formula-prefixed. */
export function csvPesos(centavos: number): number | string {
  return (centavos / 100).toFixed(2);
}
