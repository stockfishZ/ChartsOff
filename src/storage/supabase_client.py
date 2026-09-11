import json
import logging
import math
from datetime import datetime, timezone, timedelta
from pathlib import Path
from src.config import config, BASE_DIR
from src.ml.base import PredictionResult

logger = logging.getLogger(__name__)

def sanitize_json_payload(obj):
    """Recursively converts NaN and Infinity floats to None to guarantee 100% JSON compliance."""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    elif isinstance(obj, dict):
        return {k: sanitize_json_payload(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_json_payload(v) for v in obj]
    return obj

class StorageManager:
    """
    Handles saving prediction payloads to Supabase (free cloud database) or local JSON artifacts.
    """

    def __init__(self):
        self.client = None
        if config.USE_SUPABASE:
            try:
                from supabase import create_client
                self.client = create_client(config.SUPABASE_URL, config.SUPABASE_KEY)
                logger.info("Supabase client initialized successfully.")
            except Exception as e:
                logger.warning(f"Could not connect to Supabase: {e}. Falling back to local storage.")

    def save_predictions(
        self,
        predictions: list[PredictionResult],
        is_incremental: bool = False,
        sync_to_frontend: bool = True,
        full_run: bool = False
    ) -> dict:
        """
        Saves a batch of stock predictions to cloud storage and/or local disk.
        Supports incremental updates (writes local JSON only, skipping frontend asset copies)
        and full pipeline runs with automated pruning of stale or failed predictions.
        """
        raw_results = [p.model_dump() for p in predictions]
        results_dict = sanitize_json_payload(raw_results)
        
        # 1. Local JSON Output (Always available & 100% free)
        if config.SAVE_LOCAL_JSON:
            output_file = config.LOCAL_OUTPUT_DIR / "latest_predictions.json"

            # Load existing predictions map by ticker to perform an UPSERT
            existing_map: dict[str, dict] = {}
            candidate_sources = [
                output_file,
                BASE_DIR / "frontend" / "public" / "data" / "latest_predictions.json",
                BASE_DIR / "frontend" / "dist" / "data" / "latest_predictions.json",
            ]
            for src in candidate_sources:
                if src.exists():
                    try:
                        with open(src, "r", encoding="utf-8") as f:
                            existing_list = json.load(f)
                            if isinstance(existing_list, list):
                                for item in existing_list:
                                    if isinstance(item, dict) and "ticker" in item:
                                        existing_map[item["ticker"]] = item
                                if existing_map:
                                    break
                    except Exception as e:
                        logger.warning(f"Could not read existing predictions from {src}: {e}")

            # Upsert incoming predictions into existing_map
            current_run_tickers = set()
            for item in results_dict:
                if isinstance(item, dict) and "ticker" in item:
                    ticker = item["ticker"]
                    existing_map[ticker] = item
                    current_run_tickers.add(ticker)

            # Prune obsolete / rogue test tickers on final full_run save
            if not is_incremental and full_run:
                default_tickers_set = set(config.DEFAULT_TICKERS)
                pruned_map: dict[str, dict] = {}

                for ticker, item in existing_map.items():
                    # Only retain configured default tickers in production full runs (purging ad-hoc test tickers like CUSTOM.JK)
                    if ticker not in default_tickers_set:
                        logger.info(f"Pruning non-default/test ticker '{ticker}' during full run.")
                        continue

                    pruned_map[ticker] = item

                existing_map = pruned_map

            final_list = list(existing_map.values()) if existing_map else results_dict

            output_file.parent.mkdir(parents=True, exist_ok=True)
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(final_list, f, indent=2)
            logger.info(f"Saved {len(final_list)} predictions locally to {output_file} (upserted {len(predictions)} items, is_incremental={is_incremental})")

            # Issue 2: Only sync to frontend public & dist assets on final save
            if not is_incremental and sync_to_frontend:
                target_frontend_paths = [
                    BASE_DIR / "frontend" / "public" / "data" / "latest_predictions.json",
                    BASE_DIR / "frontend" / "dist" / "data" / "latest_predictions.json",
                    BASE_DIR / "frontend" / "android" / "app" / "src" / "main" / "assets" / "public" / "data" / "latest_predictions.json",
                ]
                for frontend_path in target_frontend_paths:
                    try:
                        if "android" not in str(frontend_path):
                            frontend_path.parent.mkdir(parents=True, exist_ok=True)
                        if frontend_path.parent.exists():
                            with open(frontend_path, "w", encoding="utf-8") as f:
                                json.dump(final_list, f, indent=2)
                    except Exception as e:
                        logger.debug(f"Could not copy to {frontend_path}: {e}")

        # 2. Supabase Storage (If configured, execute on non-incremental sync)
        if not is_incremental and self.client:
            try:
                # Upsert records into 'stock_predictions' table
                response = self.client.table("stock_predictions").upsert(results_dict).execute()
                logger.info(f"Uploaded predictions to Supabase table 'stock_predictions'.")
                return {"status": "success", "supabase": True, "count": len(predictions)}
            except Exception as e:
                logger.error(f"Failed uploading to Supabase: {e}")
                return {"status": "partial_success", "supabase_error": str(e), "count": len(predictions)}

        return {"status": "success", "supabase": False, "count": len(predictions)}
