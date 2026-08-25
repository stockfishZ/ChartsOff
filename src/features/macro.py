import logging
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

class MacroFeatureEngine:
    """
    Menyelaraskan data saham dengan indikator makro ekonomi & harga komoditas
    (IHSG, Kurs USD/IDR, Emas, Minyak) dan menghitung beta serta korelasi pasar.
    """

    @staticmethod
    def align_and_compute_macro_features(
        stock_df: pd.DataFrame, macro_df: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Menggabungkan dataframe saham dengan benchmark makro dan menghitung fitur makro.
        """
        if stock_df.empty:
            return stock_df

        res = stock_df.copy()
        
        # Format timestamp as YYYY-MM-DD string for safe merging
        def format_date(s):
            try:
                return pd.to_datetime(s).dt.strftime("%Y-%m-%d")
            except Exception:
                return s

        res["date_key"] = format_date(res["timestamp"])
        
        if macro_df.empty or len(macro_df) < 5:
            # Fallback columns if macro feed is unavailable
            res["ihsg_roc_5"] = 0.0
            res["usdidr_roc_5"] = 0.0
            res["gold_roc_5"] = 0.0
            res["oil_roc_5"] = 0.0
            res["beta_ihsg_30"] = 1.0
            res.drop(columns=["date_key"], errors="ignore", inplace=True)
            return res

        m_copy = macro_df.copy()
        m_copy["date_key"] = format_date(m_copy["timestamp"])
        
        # Calculate macro ROCs
        for col in ["ihsg", "usdidr", "gold", "oil"]:
            if col in m_copy.columns:
                m_copy[f"{col}_roc_5"] = m_copy[col].pct_change(5).fillna(0) * 100
            else:
                m_copy[f"{col}_roc_5"] = 0.0

        macro_cols = ["date_key", "ihsg_roc_5", "usdidr_roc_5", "gold_roc_5", "oil_roc_5"]
        merged = pd.merge(res, m_copy[macro_cols], on="date_key", how="left")
        
        # Forward/backward fill missing weekend differences
        for col in ["ihsg_roc_5", "usdidr_roc_5", "gold_roc_5", "oil_roc_5"]:
            merged[col] = merged[col].ffill().bfill().fillna(0.0)

        # Dynamic Beta to IHSG (30-day rolling covariance / variance)
        try:
            stock_ret = merged["Close"].pct_change().fillna(0)
            # If IHSG price is available in macro_df
            if "ihsg" in m_copy.columns:
                m_ihsg = pd.merge(merged[["date_key"]], m_copy[["date_key", "ihsg"]], on="date_key", how="left")["ihsg"].ffill().bfill()
                ihsg_ret = m_ihsg.pct_change().fillna(0)
                rolling_cov = stock_ret.rolling(30, min_periods=10).cov(ihsg_ret)
                rolling_var = ihsg_ret.rolling(30, min_periods=10).var() + 1e-9
                merged["beta_ihsg_30"] = (rolling_cov / rolling_var).clip(-2.0, 4.0).fillna(1.0)
            else:
                merged["beta_ihsg_30"] = 1.0
        except Exception:
            merged["beta_ihsg_30"] = 1.0

        merged.drop(columns=["date_key"], errors="ignore", inplace=True)
        return merged
