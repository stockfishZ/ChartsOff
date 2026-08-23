import json
import logging
from pathlib import Path
from src.config import config
from src.ml.base import PredictionResult

logger = logging.getLogger(__name__)

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

    def save_predictions(self, predictions: list[PredictionResult]) -> dict:
        """
        Saves a batch of stock predictions to cloud storage and/or local disk.
        """
        results_dict = [p.model_dump() for p in predictions]
        
        # 1. Local JSON Output (Always available & 100% free)
        if config.SAVE_LOCAL_JSON:
            output_file = config.LOCAL_OUTPUT_DIR / "latest_predictions.json"
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(results_dict, f, indent=2)
            logger.info(f"Saved {len(predictions)} predictions locally to {output_file}")

        # 2. Supabase Storage (If configured)
        if self.client:
            try:
                # Upsert records into 'stock_predictions' table
                response = self.client.table("stock_predictions").upsert(results_dict).execute()
                logger.info(f"Uploaded predictions to Supabase table 'stock_predictions'.")
                return {"status": "success", "supabase": True, "count": len(predictions)}
            except Exception as e:
                logger.error(f"Failed uploading to Supabase: {e}")
                return {"status": "partial_success", "supabase_error": str(e), "count": len(predictions)}

        return {"status": "success", "supabase": False, "count": len(predictions)}
