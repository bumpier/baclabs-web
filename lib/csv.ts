/**
 * CSV for spreadsheets: every cell quoted, CRLF line ends, a trailing CRLF.
 * Same cell rule as app/admin/finance/export/route.ts.
 */

export type CsvValue = string | number | boolean | null | undefined;

/**
 * Quote a cell, and defuse spreadsheet formulas (=, +, -, @ at the start).
 * A plain number is left alone, so a negative amount stays a number.
 */
export function csvCell(value: CsvValue): string {
  const s = value === null || value === undefined ? "" : typeof value === "boolean" ? (value ? "yes" : "no") : String(value);
  const v = /^[=+\-@\t\r]/.test(s) && !/^-\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return `"${v.replace(/"/g, '""')}"`;
}

/**
 * A whole sheet. Starts with a byte-order mark so Excel reads it as UTF-8
 * rather than mangling accented names.
 */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  const lines = [header.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}
