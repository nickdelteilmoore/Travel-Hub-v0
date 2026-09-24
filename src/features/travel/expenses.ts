/* Travel Hub — pure expense/receipt logic (DESIGN.md, expenses).
 *
 * On-device OCR is the primary reader: `parseReceiptText` turns the recognised
 * text into date / currency / amount with heuristics (no network, no key). The
 * AI Edge Function is the backup, filling only what OCR left blank and adding
 * the "reason" OCR can never infer (`mergeExtraction`). Everything a user sees
 * or exports — money formatting, running totals, the CSV and the PDF HTML — is
 * derived here so it unit-tests without React Native and the screens stay thin
 * (hard rule 7). Nothing is ever guessed: an unreadable field stays null for
 * the user to fill.
 */

export type ExpenseFields = {
  /** Purchase date, ISO yyyy-mm-dd, or null when unknown. */
  spent_on: string | null;
  /** ISO 4217 code (GBP, EUR…), or null. */
  currency: string | null;
  /** Total paid, or null. */
  amount: number | null;
  /** Short description of the expense, or null. */
  reason: string | null;
};

/** A stored expense row, as far as the pure helpers care about it. */
export type ExpenseRow = ExpenseFields & { created_at?: string };

// ── OCR text parsing (the on-device primary path) ───────────────────────────

/** Turn a possibly-messy amount token ("1.234,56", "12,50", "£12.50") into a
 * number, working out which separator is the decimal point. */
export function parseAmountToken(raw: string): number | null {
  let s = raw.replace(/[^\d.,]/g, "");
  if (!s) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // Both present — the rightmost is the decimal separator, the other groups.
    const decIsDot = lastDot > lastComma;
    s = decIsDot ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", ".");
  } else if (lastComma >= 0) {
    // A lone comma with two trailing digits is a decimal (12,50); else grouping.
    s = s.length - lastComma - 1 === 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function moneyTokens(line: string): number[] {
  const out: number[] = [];
  const re = /\d[\d.,]*[.,]\d{2}(?!\d)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const n = parseAmountToken(m[0]);
    if (n != null) out.push(n);
  }
  return out;
}

const TOTAL_RE = /(grand\s*total|amount\s*(due|paid)|balance\s*due|to\s*pay|total)/i;
const SUBTOTAL_RE = /sub\s*-?\s*total/i;

/** The most total-like amount: the largest figure on a "total" line, else the
 * largest figure anywhere. Subtotals are excluded so they don't win. */
export function detectTotal(lines: string[]): number | null {
  const totals: number[] = [];
  const all: number[] = [];
  for (const line of lines) {
    const toks = moneyTokens(line);
    if (!toks.length) continue;
    all.push(...toks);
    if (TOTAL_RE.test(line) && !SUBTOTAL_RE.test(line)) totals.push(...toks);
  }
  const pick = (arr: number[]) => (arr.length ? Math.max(...arr) : null);
  return pick(totals) ?? pick(all);
}

