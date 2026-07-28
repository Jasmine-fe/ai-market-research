import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "美股市場寬度儀表板",
  description: "追蹤 S&P 500、MA20 乖離率與傳統等權 Breadth 20。",
};

type SpxSnapshot = {
  close: number;
  sma20: number;
  changePercent: number;
  high52w: number;
  low52w: number;
  delayed: boolean;
};

type BreadthSnapshot = {
  value: number;
  changePoints: number;
  tradeDate: string;
  high52w: number | null;
  low52w: number | null;
};

async function getSpxSnapshot(): Promise<SpxSnapshot | null> {
  try {
    const response = await fetch(
      "https://scanner.tradingview.com/america/scan",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbols: { tickers: ["SP:SPX"], query: { types: [] } },
          columns: [
            "close",
            "SMA20",
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
    if (!row || typeof row[0] !== "number" || typeof row[1] !== "number") {
      return null;
    }

    return {
      close: row[0],
      sma20: row[1],
      changePercent: typeof row[2] === "number" ? row[2] : 0,
      high52w: typeof row[3] === "number" ? row[3] : row[0],
      low52w: typeof row[4] === "number" ? row[4] : row[0],
      delayed: String(row[5] ?? "").includes("delayed"),
    };
  } catch {
    return null;
  }
}

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

async function getBreadthSnapshot(): Promise<BreadthSnapshot | null> {
  try {
    const response = await fetch(
      "https://www.barchart.com/stocks/quotes/%24S5TW",
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
    const quote = html.match(
      /"symbol":"\$S5TW","symbolName":"[^"]+","symbolType":9,"lastPrice":"([^"]+)","priceChange":"([^"]+)","percentChange":"[^"]+"[^}]*"tradeTime":"([^"]+)"/,
    );
    if (!quote) return null;

    const value = Number(quote[1].replace(/,/g, ""));
    const changePoints = Number(quote[2].replace(/[+,]/g, ""));
    if (!Number.isFinite(value) || !Number.isFinite(changePoints)) return null;

    return {
      value,
      changePoints,
      tradeDate: quote[3],
      high52w: firstNumber(html, [
        /&quot;highPrice1y&quot;:([\d.]+)/,
        /"highPrice1y":([\d.]+)/,
      ]),
      low52w: firstNumber(html, [
        /&quot;lowPrice1y&quot;:([\d.]+)/,
        /"lowPrice1y":([\d.]+)/,
      ]),
    };
  } catch {
    return null;
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
      summary: "指數位於 MA20 之上，多數成分股也參與上漲。",
      action: "結構偏健康；觀察 Breadth 是否繼續擴張。",
    };
  }
  if (bias >= 0 && breadth < 40) {
    return {
      label: "狹窄上漲",
      tone: "warning",
      summary: "指數偏強，但參與上漲的股票有限，可能由權值股主導。",
      action: "避免只看指數追價；留意寬度是否持續背離。",
    };
  }
  if (bias < 0 && breadth >= 60) {
    return {
      label: "內部輪動",
      tone: "positive",
      summary: "指數在 MA20 下方，但多數成分股仍站穩短期均線。",
      action: "市場內部可能比指數健康；觀察權值股是否止跌。",
    };
  }
  if (bias < 0 && breadth < 40) {
    return {
      label: breadth < 15 ? "廣泛超賣" : "廣泛走弱",
      tone: breadth < 15 ? "extreme" : "negative",
      summary:
        breadth < 15
          ? "指數與多數成分股同步偏弱，已進入短線極端區。"
          : "指數與市場參與度同步下降，賣壓較為全面。",
      action:
        breadth < 15
          ? "先視為布局準備區；等待 Breadth 反轉與情緒確認。"
          : "暫不把下跌當成底部；持續觀察 Breadth 變化。",
    };
  }
  return {
    label: "多空混合",
    tone: "neutral",
    summary: "指數位置與市場參與度尚未形成一致方向。",
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

export default async function Home() {
  const [spx, breadth] = await Promise.all([
    getSpxSnapshot(),
    getBreadthSnapshot(),
  ]);
  const bias =
    spx && spx.sma20 !== 0 ? (spx.close / spx.sma20 - 1) * 100 : null;
  const state = getMarketState(bias, breadth?.value ?? null);
  const breadthPosition =
    breadth?.high52w != null && breadth?.low52w != null
      ? `${formatNumber(breadth.low52w)}–${formatNumber(breadth.high52w)}`
      : "資料暫缺";

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="回到頁首">
          <span className="brand__mark" aria-hidden="true">
            MM
          </span>
          <span>
            Market Memo
            <small>US Breadth Monitor</small>
          </span>
        </a>
        <div className="freshness">
          <span className="freshness__dot" />
          每次開啟重新取得資料
        </div>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="overline">S&amp;P 500 · DAILY MONITOR</p>
          <h1>美股市場寬度儀表板</h1>
          <p className="hero__copy">
            同時觀察指數離短期平均成本多遠，以及有多少成分股共同參與行情。
            第一版先讓數據清楚、來源可核對，再逐步加入情緒與產業資訊。
          </p>
        </div>
        <div className="as-of">
          <span>BREATH DATA AS OF</span>
          <strong>{breadth?.tradeDate ?? "暫時無法取得"}</strong>
          <small>美國市場收盤資料</small>
        </div>
      </section>

      <section className="metrics" aria-label="市場主要數據">
        <MetricCard
          eyebrow="S&P 500 INDEX"
          value={spx ? formatNumber(spx.close) : "—"}
          detail={
            spx
              ? `52週區間 ${formatNumber(spx.low52w)}–${formatNumber(spx.high52w)}`
              : "TradingView 資料暫時無法取得"
          }
          change={
            spx ? signed(spx.changePercent, "% today") : "資料暫缺"
          }
          tone={
            spx && spx.changePercent > 0
              ? "positive"
              : spx && spx.changePercent < 0
                ? "negative"
                : "default"
          }
        />
        <MetricCard
          eyebrow="S&P 500 · MA20"
          value={spx ? formatNumber(spx.sma20) : "—"}
          detail="過去20個交易日的指數平均價格"
        />
        <MetricCard
          eyebrow="INDEX · MA20 BIAS"
          value={bias != null ? signed(bias) : "—"}
          unit="%"
          detail={
            bias == null
              ? "無法計算"
              : bias >= 0
                ? "指數目前位於 MA20 之上"
                : "指數目前位於 MA20 之下"
          }
          tone={
            bias == null ? "default" : bias >= 0 ? "positive" : "negative"
          }
        />
        <MetricCard
          eyebrow="EQUAL-WEIGHT · BREADTH 20"
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
      </section>

      <section className="state-panel">
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
            <span>價格位置</span>
            <strong>{bias == null ? "—" : bias >= 0 ? "MA20上方" : "MA20下方"}</strong>
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
      </section>

      <section className="chart-grid">
        <article className="chart-card">
          <div className="section-heading">
            <div>
              <p className="overline">PRICE LOCATION</p>
              <h2>S&amp;P 500 指數走勢</h2>
            </div>
            <a
              href="https://www.tradingview.com/symbols/SPX/"
              target="_blank"
              rel="noreferrer"
            >
              TradingView ↗
            </a>
          </div>
          <iframe
            title="S&P 500 指數歷史圖"
            src="https://s.tradingview.com/widgetembed/?symbol=SP%3ASPX&interval=D&theme=dark&style=1&timezone=America%2FNew_York&withdateranges=1&hide_side_toolbar=1&allow_symbol_change=0&save_image=0&hideideas=1&locale=zh_TW"
            loading="lazy"
          />
        </article>

        <article className="chart-card">
          <div className="section-heading">
            <div>
              <p className="overline">MARKET PARTICIPATION</p>
              <h2>Breadth 20 歷史走勢</h2>
            </div>
            <a
              href="https://www.tradingview.com/symbols/INDEX-S5TW/"
              target="_blank"
              rel="noreferrer"
            >
              S5TW ↗
            </a>
          </div>
          <iframe
            title="S&P 500 Breadth 20 歷史圖"
            src="https://s.tradingview.com/widgetembed/?symbol=INDEX%3AS5TW&interval=D&theme=dark&style=1&timezone=America%2FNew_York&withdateranges=1&hide_side_toolbar=1&allow_symbol_change=0&save_image=0&hideideas=1&locale=zh_TW"
            loading="lazy"
          />
        </article>
      </section>

      <section className="reading-grid">
        <article className="method-card">
          <p className="overline">HOW IT IS CALCULATED</p>
          <h2>兩個數字，各自回答不同問題</h2>
          <div className="formula">
            <span>MA20乖離率</span>
            <code>(SPX ÷ MA20 − 1) × 100</code>
            <p>衡量加權指數離過去20日平均價格多遠。</p>
          </div>
          <div className="formula">
            <span>傳統等權Breadth 20</span>
            <code>高於各自MA20的成分股數 ÷ 有效成分股數 × 100</code>
            <p>衡量行情有多少股票共同參與，每檔股票只算一票。</p>
          </div>
        </article>

        <article className="matrix-card">
          <div className="section-heading">
            <div>
              <p className="overline">TWO-DIMENSION MATRIX</p>
              <h2>同時使用的判讀方式</h2>
            </div>
          </div>
          <div className="matrix">
            <div className="matrix__axis matrix__axis--y">Breadth 高</div>
            <div className="matrix__cell matrix__cell--good">
              <strong>內部輪動</strong>
              <span>Bias負 · Breadth高</span>
            </div>
            <div className="matrix__cell matrix__cell--best">
              <strong>廣泛上漲</strong>
              <span>Bias正 · Breadth高</span>
            </div>
            <div className="matrix__axis matrix__axis--y">Breadth 低</div>
            <div className="matrix__cell matrix__cell--bad">
              <strong>廣泛走弱</strong>
              <span>Bias負 · Breadth低</span>
            </div>
            <div className="matrix__cell matrix__cell--warn">
              <strong>狹窄上漲</strong>
              <span>Bias正 · Breadth低</span>
            </div>
            <div />
            <div className="matrix__axis">Bias 負</div>
            <div className="matrix__axis">Bias 正</div>
          </div>
        </article>
      </section>

      <section className="thresholds">
        <div className="section-heading">
          <div>
            <p className="overline">REFERENCE ZONES</p>
            <h2>Breadth 20 參考區間</h2>
          </div>
          <p>極端值是觀察區，不是自動買賣訊號。</p>
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
            S&amp;P 500 與 MA20：TradingView 延遲行情；Breadth 20：
            Barchart S5TW／TradingView。資料可能延遲或中斷，請以來源頁面為準。
          </p>
        </div>
        <p>
          本網站僅供研究與資訊整理，不構成投資建議。投資決策與風險由使用者自行承擔。
        </p>
      </footer>
    </main>
  );
}
