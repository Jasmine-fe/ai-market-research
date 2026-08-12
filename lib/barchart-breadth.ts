export type BreadthSnapshot = {
  value: number;
  changePoints: number;
  tradeDate: string;
  high52w: number | null;
  low52w: number | null;
};

const MONTHS: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

function firstNumber(source: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) {
      const value = Number(match[1].replace(/[+,]/g, ""));
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
}

function normalizeSessionDate(value: string) {
  const match = value.match(
    /^(?:[A-Za-z]{3},\s+)?([A-Za-z]{3})\s+(\d{1,2})(?:st|nd|rd|th)?,\s+(\d{4})$/,
  );
  if (!match) return value.replaceAll("\\/", "/");
  const month = MONTHS[match[1]];
  if (!month) return value;
  return `${match[3]}/${month}/${match[2].padStart(2, "0")}`;
}

function stringField(source: string, field: string) {
  return source.match(new RegExp(`"${field}":"([^"]*)"`))?.[1] ?? null;
}

export function parseBreadthSnapshot(
  html: string,
  symbol: "S5TW" | "NDTW",
): BreadthSnapshot | null {
  const start = html.search(
    new RegExp(`"symbol":"\\$${symbol}","symbolName":"[^"]+","symbolType":9`),
  );
  if (start < 0) return null;

  const quote = html.slice(start, start + 1800);
  const rawPrice = stringField(quote, "lastPrice");
  const rawChange = stringField(quote, "priceChange");
  const rawDate = stringField(quote, "sessionDateDisplayLong");
  if (!rawPrice || rawChange == null || !rawDate) return null;

  const value = Number(rawPrice.replace(/,/g, ""));
  const changePoints =
    rawChange.trim().toLowerCase() === "unch"
      ? 0
      : Number(rawChange.replace(/[+,]/g, ""));
  if (!Number.isFinite(value) || !Number.isFinite(changePoints)) return null;

  return {
    value,
    changePoints,
    tradeDate: normalizeSessionDate(rawDate),
    high52w: firstNumber(html, [
      /&quot;highPrice1y&quot;:([\d.]+)/,
      /"highPrice1y":([\d.]+)/,
    ]),
    low52w: firstNumber(html, [
      /&quot;lowPrice1y&quot;:([\d.]+)/,
      /"lowPrice1y":([\d.]+)/,
    ]),
  };
}
