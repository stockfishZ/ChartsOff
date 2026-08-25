import logging
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

class InstitutionalFlowEngine:
    """
    Menghitung metrik arus dana institusi / asing / bandarmology kuantitatif
    (Chaikin Money Flow, Money Flow Index, Volume-Price Trend, Smart Money Pressure)
    untuk mendeteksi akumulasi atau distribusi institusi besar di BEI.
    """

    @staticmethod
    def compute_flow_indicators(df: pd.DataFrame) -> pd.DataFrame:
        """
        Menghitung indikator aliran dana pada dataframe OHLCV.
        """
        if df.empty or len(df) < 20:
            return df

        res = df.copy()
        high = res["High"]
        low = res["Low"]
        close = res["Close"]
        volume = res["Volume"]

        # 1. Chaikin Money Flow (CMF 20)
        # Money Flow Multiplier = ((Close - Low) - (High - Close)) / (High - Low)
        hl_diff = high - low
        hl_diff = hl_diff.replace(0, 1e-9)
        mf_multiplier = ((close - low) - (high - close)) / hl_diff
        mf_volume = mf_multiplier * volume
        res["cmf_20"] = mf_volume.rolling(window=20, min_periods=5).sum() / (
            volume.rolling(window=20, min_periods=5).sum() + 1e-9
        )

        # 2. Money Flow Index (MFI 14) - Volume-Weighted RSI
        typical_price = (high + low + close) / 3
        raw_money_flow = typical_price * volume
        tp_diff = typical_price.diff()

        pos_flow = raw_money_flow.where(tp_diff > 0, 0).rolling(window=14, min_periods=5).sum()
        neg_flow = raw_money_flow.where(tp_diff < 0, 0).rolling(window=14, min_periods=5).sum()
        mfi_ratio = pos_flow / (neg_flow + 1e-9)
        res["mfi_14"] = 100 - (100 / (1 + mfi_ratio))

        # 3. Volume Price Trend (VPT) & Momentum
        pct_change = close.pct_change().fillna(0)
        res["vpt"] = (volume * pct_change).cumsum()
        res["vpt_ma_14"] = res["vpt"].rolling(window=14, min_periods=5).mean()
        res["vpt_momentum"] = res["vpt"] - res["vpt_ma_14"]

        # 4. Smart Money Flow Index (0 - 100)
        # Normalized composite score: CMF (+0.25 to -0.25) + MFI (0-100)
        cmf_score = ((res["cmf_20"].clip(-0.3, 0.3) + 0.3) / 0.6) * 50
        mfi_score = (res["mfi_14"].clip(10, 90) / 90) * 50
        res["smart_money_flow_score"] = (cmf_score + mfi_score).clip(5, 95)

        # Clean NaNs
        res.bfill(inplace=True)
        res.ffill(inplace=True)
        return res

    @staticmethod
    def get_latest_flow_summary(df_with_flows: pd.DataFrame) -> dict:
        """
        Mengembalikan ringkasan status arus dana institusi terkini.
        """
        if df_with_flows.empty or "smart_money_flow_score" not in df_with_flows.columns:
            return {
                "flow_score": 50.0,
                "flow_status": "Arus Netral",
                "cmf_20": 0.0,
                "mfi_14": 50.0,
                "is_accumulating": False
            }

        last_row = df_with_flows.iloc[-1]
        cmf = float(last_row.get("cmf_20", 0.0))
        mfi = float(last_row.get("mfi_14", 50.0))
        score = round(float(last_row.get("smart_money_flow_score", 50.0)), 1)

        if cmf > 0.08 and mfi > 55:
            flow_status = "Akumulasi Institusi Kuat"
            is_accumulating = True
            color = "#1B5E20"
        elif cmf > 0.02 or mfi > 50:
            flow_status = "Akumulasi Moderat"
            is_accumulating = True
            color = "#1B5E20"
        elif cmf < -0.08 and mfi < 45:
            flow_status = "Distribusi Institusi (Tekanan Jual)"
            is_accumulating = False
            color = "#B71C1C"
        else:
            flow_status = "Arus Transaksi Normal"
            is_accumulating = False
            color = "#595750"

        return {
            "flow_score": score,
            "flow_status": flow_status,
            "color": color,
            "cmf_20": round(cmf, 3),
            "mfi_14": round(mfi, 1),
            "is_accumulating": is_accumulating
        }
