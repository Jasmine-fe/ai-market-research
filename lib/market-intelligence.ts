export type CombinedHistoryPoint = {
  date: string;
  price: number;
  breadth: number;
};

export type MarketFeatures = {
  date: string;
  price: number;
  breadth: number;
  bias20: number;
  bias60: number;
  breadthMomentum5: number;
};

export type HistoricalAnalog = {
  date: string;
  similarity: number;
  reasons: string[];
  spxReturn20: number;
  qqqReturn20: number;
  spxMaxDrawdown20: number;
  qqqMaxDrawdown20: number;
};

type RawHistoryPoint = { date: string; close: number };

function parseHistory(source: string): RawHistoryPoint[] {
  return source
    .trim()
    .split("\n")
    .map((row) => {
      const columns = row.split(",");
      return { date: columns[1] ?? "", close: Number(columns[5]) };
    })
    .filter(
      (point) =>
        /^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(point.close),
    );
}

async function getCombinedHistory(
  priceSymbol: "$SPX" | "QQQ",
  breadthSymbol: "$S5TW" | "$NDTW",
  maxRecords = 1400,
): Promise<CombinedHistoryPoint[]> {
  const pageUrl = `https://www.barchart.com/stocks/quotes/${encodeURIComponent(breadthSymbol)}/interactive-chart`;
  const pageResponse = await fetch(pageUrl, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.8",
      "user-agent": "Mozilla/5.0 (compatible; MarketMemoAgent/1.0)",
    },
    cache: "no-store",
  });
  if (!pageResponse.ok) return [];

  const setCookies = pageResponse.headers.getSetCookie();
  const cookies = setCookies.map((cookie) => cookie.split(";")[0]).join("; ");
  const encodedXsrf = setCookies
    .find((cookie) => cookie.startsWith("XSRF-TOKEN="))
    ?.split(";")[0]
    .slice("XSRF-TOKEN=".length);
  await pageResponse.text();
  if (!cookies || !encodedXsrf) return [];

  const getHistory = async (symbol: string) => {
    const historyUrl = new URL(
      "https://www.barchart.com/proxies/timeseries/queryeod.ashx",
    );
    historyUrl.search = new URLSearchParams({
      symbol,
      data: "daily",
      maxrecords: String(maxRecords),
      volume: "contract",
      order: "asc",
      dividends: "false",
      backadjust: "false",
      daystoexpiration: "1",
      contractroll: "expiration",
    }).toString();
    const response = await fetch(historyUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; MarketMemoAgent/1.0)",
        referer: pageUrl,
        cookie: cookies,
        "x-xsrf-token": decodeURIComponent(encodedXsrf),
      },
      cache: "no-store",
    });
    return response.ok ? parseHistory(await response.text()) : [];
  };

  const [prices, breadth] = await Promise.all([
    getHistory(priceSymbol),
    getHistory(breadthSymbol),
  ]);
  const breadthByDate = new Map(
    breadth.map((point) => [point.date, point.close]),
  );

  return prices.flatMap((point) => {
    const breadthValue = breadthByDate.get(point.date);
    return breadthValue == null
      ? []
      : [{ date: point.date, price: point.close, breadth: breadthValue }];
  });
}

