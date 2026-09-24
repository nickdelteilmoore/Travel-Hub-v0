import {
  base64ToBytes,
  buildExpensesHtml,
  detectCurrency,
  detectDate,
  detectTotal,
  expensesToCsv,
  exportFilename,
  formatMoney,
  mergeExtraction,
  needsBackup,
  parseAmountToken,
  parseReceiptText,
  totalsByCurrency,
  totalsLabel,
  type ExpenseRow,
} from "./expenses";

describe("parseAmountToken", () => {
  it("handles UK/US decimals and thousands", () => {
    expect(parseAmountToken("£1,234.56")).toBe(1234.56);
    expect(parseAmountToken("12.50")).toBe(12.5);
  });
  it("handles European decimals and thousands", () => {
    expect(parseAmountToken("1.234,56")).toBe(1234.56);
    expect(parseAmountToken("12,50")).toBe(12.5);
  });
  it("returns null for junk", () => {
    expect(parseAmountToken("abc")).toBeNull();
  });
});

describe("detectTotal", () => {
  it("prefers the total line over line items and subtotal", () => {
    const lines = ["Coffee 3.50", "Cake 4.00", "SUBTOTAL 7.50", "TOTAL 8.25", "Card 8.25"];
    expect(detectTotal(lines)).toBe(8.25);
  });
  it("falls back to the largest amount when no total line", () => {
    expect(detectTotal(["Item A 3.50", "Item B 9.99"])).toBe(9.99);
  });
  it("returns null when there are no money tokens", () => {
    expect(detectTotal(["Thank you", "Come again"])).toBeNull();
  });
});

describe("detectCurrency", () => {
  it("reads symbols and codes", () => {
    expect(detectCurrency("Total £8.25")).toBe("GBP");
    expect(detectCurrency("MONTANT 12,50 €")).toBe("EUR");
    expect(detectCurrency("Total 100 JPY")).toBe("JPY");
    expect(detectCurrency("USD 42.00")).toBe("USD");
  });
  it("returns null when absent", () => {
    expect(detectCurrency("just some text 12.50")).toBeNull();
  });
});

describe("detectDate", () => {
  it("reads ISO, UK numeric and textual dates", () => {
    expect(detectDate("Date: 2026-03-14")).toBe("2026-03-14");
    expect(detectDate("14/03/2026 09:12")).toBe("2026-03-14");
    expect(detectDate("14 Mar 2026")).toBe("2026-03-14");
    expect(detectDate("March 14, 2026")).toBe("2026-03-14");
  });
  it("swaps to day-first only when the numbers force US order", () => {
    expect(detectDate("03/14/2026")).toBe("2026-03-14");
  });
  it("expands two-digit years and returns null when absent", () => {
    expect(detectDate("05/06/24")).toBe("2024-06-05");
    expect(detectDate("no date here")).toBeNull();
  });
});

describe("parseReceiptText", () => {
  it("extracts numbers but leaves reason for the AI/user", () => {
    const text = "CAFE DEL SOL\n08/04/2026\nCortado 2,80\nTarta 4,20\nTOTAL 7,00 €\nGracias";
    expect(parseReceiptText(text)).toEqual({
      spent_on: "2026-04-08",
      currency: "EUR",
      amount: 7,
      reason: null,
    });
  });
});

describe("mergeExtraction / needsBackup", () => {
  it("fills only blanks and never overwrites OCR values", () => {
    const primary = { spent_on: "2026-04-08", currency: "EUR", amount: 7, reason: null };
    const backup = { spent_on: "2020-01-01", currency: "USD", amount: 99, reason: "Lunch, cafe" };
    expect(mergeExtraction(primary, backup)).toEqual({
      spent_on: "2026-04-08",
      currency: "EUR",
      amount: 7,
      reason: "Lunch, cafe",
    });
  });
  it("flags when a field is still blank", () => {
    expect(needsBackup({ spent_on: "2026-04-08", currency: "EUR", amount: 7, reason: null })).toBe(true);
    expect(needsBackup({ spent_on: "2026-04-08", currency: "EUR", amount: 7, reason: "x" })).toBe(false);
  });
});

describe("formatMoney", () => {
  it("formats known currencies and falls back gracefully", () => {
    expect(formatMoney(12.5, "GBP")).toBe("£12.50");
    // A malformed code makes Intl throw; we fall back to "amount code".
    expect(formatMoney(12.5, "GB")).toBe("12.50 GB");
    expect(formatMoney(12.5, null)).toBe("12.50");
    expect(formatMoney(null, "GBP")).toBe("—");
  });
});