/** Detect the receipt currency from a symbol or an ISO code, or null. */
export function detectCurrency(text: string): string | null {
  if (/£|\bGBP\b/i.test(text)) return "GBP";
  if (/€|\bEUR\b/i.test(text)) return "EUR";
  if (/¥|\bJPY\b/i.test(text)) return "JPY";
  if (/\$|\bUSD\b/i.test(text)) return "USD"; // $ is ambiguous; USD is the safe default
  const iso = text.match(
    /\b(GBP|USD|EUR|JPY|CHF|AUD|CAD|SEK|NOK|DKK|PLN|CZK|HUF|CNY|INR|ZAR|MXN|BRL|SGD|HKD|NZD|TRY|AED|THB)\b/,
  );
  const code = iso?.[1];
  return code ? code.toUpperCase() : null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");
const validYmd = (y: number, m: number, d: number) =>
  m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1990 && y <= 2100;

/** Find a date on the receipt and normalise it to ISO. UK day-first is assumed
 * for ambiguous numeric dates (locale en-GB), swapping only when the numbers
 * force it. Null when nothing plausible is found. */
const monthNum = (s: string | undefined): number | undefined =>
  s ? MONTHS[s.slice(0, 3).toLowerCase()] : undefined;

export function detectDate(text: string): string | null {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const y = +(iso[1] ?? NaN), mo = +(iso[2] ?? NaN), d = +(iso[3] ?? NaN);
    if (validYmd(y, mo, d)) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  const numeric = text.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/);
  if (numeric) {
    let d = +(numeric[1] ?? NaN);
    let mo = +(numeric[2] ?? NaN);
    let y = +(numeric[3] ?? NaN);
    if (y < 100) y += 2000;
    if (mo > 12 && d <= 12) [d, mo] = [mo, d]; // clearly mm/dd — swap to day-first
    if (validYmd(y, mo, d)) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  const dMonY = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(20\d{2})\b/);
  if (dMonY) {
    const d = +(dMonY[1] ?? NaN), mo = monthNum(dMonY[2]), y = +(dMonY[3] ?? NaN);
    if (mo && validYmd(y, mo, d)) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  const monDY = text.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(20\d{2})\b/);
  if (monDY) {
    const mo = monthNum(monDY[1]), d = +(monDY[2] ?? NaN), y = +(monDY[3] ?? NaN);
    if (mo && validYmd(y, mo, d)) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  return null;
}

/** Primary reader: parse OCR text into fields. `reason` is always null here —
 * OCR can read numbers off a receipt but not say why the money was spent, so
 * that field is left for the AI backup or the user. */
export function parseReceiptText(text: string): ExpenseFields {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return {
    spent_on: detectDate(text),
    currency: detectCurrency(text),
    amount: detectTotal(lines),
    reason: null,
  };
}

/** Fold the AI backup into the OCR result: the backup only fills fields OCR
 * left blank, so a confident on-device read is never overwritten. */
export function mergeExtraction(primary: ExpenseFields, backup: Partial<ExpenseFields>): ExpenseFields {
  return {
    spent_on: primary.spent_on ?? backup.spent_on ?? null,
    currency: primary.currency ?? backup.currency ?? null,
    amount: primary.amount ?? backup.amount ?? null,
    reason: primary.reason ?? backup.reason ?? null,
  };
}

/** True when at least one field is still blank — i.e. the AI backup is worth a
 * call. (`reason` is always blank after OCR, so this is essentially always true
 * on the first pass, which is the point: OCR gets the numbers, AI gets a reason.) */
export function needsBackup(fields: ExpenseFields): boolean {
  return fields.spent_on == null || fields.currency == null || fields.amount == null || fields.reason == null;
}

// ── Formatting, totals, export ──────────────────────────────────────────────

/** "£12.50" / "12.50 EUR" / "12.50" / "—" for display. en-GB. */
export function formatMoney(amount: number | null, currency: string | null): string {
  if (amount == null) return "—";
  if (currency) {
    try {
      return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency}`;
    }
  }
  return amount.toFixed(2);
}

/** Running totals grouped by currency (unknown currency bucketed as "—"),
 * largest first — expenses on one trip can span several currencies. */
export function totalsByCurrency(rows: ExpenseRow[]): { currency: string; total: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.amount == null) continue;
    const key = r.currency || "—";
    map.set(key, (map.get(key) ?? 0) + r.amount);
  }
  return [...map.entries()]
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => b.total - a.total);
}

/** One-line total summary, e.g. "£240.00 · €55.50". Empty when nothing totals. */
export function totalsLabel(rows: ExpenseRow[]): string {
  return totalsByCurrency(rows)
    .map(({ currency, total }) => (currency === "—" ? total.toFixed(2) : formatMoney(total, currency)))
    .join(" · ");
}

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** A spreadsheet-friendly CSV of the trip's expenses. */
export function expensesToCsv(rows: ExpenseRow[]): string {
  const header = ["Date", "Currency", "Amount", "Reason", "Logged"];
  const body = rows.map((r) =>
    [
      r.spent_on ?? "",
      r.currency ?? "",
      r.amount == null ? "" : r.amount.toFixed(2),
      r.reason ?? "",
      r.created_at ? r.created_at.slice(0, 10) : "",
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...body].join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Printable HTML for the PDF export: a summary table of expenses followed by
 * an annex that reproduces each receipt photo at full-page size, one per page.
 * Rows with a photo cite their annex page ("Annex N"); the photos are passed in
 * as data URIs so this stays pure. Plain document styling, independent of the
 * app theme. */
export function buildExpensesHtml(opts: {
  title: string;
  subtitle: string;
  rows: (ExpenseRow & { photoDataUri?: string | null })[];
}): string {
  const totals = totalsLabel(opts.rows) || "—";
  const annexPages: string[] = [];
  const rowsHtml = opts.rows
    .map((r) => {
      let receipt = '<span class="muted">No photo</span>';
      if (r.photoDataUri) {
        const n = annexPages.length + 1;
        const meta = [r.spent_on ?? "—", r.reason ?? "—", formatMoney(r.amount, r.currency)]
          .map(escapeHtml)
          .join(" · ");
        annexPages.push(`<section class="annex-page">
        <h2>Annex ${n}</h2>
        <p class="annex-meta">${meta}</p>
        <img src="${r.photoDataUri}" alt="receipt" />
      </section>`);
        receipt = `Annex ${n}`;
      }
      return `<tr>
        <td>${escapeHtml(r.spent_on ?? "—")}</td>
        <td>${escapeHtml(r.reason ?? "—")}</td>
        <td class="num">${escapeHtml(formatMoney(r.amount, r.currency))}</td>
        <td class="receipt">${receipt}</td>
      </tr>`;
    })
    .join("");
  const annexHtml = annexPages.length
    ? `<section class="annex-lead">
    <h2>Receipt annex</h2>
    <p class="subtitle">${annexPages.length} receipt${annexPages.length === 1 ? "" : "s"}, one per page.</p>
  </section>${annexPages.join("")}`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #1C2217; margin: 24px; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  h2 { font-size: 15px; margin: 0 0 2px; }
  .subtitle { color: #606859; font-size: 12px; margin: 0 0 4px; }
  .totals { font-size: 14px; font-weight: 700; margin: 8px 0 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #E2DCCE; vertical-align: top; font-size: 12px; }
  th { text-transform: uppercase; letter-spacing: 0.5px; font-size: 10px; color: #606859; }
  td.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  td.receipt { white-space: nowrap; color: #606859; }
  .muted { color: #9aa08f; }
  .annex-lead { page-break-before: always; }
  .annex-page { page-break-inside: avoid; }
  .annex-page + .annex-page { page-break-before: always; }
  .annex-page .annex-meta { color: #606859; font-size: 12px; margin: 0 0 12px; }
  .annex-page img { display: block; margin: 0 auto; max-width: 100%; max-height: 80vh; }
</style></head><body>
  <h1>${escapeHtml(opts.title)}</h1>
  <p class="subtitle">${escapeHtml(opts.subtitle)}</p>
  <p class="totals">Total: ${escapeHtml(totals)}</p>
  <table>
    <thead><tr><th>Date</th><th>Reason</th><th>Amount</th><th>Receipt</th></tr></thead>
    <tbody>${rowsHtml || '<tr><td colspan="4" class="muted">No expenses yet.</td></tr>'}</tbody>
  </table>
  ${annexHtml}
</body></html>`;
}

const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_LOOKUP = (() => {
  const t = new Int16Array(256).fill(-1);
  for (let i = 0; i < B64_CHARS.length; i++) t[B64_CHARS.charCodeAt(i)] = i;
  return t;
})();

/**
 * Decode base64 (as expo-image-manipulator hands it back) to raw bytes for a
 * Supabase Storage upload. Hermes doesn't guarantee `atob`, and Blob uploads
 * from RN have historically arrived empty, so a Uint8Array is the dependable
 * path. Pure, so it's unit-tested rather than trusted.
 */
export function base64ToBytes(b64: string): Uint8Array {
  const core = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const outLen = Math.floor((core.length * 6) / 8);
  const bytes = new Uint8Array(outLen);
  let o = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < core.length; i++) {
    const v = B64_LOOKUP[core.charCodeAt(i)];
    if (v === undefined || v < 0) continue;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[o++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes;
}

/** Filesystem-safe slug for an export filename. */
export function exportFilename(tripTitle: string, ext: string): string {
  const slug = tripTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "trip";
  return `expenses-${slug}.${ext}`;
}