function mean(points: CombinedHistoryPoint[], end: number, size: number) {
  const values = points.slice(end - size + 1, end + 1).map((point) => point.price);
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function toFeatures(points: CombinedHistoryPoint[]): MarketFeatures[] {
  return points.slice(59).map((point, offset) => {
    const index = offset + 59;
    const sma20 = mean(points, index, 20);
    const sma60 = mean(points, index, 60);
    return {
      date: point.date,
      price: point.price,
      breadth: point.breadth,
      bias20: (point.price / sma20 - 1) * 100,
      bias60: (point.price / sma60 - 1) * 100,
      breadthMomentum5: point.breadth - points[index - 5].breadth,
    };
  });
}

function futureStats(points: CombinedHistoryPoint[], index: number) {
  const start = points[index].price;
  const future = points.slice(index + 1, index + 21).map((point) => point.price);
  return {
    return20: ((future.at(-1)! / start) - 1) * 100,
    maxDrawdown20: (Math.min(...future) / start - 1) * 100,
  };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function distance(a: MarketFeatures, b: MarketFeatures) {
  return (
    Math.abs(a.bias20 - b.bias20) / 4 +
    Math.abs(a.bias60 - b.bias60) / 8 +
    Math.abs(a.breadth - b.breadth) / 22 +
    Math.abs(a.breadthMomentum5 - b.breadthMomentum5) / 18
  );
}

function describeSimilarity(current: MarketFeatures, analog: MarketFeatures) {
  const reasons = [
    `Breadth ${round(analog.breadth)}%，目前為 ${round(current.breadth)}%`,
    `MA20 乖離 ${round(analog.bias20)}%，目前為 ${round(current.bias20)}%`,
  ];
  if (Math.sign(analog.breadthMomentum5) === Math.sign(current.breadthMomentum5)) {
    reasons.push(
      `五日 Breadth 同為${current.breadthMomentum5 >= 0 ? "擴張" : "收縮"}`,
    );
  }
  return reasons;
}

export function rankHistoricalAnalogs(
  spxPoints: CombinedHistoryPoint[],
  qqqPoints: CombinedHistoryPoint[],
  count = 3,
): { current: { spx: MarketFeatures; qqq: MarketFeatures }; analogs: HistoricalAnalog[] } {
  const qqqByDate = new Map(qqqPoints.map((point) => [point.date, point]));
  const spxAligned = spxPoints.filter((point) => qqqByDate.has(point.date));
  const qqqAligned = spxAligned.map((point) => qqqByDate.get(point.date)!);
  if (spxAligned.length < 100) {
    throw new Error("可用的共同歷史資料不足，無法搜尋相似案例。");
  }

  const spxFeatures = toFeatures(spxAligned);
  const qqqFeatures = toFeatures(qqqAligned);
  const current = {
    spx: spxFeatures.at(-1)!,
    qqq: qqqFeatures.at(-1)!,
  };
  const candidates = spxFeatures
    .slice(0, -21)
    .map((spxFeature, featureIndex) => {
      const qqqFeature = qqqFeatures[featureIndex];
      const score = distance(current.spx, spxFeature) + distance(current.qqq, qqqFeature);
      return { featureIndex, spxFeature, qqqFeature, score };
    })
    .sort((a, b) => a.score - b.score);

  const selected: typeof candidates = [];
  for (const candidate of candidates) {
    const candidateTime = Date.parse(candidate.spxFeature.date);
    const isSeparated = selected.every(
      (item) => Math.abs(Date.parse(item.spxFeature.date) - candidateTime) > 21 * 86_400_000,
    );
    if (isSeparated) selected.push(candidate);
    if (selected.length === count) break;
  }

  return {
    current,
    analogs: selected.map((candidate) => {
      const rawIndex = candidate.featureIndex + 59;
      const spxFuture = futureStats(spxAligned, rawIndex);
      const qqqFuture = futureStats(qqqAligned, rawIndex);
      return {
        date: candidate.spxFeature.date,
        similarity: round(Math.max(0, 100 - candidate.score * 11)),
        reasons: [
          ...describeSimilarity(current.spx, candidate.spxFeature),
          `QQQ Breadth ${round(candidate.qqqFeature.breadth)}%，目前為 ${round(current.qqq.breadth)}%`,
        ],
        spxReturn20: round(spxFuture.return20),
        qqqReturn20: round(qqqFuture.return20),
        spxMaxDrawdown20: round(spxFuture.maxDrawdown20),
        qqqMaxDrawdown20: round(qqqFuture.maxDrawdown20),
      };
    }),
  };
}

export async function getMarketHistoryTool() {
  const [spx, qqq] = await Promise.all([
    getCombinedHistory("$SPX", "$S5TW"),
    getCombinedHistory("QQQ", "$NDTW"),
  ]);
  return { spx, qqq };
}
