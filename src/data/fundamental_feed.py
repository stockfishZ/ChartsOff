import logging
import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import yfinance as yf

logger = logging.getLogger(__name__)

CACHE_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "outputs", "fundamentals_cache.json")

class FundamentalDataFeed:
    """
    Mengambil data fundamental keuangan emiten (PER, PBV, ROE, DER, Margin Laba,
    Dividen Yield, EPS Growth) dari yfinance dengan sistem caching otomatis.
    """
    def __init__(self, cache_file: str = CACHE_FILE_PATH, max_cache_days: int = 7):
        self.cache_file = cache_file
        self.max_cache_days = max_cache_days
        self._cache = self._load_cache()

    def _load_cache(self) -> Dict[str, Any]:
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load fundamentals cache: {e}")
        return {}

    def _save_cache(self):
        try:
            os.makedirs(os.path.dirname(self.cache_file), exist_ok=True)
            with open(self.cache_file, "w", encoding="utf-8") as f:
                json.dump(self._cache, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"Failed to save fundamentals cache: {e}")

    def fetch_fundamentals(self, ticker: str, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Mengambil rasio fundamental keuangan terkini untuk ticker tertentu.
        """
        clean_ticker = ticker.upper().strip()
        if not clean_ticker.endswith(".JK"):
            clean_ticker += ".JK"

        now = datetime.now()
        
        # Check cache validity
        if not force_refresh and clean_ticker in self._cache:
            entry = self._cache[clean_ticker]
            cached_time_str = entry.get("cached_at")
            if cached_time_str:
                try:
                    cached_time = datetime.fromisoformat(cached_time_str)
                    if (now - cached_time).days < self.max_cache_days:
                        return entry.get("data", {})
                except Exception:
                    pass

        try:
            logger.info(f"Ingesting quarterly fundamentals for {clean_ticker}")
            t = yf.Ticker(clean_ticker)
            info = t.info or {}

            # Helper for clean floating values
            def clean_float(v, default=0.0):
                if v is None:
                    return default
                try:
                    val = float(v)
                    return val if not (val != val or val == float('inf') or val == float('-inf')) else default
                except (ValueError, TypeError):
                    return default

            # Trailing P/E
            trailing_pe = clean_float(info.get("trailingPE") or info.get("forwardPE"), 12.0)
            # Price to Book
            pbv = clean_float(info.get("priceToBook"), 1.5)
            # Return on Equity (multiply by 100 if decimal)
            raw_roe = clean_float(info.get("returnOnEquity"), 0.12)
            roe_pct = raw_roe * 100 if abs(raw_roe) < 1.0 else raw_roe
            # Debt to Equity (yfinance often gives DER as percentage like 41.1 or decimal like 0.41)
            raw_der = info.get("debtToEquity")
            if raw_der is not None:
                der_val = clean_float(raw_der, 50.0)
                der_ratio = der_val / 100 if der_val > 5.0 else der_val
            else:
                der_ratio = 0.5  # Neutral default for financial institutions
            # Profit Margin
            raw_margin = clean_float(info.get("profitMargins") or info.get("operatingMargins"), 0.15)
            profit_margin_pct = raw_margin * 100 if abs(raw_margin) < 1.0 else raw_margin
            # Dividend Yield
            raw_div = clean_float(info.get("dividendYield"), 0.0)
            dividend_yield_pct = raw_div * 100 if 0 < raw_div < 1.0 else raw_div
            # EPS Growth YoY
            eps_growth_pct = clean_float(info.get("earningsQuarterlyGrowth") or info.get("revenueGrowth"), 0.05) * 100

            # Calculate Comprehensive Fundamental Health Score (0 - 100)
            health_score = 50.0
            reasons = []

            # 1. Profitability Factor (ROE & Margin)
            if roe_pct >= 15.0:
                health_score += 18.0
                reasons.append(f"ROE sangat prima ({roe_pct:.1f}%)")
            elif roe_pct >= 8.0:
                health_score += 10.0
            elif roe_pct < 0:
                health_score -= 20.0
                reasons.append("Kinerja merugi (ROE Negatif)")

            # 2. Solvency & Debt Risk (DER)
            if der_ratio <= 0.8:
                health_score += 15.0
                reasons.append(f"Beban utang rendah & sehat (DER {der_ratio:.2f}x)")
            elif der_ratio > 2.5:
                health_score -= 18.0
                reasons.append(f"Beban utang tinggi (DER {der_ratio:.2f}x)")

            # 3. Valuation (PER & PBV)
            if 0 < trailing_pe < 12.0 and pbv < 2.0:
                health_score += 12.0
                reasons.append("Valuasi menarik (Undervalued)")
            elif trailing_pe > 35.0:
                health_score -= 8.0
                reasons.append("Valuasi tergolong mahal (PER tinggi)")

            # 4. Dividend Payout
            if dividend_yield_pct >= 4.0:
                health_score += 5.0
                reasons.append(f"Dividen yield menarik ({dividend_yield_pct:.1f}%)")

            health_score = max(5.0, min(99.0, round(health_score, 1)))

            # Grade categorization
            if health_score >= 80:
                grade = "A+ (Sangat Sehat)"
                status_color = "#1B5E20"
            elif health_score >= 68:
                grade = "A (Sehat & Efisien)"
                status_color = "#1B5E20"
            elif health_score >= 52:
                grade = "B (Moderat)"
                status_color = "#595750"
            elif health_score >= 38:
                grade = "C (Spekulatif)"
                status_color = "#D97706"
            else:
                grade = "D (Tinggi Risiko Beban Utang)"
                status_color = "#B71C1C"

            fundamental_data = {
                "ticker": clean_ticker,
                "pe_ratio": round(trailing_pe, 2),
                "pbv_ratio": round(pbv, 2),
                "roe_pct": round(roe_pct, 2),
                "der_ratio": round(der_ratio, 2),
                "profit_margin_pct": round(profit_margin_pct, 2),
                "dividend_yield_pct": round(dividend_yield_pct, 2),
                "eps_growth_pct": round(eps_growth_pct, 2),
                "health_score": health_score,
                "grade": grade,
                "status_color": status_color,
                "highlight_reason": reasons[0] if reasons else "Kondisi fundamental stabil"
            }

            # Update memory and disk cache
            self._cache[clean_ticker] = {
                "cached_at": now.isoformat(),
                "data": fundamental_data
            }
            self._save_cache()

            return fundamental_data

        except Exception as e:
            logger.error(f"Error fetching fundamentals for {clean_ticker}: {e}")
            return {
                "ticker": clean_ticker,
                "pe_ratio": 12.0,
                "pbv_ratio": 1.5,
                "roe_pct": 12.0,
                "der_ratio": 0.6,
                "profit_margin_pct": 15.0,
                "dividend_yield_pct": 0.0,
                "eps_growth_pct": 5.0,
                "health_score": 50.0,
                "grade": "B (Moderat)",
                "status_color": "#595750",
                "highlight_reason": "Data fundamental dasar BEI"
            }
