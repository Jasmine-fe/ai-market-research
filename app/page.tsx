import CombinedTrendChart, {
  type CombinedHistoryPoint,
} from "./CombinedTrendChart";
import MarketBrief from "./MarketBrief";
import {
  parseBreadthSnapshot,
  type BreadthSnapshot,
} from "../lib/barchart-breadth";

export const dynamic = "force-dynamic";

type MarketSnapshot = {
  close: number;
  sma20: number;
  sma60: number;
  changePercent: number;
  high52w: number;
  low52w: number;
  delayed: boolean;
};

type MarketState = ReturnType<typeof getMarketState>;

type HistoryPoint = {
  date: string;
  close: number;
};

async function getMarketSnapshot(
  ticker: "SP:SPX" | "NASDAQ:QQQ",
): Promise<MarketSnapshot | null> {
  try {
    const response = await fetch(
      "https://scanner.tradingview.com/america/scan",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbols: { tickers: [ticker], query: { types: [] } },
          columns: [
            "close",
            "SMA20",
            "SMA60",
            "change",
            "price_52_week_high",
            "price_52_week_low",
            "update_mode",
          ],
          range: [0, 1],
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) return null;
    const payload = (await response.json()) as {
      data?: Array<{ d?: Array<number | string> }>;
    };
    const row = payload.data?.[0]?.d;
    if (
      !row ||
      typeof row[0] !== "number" ||
      typeof row[1] !== "number" ||
      typeof row[2] !== "number"
    ) {
      return null;
    }

    return {
      close: row[0],
      sma20: row[1],
      sma60: row[2],
      changePercent: typeof row[3] === "number" ? row[3] : 0,
      high52w: typeof row[4] === "number" ? row[4] : row[0],
      low52w: typeof row[5] === "number" ? row[5] : row[0],
      delayed: String(row[6] ?? "").includes("delayed"),
    };
  } catch {
    return null;
  }
}

async function getBreadthSnapshot(
  symbol: "S5TW" | "NDTW",
): Promise<BreadthSnapshot | null> {
  try {
    const response = await fetch(
      `https://www.barchart.com/stocks/quotes/%24${symbol}`,
      {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en-US,en;q=0.8",
          "user-agent":
            "Mozilla/5.0 (compatible; MarketBreadthDashboard/1.0)",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) return null;
    const html = await response.text();
    return parseBreadthSnapshot(html, symbol);
  } catch {
    return null;
  }
}

function parseHistory(source: string): HistoryPoint[] {
  return source
    .trim()
    .split("\n")
    .map((row) => {
      const columns = row.split(",");
      return {
        date: columns[1] ?? "",
        close: Number(columns[5]),
      };
    })
    .filter(
      (point) =>
        /^\d{4}-\d{2}-\d{2}$/.test(point.date) &&
        Number.isFinite(point.close),
    );
}

async function getCombinedHistory(
  priceSymbol: "$SPX" | "QQQ",
  breadthSymbol: "$S5TW" | "$NDTW",
): Promise<CombinedHistoryPoint[]> {
  try {
    const pageUrl = `https://www.barchart.com/stocks/quotes/${encodeURIComponent(breadthSymbol)}/interactive-chart`;
    const pageResponse = await fetch(pageUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.8",
        "user-agent":
          "Mozilla/5.0 (compatible; MarketBreadthDashboard/1.0)",
      },
      cache: "no-store",
    });
    if (!pageResponse.ok) return [];

    const setCookies = pageResponse.headers.getSetCookie();
    const cookies = setCookies
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
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
        maxrecords: "260",
        volume: "contract",
        order: "asc",
        dividends: "false",
        backadjust: "false",
        daystoexpiration: "1",
        contractroll: "expiration",
      }).toString();
      const response = await fetch(historyUrl, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; MarketBreadthDashboard/1.0)",
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
        : [
            {
              date: point.date,
              price: point.close,
              breadth: breadthValue,
            },
          ];
    });
  } catch {
    return [];
  }
}

