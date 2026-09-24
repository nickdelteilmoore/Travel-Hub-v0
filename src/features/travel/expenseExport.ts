/* Travel Hub — expense export (DESIGN.md, expenses).
 *
 * Impure counterpart of the pure `expenses.ts` builders: turns a trip's rows
 * into a shareable CSV (spreadsheet-friendly) or PDF (a summary table followed
 * by a full-page annex of every receipt photo) and hands the file to the OS
 * share sheet. The receipt bucket is private, so photos are pulled through
 * short-lived signed URLs and inlined as data URIs before printing.
 */
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { buildExpensesHtml, expensesToCsv, exportFilename, type ExpenseRow } from "./expenses";

/** A row as stored, with its photo path, for export. */
export type ExportRow = ExpenseRow & { photo_path: string | null };

async function shareFile(uri: string, mimeType: string, dialogTitle: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) return;
  await Sharing.shareAsync(uri, { mimeType, dialogTitle });
}

/** Write and share a CSV of the trip's expenses. */
export async function exportExpensesCsv(tripTitle: string, rows: ExportRow[]): Promise<void> {
  const uri = (FileSystem.cacheDirectory ?? "") + exportFilename(tripTitle, "csv");
  await FileSystem.writeAsStringAsync(uri, expensesToCsv(rows));
  await shareFile(uri, "text/csv", "Export expenses (CSV)");
}

async function toDataUri(url: string): Promise<string | null> {
  try {
    const tmp = `${FileSystem.cacheDirectory ?? ""}rcpt-${Math.random().toString(36).slice(2)}.jpg`;
    const { uri } = await FileSystem.downloadAsync(url, tmp);
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
    await FileSystem.deleteAsync(uri, { idempotent: true });
    return `data:image/jpeg;base64,${b64}`;
  } catch {
    return null;
  }
}

/** Build and share a PDF: the expense summary table plus a full-page annex of
 * every receipt photo. */
export async function exportExpensesPdf(opts: {
  tripTitle: string;
  subtitle: string;
  rows: ExportRow[];
  /** path → signed URL, from useReceiptUrls. */
  photoUrls: Map<string, string>;
}): Promise<void> {
  const withPhotos = await Promise.all(
    opts.rows.map(async (r) => {
      const url = r.photo_path ? opts.photoUrls.get(r.photo_path) : undefined;
      const photoDataUri = url ? await toDataUri(url) : null;
      return { ...r, photoDataUri };
    }),
  );
  const html = buildExpensesHtml({ title: opts.tripTitle, subtitle: opts.subtitle, rows: withPhotos });
  const { uri } = await Print.printToFileAsync({ html });
  await shareFile(uri, "application/pdf", "Export expenses (PDF)");
}
