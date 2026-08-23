import React, { useState, useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { formatRupiah } from "./TickerList";

export default function StockChart({ prediction }) {
  const [timeframe, setTimeframe] = useState("3B");

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
          realPrice: Math.round(bar.close),
          projectedPrice: isLastBar ? Math.round(bar.close) : null,
          high: bar.high ? Math.round(bar.high) : Math.round(bar.close),
          low: bar.low ? Math.round(bar.low) : Math.round(bar.close),
          isProjected: false
        });
      });
    } else {
      const d = new Date();
      points.push({
        date: d.toLocaleDateString("id-ID", { month: "short", day: "numeric" }),
        realPrice: Math.round(basePrice),
        projectedPrice: Math.round(basePrice),
        isProjected: false
      });
    }

    // 20 Hari Proyeksi Masa Depan (Garis Oranye Halus)
    const lastRealPrice = points.length > 0 ? (points[points.length - 1].realPrice || basePrice) : basePrice;
    const targetPrice = basePrice * (1 + (prediction.expected_return_pct / 100));
    const horizon = prediction.target_horizon_days || 20;

    for (let d = 2; d <= horizon; d += 2) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + d);
      const dayStr = futureDate.toLocaleDateString("id-ID", { month: "short", day: "numeric" });
      const interpolated = lastRealPrice + ((targetPrice - lastRealPrice) * (d / horizon));

      points.push({
        date: `${dayStr} (P)`,
        realPrice: null,
        projectedPrice: Math.round(interpolated),
        isProjected: true
      });
    }

    return points;
  }, [prediction, timeframe]);

  if (!prediction) return null;

  const allPrices = chartData
    .map((d) => (d.realPrice != null ? d.realPrice : d.projectedPrice))
    .filter((p) => p != null);

  const minPrice = allPrices.length > 0 ? Math.floor(Math.min(...allPrices) * 0.98) : "auto";
  const maxPrice = allPrices.length > 0 ? Math.ceil(Math.max(...allPrices) * 1.02) : "auto";

  return (
    <div className="bg-white border border-[#121316] p-4 mb-3">
      {/* Header Grafik & Legenda Garis */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <span className="font-mono text-xs font-bold uppercase text-[#121316] block">
            Pergerakan Harga & Proyeksi 20 Hari
          </span>
          <div className="flex items-center space-x-3 mt-1 text-[10px] font-mono">
            <span className="flex items-center text-[#121316]">
              <span className="inline-block w-3 h-0.5 bg-[#121316] mr-1.5"></span>
              Harga Riil (BEI)
            </span>
            <span className="flex items-center text-[#D97706] font-semibold">
              <span className="inline-block w-3 h-0.5 bg-[#D97706] mr-1.5"></span>
              Proyeksi Model 20 Hari
            </span>
          </div>
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

      <div className="h-52 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: 10, bottom: 0 }}>
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
              domain={[minPrice, maxPrice]}
              tickLine={true}
              axisLine={{ stroke: "#DCDAD4" }}
              tickFormatter={(v) => `Rp ${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`}
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
                          Rentang Harian: {formatRupiah(data.low)} - {formatRupiah(data.high)}
                        </p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            {/* Garis 1: Harga Riil (Solid Hitam) */}
            <Line
              type="monotone"
              dataKey="realPrice"
              stroke="#121316"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            {/* Garis 2: Proyeksi 20 Hari (Solid Oranye Bersih) */}
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
    </div>
  );
}