function formatNumber(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function signed(value: number | null | undefined, suffix = "") {
  if (value == null || !Number.isFinite(value)) return "資料暫缺";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}${suffix}`;
}

function getMarketState(bias: number | null, breadth: number | null) {
  if (bias == null || breadth == null) {
    return {
      label: "等待完整資料",
      tone: "neutral",
      summary: "目前有資料來源暫時無法回應，暫不產生市場解讀。",
      action: "稍後重新整理，或直接開啟下方資料來源核對。",
    };
  }

  if (bias >= 0 && breadth >= 60) {
    return {
      label: "廣泛上漲",
      tone: "positive",
      summary: "價格位於 MA20 之上，多數成分股也參與上漲。",
      action: "結構偏健康；觀察 Breadth 是否繼續擴張。",
    };
  }
  if (bias >= 0 && breadth < 40) {
    return {
      label: "狹窄上漲",
      tone: "warning",
      summary: "價格偏強，但參與上漲的股票有限，可能由權值股主導。",
      action: "避免只看價格追價；留意寬度是否持續背離。",
    };
  }
  if (bias < 0 && breadth >= 60) {
    return {
      label: "內部輪動",
      tone: "positive",
      summary: "價格在 MA20 下方，但多數成分股仍站穩短期均線。",
      action: "市場內部可能比價格健康；觀察權值股是否止跌。",
    };
  }
  if (bias < 0 && breadth < 40) {
    return {
      label: breadth < 15 ? "廣泛超賣" : "廣泛走弱",
      tone: breadth < 15 ? "extreme" : "negative",
      summary:
        breadth < 15
          ? "價格與多數成分股同步偏弱，已進入短線極端區。"
          : "價格與市場參與度同步下降，賣壓較為全面。",
      action:
        breadth < 15
      ? "先視為佈局準備區；等待 Breadth 反轉與情緒確認。"
          : "暫不把下跌當成底部；持續觀察 Breadth 變化。",
    };
  }
  return {
    label: "多空混合",
    tone: "neutral",
    summary: "價格位置與市場參與度尚未形成一致方向。",
    action: "等待其中一項明確擴張或惡化，不急著下結論。",
  };
}

function MetricCard({
  eyebrow,
  value,
  unit,
  detail,
  change,
  tone = "default",
}: {
  eyebrow: string;
  value: string;
  unit?: string;
  detail: string;
  change?: string;
  tone?: "default" | "positive" | "negative";
}) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__top">
        <p>{eyebrow}</p>
        {change && <span>{change}</span>}
      </div>
      <div className="metric-card__value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      <p className="metric-card__detail">{detail}</p>
    </article>
  );
}

function MarketSection({
  id,
  overline,
  title,
  description,
  priceLabel,
  breadthLabel,
  market,
  breadth,
  bias20,
  bias60,
  state,
  priceSourceUrl,
  breadthSourceUrl,
  history,
}: {
  id: string;
  overline: string;
  title: string;
  description: string;
  priceLabel: string;
  breadthLabel: string;
  market: MarketSnapshot | null;
  breadth: BreadthSnapshot | null;
  bias20: number | null;
  bias60: number | null;
  state: MarketState;
  priceSourceUrl: string;
  breadthSourceUrl: string;
  history: CombinedHistoryPoint[];
}) {
  const breadthPosition =
    breadth?.high52w != null && breadth?.low52w != null
      ? `${formatNumber(breadth.low52w)}–${formatNumber(breadth.high52w)}`
      : "資料暫缺";

  return (
    <section className="market-section" aria-labelledby={`${id}-heading`}>
      <div className="market-section__heading">
        <div>
          <p className="overline">{overline}</p>
          <h2 id={`${id}-heading`}>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="market-section__date">
          <span>BREADTH DATA</span>
          <strong>{breadth?.tradeDate ?? "暫缺"}</strong>
        </div>
      </div>

      <div className="metrics" aria-label={`${title}主要數據`}>
        <MetricCard
          eyebrow={priceLabel}
          value={market ? formatNumber(market.close) : "—"}
          detail={
            market
              ? `52週區間 ${formatNumber(market.low52w)}–${formatNumber(market.high52w)}`
              : "TradingView 資料暫時無法取得"
          }
          change={
            market ? signed(market.changePercent, "% today") : "資料暫缺"
          }
          tone={
            market && market.changePercent > 0
              ? "positive"
              : market && market.changePercent < 0
                ? "negative"
                : "default"
          }
        />
        <MetricCard
          eyebrow={`${priceLabel} · MA20`}
          value={market ? formatNumber(market.sma20) : "—"}
          detail="過去20個交易日的平均價格"
        />
        <MetricCard
          eyebrow="PRICE · MA20 BIAS"
          value={bias20 != null ? signed(bias20) : "—"}
          unit="%"
          detail={
            bias20 == null
              ? "無法計算"
              : bias20 >= 0
                ? "目前價格位於 MA20 之上"
                : "目前價格位於 MA20 之下"
          }
          tone={
            bias20 == null
              ? "default"
              : bias20 >= 0
                ? "positive"
                : "negative"
          }
        />
        <MetricCard
          eyebrow={`${priceLabel} · MA60`}
          value={market ? formatNumber(market.sma60) : "—"}
          detail="過去60個交易日的平均價格"
        />
        <MetricCard
          eyebrow="PRICE · MA60 BIAS"
          value={bias60 != null ? signed(bias60) : "—"}
          unit="%"
          detail={
            bias60 == null
              ? "無法計算"
              : bias60 >= 0
                ? "目前價格位於 MA60 之上"
                : "目前價格位於 MA60 之下"
          }
          tone={
            bias60 == null
              ? "default"
              : bias60 >= 0
                ? "positive"
                : "negative"
          }
        />
        <MetricCard
          eyebrow={breadthLabel}
          value={breadth ? formatNumber(breadth.value) : "—"}
          unit="%"
          detail={`52週區間 ${breadthPosition}`}
          change={
            breadth
              ? signed(breadth.changePoints, " pt today")
              : "資料暫缺"
          }
          tone={
            breadth && breadth.value >= 60
              ? "positive"
              : breadth && breadth.value < 40
                ? "negative"
                : "default"
          }
        />
      </div>

      <div className="state-panel">
        <div className="state-panel__label">
          <span>CURRENT STATE</span>
          <strong className={`state-pill state-pill--${state.tone}`}>
            {state.label}
          </strong>
        </div>
        <div>
          <h2>{state.summary}</h2>
          <p>{state.action}</p>
        </div>
        <div className="state-panel__coordinates">
          <div>
            <span>短期價格</span>
            <strong>
              {bias20 == null
                ? "—"
                : bias20 >= 0
                  ? "MA20上方"
                  : "MA20下方"}
            </strong>
          </div>
          <div>
            <span>中期價格</span>
            <strong>
              {bias60 == null
                ? "—"
                : bias60 >= 0
                  ? "MA60上方"
                  : "MA60下方"}
            </strong>
          </div>
          <div>
            <span>市場參與</span>
            <strong>
              {breadth
                ? breadth.value >= 60
                  ? "偏高"
                  : breadth.value < 40
                    ? "偏低"
                    : "中性"
                : "—"}
            </strong>
          </div>
        </div>
      </div>

      <article className="chart-card combined-chart-card">
        <div className="section-heading">
          <div>
            <p className="overline">PRICE × MARKET PARTICIPATION</p>
            <h2>{priceLabel} 與 {breadthLabel}</h2>
          </div>
          <div className="section-heading__links">
            <a href={priceSourceUrl} target="_blank" rel="noreferrer">
              價格來源 ↗
            </a>
            <a href={breadthSourceUrl} target="_blank" rel="noreferrer">
              Breadth來源 ↗
            </a>
          </div>
        </div>
        <CombinedTrendChart
          data={history}
          priceLabel={priceLabel}
          breadthLabel={breadthLabel}
        />
      </article>
    </section>
  );
}

export default async function Home() {
  const [spx, spxBreadth, qqq, qqqBreadth, spxHistory, qqqHistory] =
    await Promise.all([
      getMarketSnapshot("SP:SPX"),
      getBreadthSnapshot("S5TW"),
      getMarketSnapshot("NASDAQ:QQQ"),
      getBreadthSnapshot("NDTW"),
      getCombinedHistory("$SPX", "$S5TW"),
      getCombinedHistory("QQQ", "$NDTW"),
    ]);
  const spxBias =
    spx && spx.sma20 !== 0 ? (spx.close / spx.sma20 - 1) * 100 : null;
  const spxBias60 =
    spx && spx.sma60 !== 0 ? (spx.close / spx.sma60 - 1) * 100 : null;
  const qqqBias =
    qqq && qqq.sma20 !== 0 ? (qqq.close / qqq.sma20 - 1) * 100 : null;
  const qqqBias60 =
    qqq && qqq.sma60 !== 0 ? (qqq.close / qqq.sma60 - 1) * 100 : null;
  const spxState = getMarketState(spxBias, spxBreadth?.value ?? null);
  const qqqState = getMarketState(qqqBias, qqqBreadth?.value ?? null);

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="回到頁首">
          <span className="brand__mark" aria-hidden="true">
            MM
          </span>
          <span>
            Market Memo
            <small>US Breadth + AI Research</small>
          </span>
        </a>
        <div className="freshness">
          <span className="freshness__dot" />
          每次開啟重新取得資料
        </div>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="overline">SPX · QQQ · DAILY MONITOR</p>
          <h1>美股市場寬度儀表板</h1>
          <p className="hero__copy">
            分別觀察 S&amp;P 500 與 QQQ
            離短、中期平均成本多遠，以及各自有多少成分股共同參與行情。
            儀表板先呈現可核對的趨勢數據，AI Market Research 再從過去十年的 FOMC 文件搜尋官方證據。
          </p>
        </div>
        <div className="as-of">
          <span>LATEST BREADTH DATA</span>
          <strong>
            {spxBreadth?.tradeDate ?? qqqBreadth?.tradeDate ?? "暫時無法取得"}
          </strong>
          <small>S&amp;P 500 · Nasdaq-100 收盤資料</small>
        </div>
      </section>

      <section className="metric-guide" aria-labelledby="metric-guide-heading">
        <div className="metric-guide__heading">
          <p className="overline">START HERE · 指標快速入門</p>
          <h2 id="metric-guide-heading">指標定義</h2>
          <p>
            先用均線建立比較基準，再看多少股票站上均線，最後觀察價格離均線多遠
          </p>
        </div>
        <div className="metric-guide__grid">
          <article>
            <span className="metric-guide__number">01</span>
            <div>
              <span className="metric-guide__relation">先建立基準</span>
              <h3>均線 MA20／MA60</h3>
              <p>
                均線是過去一段時間的平均價格。MA20 代表近 20 個交易日，MA60 代表近 60 個交易日，可用來比較目前價格偏強或偏弱。
              </p>
            </div>
          </article>
          <article>
            <span className="metric-guide__number">02</span>
            <div>
              <span className="metric-guide__relation">由 MA20 計算</span>
              <h3>市場廣度 Breadth 20</h3>
              <p>
                計算成分股中，有多少比例的股票高於各自的 MA20。80% 代表每 100 檔約有 80 檔站上均線，行情參與度較廣。
              </p>
            </div>
          </article>
          <article>
            <span className="metric-guide__number">03</span>
            <div>
              <span className="metric-guide__relation">衡量與 MA 的距離</span>
              <h3>乖離率 Bias</h3>
              <p>
                目前價格與均線相差多少百分比。正值代表價格在均線上方，負值代表在下方；絕對值越大，距離均線越遠。
              </p>
            </div>
          </article>
        </div>
      </section>

      <MarketBrief />

      <MarketSection
        id="spx"
        overline="BROAD US MARKET"
        title="S&P 500"
        description="用大盤價格位置與 500 檔成分股參與度，掌握整體美股短期趨勢。"
        priceLabel="S&P 500 INDEX"
        breadthLabel="S&P 500 · BREADTH 20"
        market={spx}
        breadth={spxBreadth}
        bias20={spxBias}
        bias60={spxBias60}
        state={spxState}
        priceSourceUrl="https://www.tradingview.com/symbols/SPX/"
        breadthSourceUrl="https://www.tradingview.com/symbols/INDEX-S5TW/"
        history={spxHistory}
      />

      <MarketSection
        id="qqq"
        overline="NASDAQ-100 ETF"
        title="QQQ / Nasdaq-100"
        description="用 QQQ 價格位置與 Nasdaq-100 成分股參與度，掌握大型科技與成長股趨勢。"
        priceLabel="QQQ ETF"
        breadthLabel="NASDAQ-100 · BREADTH 20"
        market={qqq}
        breadth={qqqBreadth}
        bias20={qqqBias}
        bias60={qqqBias60}
        state={qqqState}
        priceSourceUrl="https://www.tradingview.com/symbols/NASDAQ-QQQ/"
        breadthSourceUrl="https://www.tradingview.com/symbols/INDEX-NDTW/"
        history={qqqHistory}
      />

      <section className="reading-grid">
        <article className="method-card">
          <p className="overline">HOW IT IS CALCULATED</p>
          <h2>價格週期與市場參與，各自回答不同問題</h2>
          <div className="formula">
            <span>MA20／MA60乖離率</span>
            <code>(指數或ETF ÷ MA20或MA60 − 1) × 100</code>
            <p>
              MA20 衡量短期價格位置；MA60 衡量約一季交易日的中期價格位置。
            </p>
          </div>
          <div className="formula">
            <span>傳統等權Breadth 20</span>
            <code>高於各自MA20的成分股數 ÷ 有效成分股數 × 100</code>
            <p>
              分別衡量 S&amp;P 500 與 Nasdaq-100
              有多少股票共同參與，每檔股票只算一票。
            </p>
          </div>
        </article>

        <article className="matrix-card">
          <div className="section-heading">
            <div>
              <p className="overline">SHORT-TERM MATRIX</p>
              <h2>MA20 與 Breadth 20 的短期判讀方式</h2>
            </div>
          </div>
          <div className="matrix">
            <div className="matrix__axis matrix__axis--y">Breadth 高</div>
            <div className="matrix__cell matrix__cell--good">
              <strong>內部輪動</strong>
              <span>Bias20負 · Breadth高</span>
            </div>
            <div className="matrix__cell matrix__cell--best">
              <strong>廣泛上漲</strong>
              <span>Bias20正 · Breadth高</span>
            </div>
            <div className="matrix__axis matrix__axis--y">Breadth 低</div>
            <div className="matrix__cell matrix__cell--bad">
              <strong>廣泛走弱</strong>
              <span>Bias20負 · Breadth低</span>
            </div>
            <div className="matrix__cell matrix__cell--warn">
              <strong>狹窄上漲</strong>
              <span>Bias20正 · Breadth低</span>
            </div>
            <div />
            <div className="matrix__axis">Bias20 負</div>
            <div className="matrix__axis">Bias20 正</div>
          </div>
        </article>
      </section>

      <section className="thresholds">
        <div className="section-heading">
          <div>
            <p className="overline">REFERENCE ZONES</p>
            <h2>Breadth 20 參考區間</h2>
          </div>
          <p>S&amp;P 500 與 Nasdaq-100 各自判讀；極端值不是自動買賣訊號。</p>
        </div>
        <div className="threshold-bar" aria-label="Breadth 20 參考區間">
          <span className="threshold-bar__extreme">0–15 極度低迷</span>
          <span className="threshold-bar__weak">15–40 偏弱</span>
          <span className="threshold-bar__neutral">40–60 中性</span>
          <span className="threshold-bar__healthy">60–85 健康</span>
          <span className="threshold-bar__hot">85–100 極高</span>
        </div>
        <p className="thresholds__note">
          高於85%可能代表多頭廣度擴張，也可能短線過熱；低於15%代表廣泛超賣，
          仍需等待 Breadth 反轉及情緒確認。
        </p>
      </section>

      <footer>
        <div>
          <strong>資料來源</strong>
          <p>
            即時卡片：TradingView 延遲行情與 Barchart S5TW、NDTW；歷史雙層圖：
            Barchart 日線資料；AI Brief 文件：Federal Reserve FOMC 會議紀錄。
            資料可能延遲或中斷，請以來源頁面為準。
          </p>
        </div>
        <p>
          本網站僅供研究與資訊整理，不構成投資建議。投資決策與風險由使用者自行承擔。
        </p>
      </footer>
    </main>
  );
}