describe("totals", () => {
  const rows: ExpenseRow[] = [
    { spent_on: "2026-04-08", currency: "EUR", amount: 7, reason: "a" },
    { spent_on: "2026-04-09", currency: "EUR", amount: 3.5, reason: "b" },
    { spent_on: "2026-04-09", currency: "GBP", amount: 240, reason: "c" },
    { spent_on: null, currency: null, amount: null, reason: null }, // ignored
  ];
  it("groups by currency, largest first", () => {
    expect(totalsByCurrency(rows)).toEqual([
      { currency: "GBP", total: 240 },
      { currency: "EUR", total: 10.5 },
    ]);
  });
  it("renders a one-line label", () => {
    expect(totalsLabel(rows)).toBe("£240.00 · €10.50");
  });
});

describe("expensesToCsv", () => {
  it("emits a header and escapes commas/quotes", () => {
    const csv = expensesToCsv([
      { spent_on: "2026-04-08", currency: "EUR", amount: 7, reason: "Lunch, cafe", created_at: "2026-04-08T10:00:00Z" },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Date,Currency,Amount,Reason,Logged");
    expect(lines[1]).toBe('2026-04-08,EUR,7.00,"Lunch, cafe",2026-04-08');
  });
});

describe("buildExpensesHtml", () => {
  it("summarises rows, escapes text and shows the total", () => {
    const html = buildExpensesHtml({
      title: "Barcelona",
      subtitle: "3 expenses",
      rows: [
        { spent_on: "2026-04-08", currency: "EUR", amount: 7, reason: "Tapas & <wine>", photoDataUri: "data:image/jpeg;base64,AAAA" },
        { spent_on: null, currency: null, amount: null, reason: null },
      ],
    });
    expect(html).toContain("Barcelona");
    expect(html).toContain("Tapas &amp; &lt;wine&gt;");
    expect(html).toContain("€7.00");
    expect(html).toContain("No photo");
  });

  it("puts each receipt on its own full annex page and cites it from the table", () => {
    const html = buildExpensesHtml({
      title: "Barcelona",
      subtitle: "2 expenses",
      rows: [
        { spent_on: "2026-04-08", currency: "EUR", amount: 7, reason: "Tapas", photoDataUri: "data:image/jpeg;base64,AAAA" },
        { spent_on: null, currency: null, amount: null, reason: null }, // no photo → no annex page
        { spent_on: "2026-04-09", currency: "EUR", amount: 3.5, reason: "Coffee", photoDataUri: "data:image/jpeg;base64,BBBB" },
      ],
    });
    // Two photos → two numbered annex pages, each carrying its own image.
    expect(html).toContain("Receipt annex");
    expect(html).toContain("2 receipts, one per page.");
    expect(html).toContain("Annex 1");
    expect(html).toContain("Annex 2");
    expect(html).toContain('src="data:image/jpeg;base64,AAAA"');
    expect(html).toContain('src="data:image/jpeg;base64,BBBB"');
    // Each annex page breaks onto a fresh page.
    expect((html.match(/class="annex-page"/g) ?? []).length).toBe(2);
    expect(html).toContain("page-break-before: always");
  });

  it("omits the annex entirely when no row has a photo", () => {
    const html = buildExpensesHtml({
      title: "Barcelona",
      subtitle: "1 expense",
      rows: [{ spent_on: "2026-04-08", currency: "EUR", amount: 7, reason: "Tapas" }],
    });
    expect(html).not.toContain("Receipt annex");
    expect(html).not.toContain('class="annex-page"');
  });
});

describe("base64ToBytes", () => {
  // "Hi!" → base64 "SGkh"; "Man" → "TWFu"; "Ma" → "TWE="; "M" → "TQ=="
  const bytes = (s: string) => Array.from(base64ToBytes(s));
  it("decodes with and without padding", () => {
    expect(bytes("TWFu")).toEqual([0x4d, 0x61, 0x6e]);
    expect(bytes("TWE=")).toEqual([0x4d, 0x61]);
    expect(bytes("TQ==")).toEqual([0x4d]);
  });
  it("ignores newlines/whitespace in the input", () => {
    expect(bytes("TW\nFu")).toEqual([0x4d, 0x61, 0x6e]);
  });
});

describe("exportFilename", () => {
  it("slugs the trip title", () => {
    expect(exportFilename("Barcelona city break!", "csv")).toBe("expenses-barcelona-city-break.csv");
    expect(exportFilename("   ", "pdf")).toBe("expenses-trip.pdf");
  });
});
