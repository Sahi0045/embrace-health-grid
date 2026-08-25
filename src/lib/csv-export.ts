/**
 * CSV & File Export Utility — Embrace Health Grid
 *
 * Provides real client-side CSV file generation and automatic browser downloads.
 */

export interface ExportColumn<T> {
  header: string;
  accessor: keyof T | ((row: T) => string | number | boolean | null | undefined);
}

/**
 * Escapes a single CSV value according to RFC 4180 standard.
 */
function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) {
    return '""';
  }
  const str = String(val);
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Generates and triggers download of a CSV file in the browser.
 *
 * @param filename - Name of the file (e.g., "inventory-ledger.csv")
 * @param rows - Array of objects to export
 * @param columns - Array of column definitions with header and accessor
 */
export function exportToCsv<T>(filename: string, rows: T[], columns: ExportColumn<T>[]): boolean {
  if (!rows || rows.length === 0) {
    return false;
  }

  // 1. Build Header Row
  const headerLine = columns.map((col) => escapeCsvValue(col.header)).join(",");

  // 2. Build Data Rows
  const dataLines = rows.map((row) =>
    columns
      .map((col) => {
        const val = typeof col.accessor === "function" ? col.accessor(row) : row[col.accessor];
        return escapeCsvValue(val);
      })
      .join(","),
  );

  const csvContent = "\uFEFF" + [headerLine, ...dataLines].join("\r\n");

  // 3. Create Blob and trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return true;
}
