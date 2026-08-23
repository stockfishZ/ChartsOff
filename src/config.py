import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

class AppConfig(BaseModel):
    # Top Liquid & Popular Stocks on Bibit (IDX / BEI)
    DEFAULT_TICKERS: list[str] = [
        # Banking & Finance
        "BBCA.JK", "BBRI.JK", "BMRI.JK", "BBNI.JK", "BRIS.JK", "BBTN.JK", "ARTO.JK", "BDMN.JK",
        # Telecommunications & Tech
        "TLKM.JK", "ISAT.JK", "EXCL.JK", "GOTO.JK", "BUKA.JK", "EMTK.JK",
        # Mining, Metals & Energy
        "ADRO.JK", "PTBA.JK", "ITMG.JK", "ANTM.JK", "INCO.JK", "MDKA.JK", "AMMN.JK", "MEDC.JK", "PGAS.JK", "AKRA.JK", "BUMI.JK", "BRPT.JK", "TPIA.JK",
        # Consumer, Healthcare & Retail
        "ICBP.JK", "INDF.JK", "UNVR.JK", "MYOR.JK", "KLBF.JK", "SIDO.JK", "AMRT.JK", "MAPI.JK", "ACES.JK", "CPIN.JK", "JPFA.JK", "GGRM.JK", "HMSP.JK",
        # Auto, Heavy Equipment & Cement
        "ASII.JK", "UNTR.JK", "AUTO.JK", "SMGR.JK", "INTP.JK",
        # Property & Infrastructure
        "CTRA.JK", "BSDE.JK", "PWON.JK", "SMRA.JK", "JSMR.JK"
    ]
    
    HISTORICAL_DAYS: int = 365
    NEWS_LOOKBACK_DAYS: int = 7
    PREDICTION_HORIZON_DAYS: int = 5
    
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    LOCAL_OUTPUT_DIR: Path = BASE_DIR / "outputs"
    
    USE_SUPABASE: bool = bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_KEY"))
    SAVE_LOCAL_JSON: bool = True

config = AppConfig()
config.LOCAL_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
