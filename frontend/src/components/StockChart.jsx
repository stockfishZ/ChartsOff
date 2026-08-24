import React, { useState, useMemo, useRef } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatRupiah } from "./TickerList";

// Precision Candlestick Canvas with Financial Crosshair Scrubber
function CandlestickCanvas({ data, minPrice, maxPrice, height = 220 }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const svgRef = useRef(null);

  if (!data || data.length === 0) return null;

  const paddingLeft = 48;
  const paddingRight = 16;
  const paddingTop = 12;
  const paddingBottom = 22;

  const totalWidth = 600; // Reference viewBox width
  const plotWidth = totalWidth - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const priceRange = Math.max(1, maxPrice - minPrice);
  const getY = (price) => {
    if (price == null) return null;
    return paddingTop + plotHeight - ((price - minPrice) / priceRange) * plotHeight;
  };

  const candleCount = data.length;
  const stepX = plotWidth / Math.max(1, candleCount);
  const candleWidth = Math.max(2, Math.min(9, stepX * 0.65));

  // Y-axis tick values (4 steps)
  const yTicks = [0, 0.33, 0.66, 1].map((pct) => {
    const p = Math.round(minPrice + priceRange * pct);
    return { price: p, y: getY(p) };
  });

  // Calculate index from mouse/touch event coordinates
  const calculateIndexFromPointer = (clientX) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * totalWidth;
    const boundedX = Math.max(paddingLeft, Math.min(totalWidth - paddingRight - 1, relX));
    const idx = Math.floor(((boundedX - paddingLeft) / plotWidth) * candleCount);
    const clamped = Math.max(0, Math.min(candleCount - 1, idx));
    setHoveredIndex(clamped);
  };

  const handleMouseMove = (e) => {
    calculateIndexFromPointer(e.clientX);
  };

  const handleTouchMove = (e) => {
    if (e.touches && e.touches.length > 0) {
      calculateIndexFromPointer(e.touches[0].clientX);
    }
  };

  const hoveredItem = hoveredIndex != null ? data[hoveredIndex] : null;
  const activeCX = hoveredIndex != null ? paddingLeft + hoveredIndex * stepX + stepX / 2 : null;
  const activePrice = hoveredItem ? (hoveredItem.isProjected ? hoveredItem.projectedPrice : hoveredItem.close) : null;
  const activeCY = activePrice != null ? getY(activePrice) : null;

  return (
    <div className="relative select-none w-full touch-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${totalWidth} ${height}`}
        className="w-full h-56 overflow-visible cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIndex(null)}
        onTouchStart={handleTouchMove}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => setHoveredIndex(null)}
      >
        {/* Horizontal grid lines & Y-ticks */}
        {yTicks.map((t, idx) => (
          <g key={idx}>
            <line
              x1={paddingLeft}
              y1={t.y}
              x2={totalWidth - paddingRight}
              y2={t.y}
              stroke="#E5E3DC"
              strokeDasharray="2 2"
            />
            <text
              x={paddingLeft - 6}
              y={t.y + 3}
              textAnchor="end"
              fontSize="9"
              fill="#737168"
              fontFamily="monospace"
            >
              {t.price >= 1000 ? `${(t.price / 1000).toFixed(1)}k` : t.price}
            </text>
          </g>
        ))}

        {/* X-axis base line */}
        <line
          x1={paddingLeft}
          y1={paddingTop + plotHeight}
          x2={totalWidth - paddingRight}
          y2={paddingTop + plotHeight}
          stroke="#DCDAD4"
        />

        {/* Active Inspection Highlight Column (Crosshair Scrubber) */}
        {hoveredIndex != null && activeCX != null && (
          <g>
            {/* Vertical column highlight */}
            <rect
              x={activeCX - stepX / 2}
              y={paddingTop}
              width={stepX}
              height={plotHeight}
              fill="#121316"
              fillOpacity="0.05"
            />
            {/* Vertical crosshair line */}
            <line
              x1={activeCX}
              y1={paddingTop}
              x2={activeCX}
              y2={paddingTop + plotHeight}
              stroke="#121316"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            {/* Horizontal price crosshair line */}
            {activeCY != null && (
              <line
                x1={paddingLeft}
                y1={activeCY}
                x2={totalWidth - paddingRight}
                y2={activeCY}
                stroke={hoveredItem?.isProjected ? "#D97706" : "#737168"}
                strokeWidth="0.75"
                strokeDasharray="2 2"
              />
            )}
          </g>
        )}

        {/* Candles and Forecast Projections */}
        {data.map((item, idx) => {
          const cx = paddingLeft + idx * stepX + stepX / 2;
          const isInspected = hoveredIndex === idx;

          if (item.isProjected) {
            // Projected point
            const py = getY(item.projectedPrice);
            const prev = data[idx - 1];
            const prevPy = prev ? getY(prev.projectedPrice || prev.close) : py;

            return (
              <g key={`proj-${idx}`}>
                {prevPy != null && py != null && (
                  <line
                    x1={paddingLeft + (idx - 1) * stepX + stepX / 2}
                    y1={prevPy}
                    x2={cx}
                    y2={py}
                    stroke="#D97706"
                    strokeWidth={isInspected ? "2.5" : "1.8"}
                    strokeDasharray="4 2"
                  />
                )}
                <circle
                  cx={cx}
                  cy={py}
                  r={isInspected ? 4 : 2.5}
                  fill="#D97706"
                  stroke="#FFFFFF"
                  strokeWidth={isInspected ? 1.5 : 0}
                />
              </g>
            );
          }

          // Real Candlestick
          const open = item.open || item.close;
          const close = item.close;
          const high = item.high || Math.max(open, close);
          const low = item.low || Math.min(open, close);

          const isBull = close >= open;
          const candleColor = isBull ? "#1B5E20" : "#B71C1C";

          const yHigh = getY(high);
          const yLow = getY(low);
          const yOpen = getY(open);
          const yClose = getY(close);

          const topBody = Math.min(yOpen, yClose);
          const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));

          return (
            <g key={`candle-${idx}`}>
              {/* Wick */}
              <line
                x1={cx}
                y1={yHigh}
                x2={cx}
                y2={yLow}
                stroke={candleColor}
                strokeWidth={isInspected ? "1.8" : "1.2"}
              />
              {/* Candle Body */}
              <rect
                x={cx - candleWidth / 2}
                y={topBody}
                width={candleWidth}
                height={bodyHeight}
                fill={isBull ? "#E8F5E9" : "#FFEBEE"}
                stroke={candleColor}
                strokeWidth={isInspected ? 1.8 : 1}
              />
            </g>
          );
        })}

        {/* X-axis date labels */}
        {data.map((item, idx) => {
          const sampleInterval = Math.max(1, Math.floor(data.length / 5));
          const isSampled = idx % sampleInterval === 0 || idx === data.length - 1;
          const isInspected = hoveredIndex === idx;
          const cx = paddingLeft + idx * stepX + stepX / 2;

          if (isInspected) {
            // Pill badge for the active inspected date
            return (
              <g key={`x-active-${idx}`}>
                <rect
                  x={cx - 24}
                  y={paddingTop + plotHeight + 4}
                  width={48}
                  height={14}
                  fill="#121316"
                  rx={2}
                />
                <text
                  x={cx}
                  y={paddingTop + plotHeight + 14}
                  textAnchor="middle"
                  fontSize="8.5"
                  fill="#FFFFFF"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  {item.date.replace(" (P)", "")}
                </text>
              </g>
            );
          }

          if (!isSampled) return null;

          return (
            <text
              key={`x-lbl-${idx}`}
              x={cx}
              y={paddingTop + plotHeight + 14}
              textAnchor="middle"
              fontSize="8.5"
              fill="#737168"
              fontFamily="sans-serif"
            >
              {item.date}
            </text>
          );
        })}
      </svg>

      {/* Floating Hover Tooltip */}
      {hoveredItem && (
        <div className="absolute top-1 right-2 bg-white border border-[#121316] p-2 text-xs shadow-md pointer-events-none z-20">
          <div className="font-mono text-[10px] text-[#737168]">
            {hoveredItem.isProjected ? "[PROYEKSI 20 HARI]" : "[LILIN HARIAN]"}: {hoveredItem.date}
          </div>
          {hoveredItem.isProjected ? (
            <div className="font-mono font-bold text-sm text-[#D97706] mt-0.5">
              Target: {formatRupiah(hoveredItem.projectedPrice)}
            </div>
          ) : (
            <div className="mt-0.5 font-mono text-[11px] grid grid-cols-2 gap-x-3 gap-y-0.5">
              <div><span className="text-[#737168]">Buka:</span> {formatRupiah(hoveredItem.open || hoveredItem.close)}</div>
              <div><span className="text-[#737168]">Tutup:</span> {formatRupiah(hoveredItem.close)}</div>
              <div><span className="text-[#737168]">Tertinggi:</span> {formatRupiah(hoveredItem.high || hoveredItem.close)}</div>
              <div><span className="text-[#737168]">Terendah:</span> {formatRupiah(hoveredItem.low || hoveredItem.close)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function StockChart({ prediction }) {
  const [timeframe, setTimeframe] = useState("3B");
  const [chartType, setChartType] = useState("line"); // 'line' | 'candle'

  const chartData = useMemo(() => {
    if (!prediction) return [];
    const basePrice = prediction.current_price;
    const history = prediction.historical_prices || [];
    const points = [];

    const barCount = timeframe === "1B" ? 22 : timeframe === "3B" ? 66 : 130;
    const selectedBars = history.slice(-barCount);

    if (selectedBars.length > 0) {
      selectedBars.forEach((bar, idx) => {
        let label = bar.date;
        try {
          const d = new Date(bar.date);
          label = d.toLocaleDateString("id-ID", { month: "short", day: "numeric" });
        } catch (e) {}

        const isLastBar = idx === selectedBars.length - 1;

        points.push({
          date: label,
          open: bar.open ? Math.round(bar.open) : Math.round(bar.close),
          high: bar.high ? Math.round(bar.high) : Math.round(bar.close),
          low: bar.low ? Math.round(bar.low) : Math.round(bar.close),
          close: Math.round(bar.close),
          realPrice: Math.round(bar.close),
          projectedPrice: isLastBar ? Math.round(bar.close) : null,
          isProjected: false,
        });
      });
    } else {
      const d = new Date();
      points.push({
        date: d.toLocaleDateString("id-ID", { month: "short", day: "numeric" }),
        open: Math.round(basePrice),
        high: Math.round(basePrice),
        low: Math.round(basePrice),
        close: Math.round(basePrice),
        realPrice: Math.round(basePrice),
        projectedPrice: Math.round(basePrice),
        isProjected: false,
      });
    }

    // 20 Hari Proyeksi Masa Depan (Garis Oranye)
    const lastRealPrice = points.length > 0 ? (points[points.length - 1].close || basePrice) : basePrice;
    const targetPrice = basePrice * (1 + (prediction.expected_return_pct / 100));
    const horizon = prediction.target_horizon_days || 20;

    for (let d = 2; d <= horizon; d += 2) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + d);
      const dayStr = futureDate.toLocaleDateString("id-ID", { month: "short", day: "numeric" });
      const interpolated = lastRealPrice + ((targetPrice - lastRealPrice) * (d / horizon));

      points.push({
        date: `${dayStr} (P)`,
        open: null,
        high: null,
        low: null,
        close: null,
        realPrice: null,
        projectedPrice: Math.round(interpolated),
        isProjected: true,
      });
    }

    return points;
  }, [prediction, timeframe]);

  if (!prediction) return null;

  const allPrices = chartData.flatMap((d) => [
    d.high,
    d.low,
    d.realPrice,
    d.projectedPrice,
  ]).filter((p) => p != null && !isNaN(p));

  const minPrice = allPrices.length > 0 ? Math.floor(Math.min(...allPrices) * 0.98) : 0;
  const maxPrice = allPrices.length > 0 ? Math.ceil(Math.max(...allPrices) * 1.02) : 1000;

  return (
    <div className="bg-white border border-[#121316] p-4 mb-3">
      {/* Header Grafik: Judul, Tipe Chart (Line Chart / Candlestick Chart) & Timeframe */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <span className="font-mono text-xs font-bold uppercase text-[#121316] block">
            Pergerakan Harga & Proyeksi 20 Hari
          </span>
          <div className="flex items-center space-x-3 mt-1 text-[10px] font-mono">
            {chartType === "line" ? (
              <>
                <span className="flex items-center text-[#121316]">
                  <span className="inline-block w-3 h-0.5 bg-[#121316] mr-1.5"></span>
                  Harga Riil (BEI)
                </span>
                <span className="flex items-center text-[#D97706] font-semibold">
                  <span className="inline-block w-3 h-0.5 bg-[#D97706] mr-1.5"></span>
                  Proyeksi 20 Hari
                </span>
              </>
            ) : (
              <>
                <span className="flex items-center text-[#1B5E20] font-semibold">
                  <span className="inline-block w-2.5 h-2.5 bg-[#E8F5E9] border border-[#1B5E20] mr-1"></span>
                  Bullish
                </span>
                <span className="flex items-center text-[#B71C1C] font-semibold">
                  <span className="inline-block w-2.5 h-2.5 bg-[#FFEBEE] border border-[#B71C1C] mr-1"></span>
                  Bearish
                </span>
                <span className="flex items-center text-[#D97706] font-semibold">
                  <span className="inline-block w-3 h-0.5 bg-[#D97706] border-b border-dashed border-[#D97706] mr-1"></span>
                  Proyeksi
                </span>
              </>
            )}
          </div>
        </div>

        {/* Controls: Chart Type Toggle (Line Chart / Candlestick Chart) + Timeframe */}
        <div className="flex items-center space-x-2">
          {/* Toggle Line Chart vs Candlestick Chart */}
          <div className="flex border border-[#121316] p-0.5 bg-[#FAF9F6]">
            <button
              onClick={() => setChartType("line")}
              className={`px-2 py-0.5 text-[10px] font-sans font-bold transition ${
                chartType === "line" ? "bg-[#121316] text-white" : "text-[#737168] hover:text-[#121316]"
              }`}
            >
              Line Chart
            </button>
            <button
              onClick={() => setChartType("candle")}
              className={`px-2 py-0.5 text-[10px] font-sans font-bold transition ${
                chartType === "candle" ? "bg-[#121316] text-white" : "text-[#737168] hover:text-[#121316]"
              }`}
            >
              Candlestick Chart
            </button>
          </div>

          {/* Filter Timeframe */}
          <div className="flex space-x-1 border border-[#121316] p-0.5 bg-[#FAF9F6]">
            {[
              { id: "1B", label: "1 Bln" },
              { id: "3B", label: "3 Bln" },
              { id: "6B", label: "6 Bln" },
            ].map((tf) => (
              <button
                key={tf.id}
                onClick={() => setTimeframe(tf.id)}
                className={`px-2 py-0.5 text-[10px] font-mono font-bold transition ${
                  timeframe === tf.id ? "bg-[#121316] text-white" : "text-[#737168] hover:text-[#121316]"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart Canvas Area */}
      {chartType === "candle" ? (
        <CandlestickCanvas
          data={chartData}
          minPrice={minPrice}
          maxPrice={maxPrice}
          height={220}
        />
      ) : (
        <div className="h-56 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 12, right: 16, left: -10, bottom: 2 }}
            >
              <CartesianGrid stroke="#E5E3DC" strokeDasharray="2 2" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#737168"
                fontSize={9}
                tickLine={true}
                axisLine={{ stroke: "#DCDAD4" }}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#737168"
                fontSize={9}
                width={48}
                domain={[minPrice, maxPrice]}
                tickLine={true}
                axisLine={{ stroke: "#DCDAD4" }}
                tickFormatter={(v) => `${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const price = data.realPrice != null ? data.realPrice : data.projectedPrice;
                    return (
                      <div className="bg-white border border-[#121316] p-2 text-xs shadow-lg">
                        <p className={`text-[10px] font-mono ${data.isProjected ? "text-[#D97706] font-bold" : "text-[#737168]"}`}>
                          {data.isProjected ? "[PROYEKSI 20 HARI]" : "[HARGA RIIL BURSA]"}: {data.date}
                        </p>
                        <p className="font-mono-num font-bold text-sm text-[#121316] mt-0.5">
                          {formatRupiah(price)}
                        </p>
                        {!data.isProjected && data.high && data.low && (
                          <p className="text-[9px] text-[#737168] font-mono mt-0.5">
                            Rentang: {formatRupiah(data.low)} - {formatRupiah(data.high)}
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="realPrice"
                stroke="#121316"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="projectedPrice"
                stroke="#D97706"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
