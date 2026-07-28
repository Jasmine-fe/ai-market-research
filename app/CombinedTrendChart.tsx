"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

export type CombinedHistoryPoint = {
  date: string;
  price: number;
  breadth: number;
};

type RangeKey = "3M" | "6M" | "1Y";

const RANGE_LENGTH: Record<RangeKey, number> = {
  "3M": 66,
  "6M": 132,
  "1Y": 260,
};

function movingAverage(points: CombinedHistoryPoint[], period = 20) {
  let rolling = 0;
  return points.map((point, index) => {
    rolling += point.price;
    if (index >= period) rolling -= points[index - period].price;
    return index >= period - 1 ? rolling / period : null;
  });
}

function compactPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function displayDate(date: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(`${date}T12:00:00Z`));
}

export default function CombinedTrendChart({
  data,
  priceLabel,
  breadthLabel,
}: {
  data: CombinedHistoryPoint[];
  priceLabel: string;
  breadthLabel: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<RangeKey>("1Y");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [width, setWidth] = useState(900);

  const allMa20 = useMemo(() => movingAverage(data, 20), [data]);
  const allMa60 = useMemo(() => movingAverage(data, 60), [data]);
  const startIndex = Math.max(0, data.length - RANGE_LENGTH[range]);
  const visibleData = useMemo(
    () => data.slice(startIndex),
    [data, startIndex],
  );
  const visibleMa20 = useMemo(
    () => allMa20.slice(startIndex),
    [allMa20, startIndex],
  );
  const visibleMa60 = useMemo(
    () => allMa60.slice(startIndex),
    [allMa60, startIndex],
  );

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(320, Math.floor(entry.contentRect.width)));
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || visibleData.length < 2) return;

    const cssHeight = width < 620 ? 500 : 570;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    canvas.style.height = `${cssHeight}px`;

    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(dpr, dpr);
    context.clearRect(0, 0, width, cssHeight);

    const colors = {
      ink: "#eff5f1",
      muted: "#82928b",
      grid: "rgba(226, 240, 232, 0.10)",
      green: "#7ee2a8",
      blue: "#83b8ff",
      violet: "#d0a8ff",
      amber: "#f1c876",
      red: "#ff817c",
      background: "#101714",
    };
    const left = width < 620 ? 12 : 22;
    const right = width < 620 ? 52 : 68;
    const plotWidth = width - left - right;
    const top = 26;
    const priceHeight = width < 620 ? 230 : 274;
    const gap = 54;
    const breadthTop = top + priceHeight + gap;
    const breadthHeight = width < 620 ? 138 : 166;
    const bottom = breadthTop + breadthHeight;

    context.fillStyle = colors.background;
    context.fillRect(0, 0, width, cssHeight);

    const priceValues = visibleData.map((point) => point.price);
    const ma20Values = visibleMa20.filter(
      (value): value is number => value != null,
    );
    const ma60Values = visibleMa60.filter(
      (value): value is number => value != null,
    );
    const rawMin = Math.min(
      ...priceValues,
      ...ma20Values,
      ...ma60Values,
    );
    const rawMax = Math.max(
      ...priceValues,
      ...ma20Values,
      ...ma60Values,
    );
    const pricePadding = Math.max((rawMax - rawMin) * 0.1, rawMax * 0.004);
    const priceMin = rawMin - pricePadding;
    const priceMax = rawMax + pricePadding;

    const x = (index: number) =>
      left + (index / Math.max(visibleData.length - 1, 1)) * plotWidth;
    const priceY = (value: number) =>
      top + ((priceMax - value) / (priceMax - priceMin)) * priceHeight;
    const breadthY = (value: number) =>
      breadthTop + ((100 - value) / 100) * breadthHeight;

    context.font = '10px "Geist Mono", monospace';
    context.textBaseline = "middle";
    context.strokeStyle = colors.grid;
    context.fillStyle = colors.muted;
    context.lineWidth = 1;

    for (let step = 0; step <= 4; step += 1) {
      const y = top + (step / 4) * priceHeight;
      const value = priceMax - (step / 4) * (priceMax - priceMin);
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(left + plotWidth, y);
      context.stroke();
      context.fillText(compactPrice(value), left + plotWidth + 8, y);
    }

    const breadthZones = [
      { from: 0, to: 15, color: "rgba(255, 129, 124, 0.08)" },
      { from: 15, to: 40, color: "rgba(255, 129, 124, 0.035)" },
      { from: 40, to: 60, color: "rgba(188, 200, 194, 0.025)" },
      { from: 60, to: 85, color: "rgba(126, 226, 168, 0.035)" },
      { from: 85, to: 100, color: "rgba(241, 200, 118, 0.07)" },
    ];
    for (const zone of breadthZones) {
      context.fillStyle = zone.color;
      context.fillRect(
        left,
        breadthY(zone.to),
        plotWidth,
        breadthY(zone.from) - breadthY(zone.to),
      );
    }

    for (const value of [0, 15, 40, 60, 85, 100]) {
      const y = breadthY(value);
      context.save();
      context.strokeStyle =
        value === 15 || value === 85
          ? "rgba(241, 200, 118, 0.30)"
          : colors.grid;
      context.setLineDash(value === 15 || value === 85 ? [4, 4] : []);
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(left + plotWidth, y);
      context.stroke();
      context.restore();
      context.fillStyle = colors.muted;
      context.fillText(`${value}%`, left + plotWidth + 8, y);
    }

    const drawLine = (
      values: Array<number | null>,
      yScale: (value: number) => number,
      color: string,
      lineWidth: number,
    ) => {
      context.beginPath();
      let started = false;
      values.forEach((value, index) => {
        if (value == null) return;
        const pointX = x(index);
        const pointY = yScale(value);
        if (!started) {
          context.moveTo(pointX, pointY);
          started = true;
        } else {
          context.lineTo(pointX, pointY);
        }
      });
      context.strokeStyle = color;
      context.lineWidth = lineWidth;
      context.lineJoin = "round";
      context.lineCap = "round";
      context.stroke();
    };

    drawLine(visibleMa60, priceY, colors.violet, 1.4);
    drawLine(visibleMa20, priceY, colors.blue, 1.4);
    drawLine(
      visibleData.map((point) => point.price),
      priceY,
      colors.green,
      2,
    );
    drawLine(
      visibleData.map((point) => point.breadth),
      breadthY,
      colors.amber,
      2,
    );

    context.font = '600 10px "Geist Mono", monospace';
    context.fillStyle = colors.green;
    context.fillText(priceLabel.toUpperCase(), left, 12);
    context.fillStyle = colors.amber;
    context.fillText(breadthLabel.toUpperCase(), left, breadthTop - 17);

    const dateSteps = width < 620 ? 3 : 5;
    context.font = '9px "Geist Mono", monospace';
    context.textBaseline = "top";
    for (let step = 0; step < dateSteps; step += 1) {
      const index = Math.round(
        (step / Math.max(dateSteps - 1, 1)) * (visibleData.length - 1),
      );
      const pointX = x(index);
      const label = visibleData[index].date.slice(0, 7);
      context.fillStyle = colors.muted;
      context.textAlign =
        step === 0 ? "left" : step === dateSteps - 1 ? "right" : "center";
      context.fillText(label, pointX, bottom + 14);
    }
    context.textAlign = "left";
    context.textBaseline = "middle";

    if (hoverIndex != null && visibleData[hoverIndex]) {
      const point = visibleData[hoverIndex];
      const pointX = x(hoverIndex);
      context.strokeStyle = "rgba(239, 245, 241, 0.38)";
      context.setLineDash([3, 4]);
      context.beginPath();
      context.moveTo(pointX, top);
      context.lineTo(pointX, bottom);
      context.stroke();
      context.setLineDash([]);

      for (const [pointY, color] of [
        [priceY(point.price), colors.green],
        [breadthY(point.breadth), colors.amber],
      ] as Array<[number, string]>) {
        context.beginPath();
        context.arc(pointX, pointY, 4, 0, Math.PI * 2);
        context.fillStyle = colors.background;
        context.fill();
        context.strokeStyle = color;
        context.lineWidth = 2;
        context.stroke();
      }
    }
  }, [
    breadthLabel,
    hoverIndex,
    priceLabel,
    visibleData,
    visibleMa20,
    visibleMa60,
    width,
  ]);

  function setPointerPosition(event: PointerEvent<HTMLCanvasElement>) {
    if (!canvasRef.current || visibleData.length === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const left = width < 620 ? 12 : 22;
    const right = width < 620 ? 52 : 68;
    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left - left) / (rect.width - left - right)),
    );
    setHoverIndex(Math.round(ratio * (visibleData.length - 1)));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next =
      hoverIndex == null
        ? visibleData.length - 1
        : hoverIndex + (event.key === "ArrowRight" ? 1 : -1);
    setHoverIndex(Math.max(0, Math.min(visibleData.length - 1, next)));
  }

  const hovered =
    hoverIndex != null ? visibleData[hoverIndex] ?? null : null;
  const hoveredMa20 =
    hoverIndex != null ? visibleMa20[hoverIndex] ?? null : null;
  const hoveredMa60 =
    hoverIndex != null ? visibleMa60[hoverIndex] ?? null : null;
  const latest = visibleData.at(-1);

  if (data.length < 2) {
    return (
      <div className="combined-chart__empty">
        歷史資料暫時無法取得，請稍後重新整理。
      </div>
    );
  }

  return (
    <>
      <div className="combined-chart__toolbar">
        <div className="combined-chart__legend" aria-label="圖例">
          <span className="legend-price">{priceLabel}</span>
          <span className="legend-ma20">MA20</span>
          <span className="legend-ma60">MA60</span>
          <span className="legend-breadth">{breadthLabel}</span>
        </div>
        <div className="range-controls" aria-label="圖表顯示範圍">
          {(["3M", "6M", "1Y"] as RangeKey[]).map((key) => (
            <button
              type="button"
              key={key}
              className={range === key ? "is-active" : ""}
              aria-pressed={range === key}
              onClick={() => {
                setRange(key);
                setHoverIndex(null);
              }}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
      <div className="combined-chart" ref={wrapperRef}>
        <canvas
          ref={canvasRef}
          role="img"
          tabIndex={0}
          aria-label={`${priceLabel}價格、MA20、MA60與${breadthLabel}歷史走勢，共用日期座標。使用左右方向鍵查看每日數值。`}
          onPointerMove={setPointerPosition}
          onPointerDown={setPointerPosition}
          onPointerLeave={() => setHoverIndex(null)}
          onKeyDown={handleKeyDown}
        />
        {hovered && (
          <div
            className="combined-chart__tooltip"
            style={{
              left: `${Math.min(
                76,
                Math.max(
                  2,
                  ((hoverIndex ?? 0) / Math.max(visibleData.length - 1, 1)) *
                    88,
                ),
              )}%`,
            }}
          >
            <strong>{displayDate(hovered.date)}</strong>
            <span>{priceLabel} {compactPrice(hovered.price)}</span>
            <span>
              MA20 {hoveredMa20 == null ? "—" : compactPrice(hoveredMa20)}
            </span>
            <span>
              MA60 {hoveredMa60 == null ? "—" : compactPrice(hoveredMa60)}
            </span>
            <span>{breadthLabel} {formatNumber(hovered.breadth)}%</span>
          </div>
        )}
      </div>
      {latest && (
        <p className="combined-chart__summary">
          最新共同交易日 {displayDate(latest.date)}：{priceLabel}{" "}
          {compactPrice(latest.price)}，{breadthLabel}{" "}
          {formatNumber(latest.breadth)}%。
        </p>
      )}
    </>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
