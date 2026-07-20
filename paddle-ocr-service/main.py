"""
SpendAchu PaddleOCR Receipt Processing Service
================================================
A self-hosted FastAPI service that uses PaddleOCR to extract receipt details
from uploaded images. Replaces Gemini Vision API for privacy and cost savings.
"""

import os
import io
import logging
import time
import traceback

from fastapi import FastAPI, File, UploadFile, Header, HTTPException
from fastapi.responses import JSONResponse
from PIL import Image
import numpy as np

from receipt_parser import ReceiptParser

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("paddle-ocr-service")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
OCR_SERVICE_TOKEN = os.getenv("OCR_SERVICE_TOKEN", "spendachu-ocr-secret-2024")
HOST = os.getenv("OCR_HOST", "0.0.0.0")
PORT = int(os.getenv("OCR_PORT", "8100"))

# ---------------------------------------------------------------------------
# PaddleOCR Singleton — lazy initialized on first request
# ---------------------------------------------------------------------------
ocr_engine = None
ocr_init_error = None


def get_ocr_engine():
    """
    Lazy-load PaddleOCR on first use.
    Returns the engine or raises HTTPException if init failed.
    """
    global ocr_engine, ocr_init_error

    # Already initialized successfully
    if ocr_engine is not None:
        return ocr_engine

    # Previously failed — don't retry on every request
    if ocr_init_error is not None:
        raise HTTPException(
            status_code=503,
            detail=f"OCR engine failed to initialize: {ocr_init_error}"
        )

    # First call — attempt initialization
    logger.info("🚀 Initializing PaddleOCR engine (first request)...")
    start = time.time()
    try:
        from paddleocr import PaddleOCR
        # Use minimal safe parameters compatible with PaddleOCR 3.x
        ocr_engine = PaddleOCR(lang="en")
        elapsed = round(time.time() - start, 2)
        logger.info(f"✅ PaddleOCR engine ready in {elapsed}s")
        return ocr_engine
    except Exception as e:
        ocr_init_error = str(e)
        logger.error(f"❌ PaddleOCR init failed: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=503,
            detail=f"OCR engine failed to initialize: {e}"
        )


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="SpendAchu PaddleOCR Service",
    description="Self-hosted receipt OCR processing for SpendAchu",
    version="1.0.0",
)


# ---------------------------------------------------------------------------
# Auth middleware helper
# ---------------------------------------------------------------------------
def verify_token(token):
    """Verify the x-ocr-token header matches the expected service token."""
    if not token or token != OCR_SERVICE_TOKEN:
        logger.warning("🚫 Unauthorized OCR request (bad or missing x-ocr-token)")
        raise HTTPException(status_code=401, detail="Unauthorized: invalid or missing x-ocr-token")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def health_check():
    """Health check endpoint — does NOT trigger OCR init."""
    return {
        "status": "healthy",
        "engine": "PaddleOCR",
        "ready": ocr_engine is not None,
        "init_error": ocr_init_error,
    }


@app.post("/process-receipt")
async def process_receipt(
    file: UploadFile = File(..., description="Receipt image (JPEG/PNG)"),
    x_ocr_token: str = Header(None, alias="x-ocr-token"),
):
    """
    Process a receipt image and return structured expense data.

    Accepts: multipart/form-data with a single file field
    Returns: JSON matching the SpendAchu ReceiptPreview expected format
    """
    verify_token(x_ocr_token)

    # Validate file type
    allowed_types = {"image/jpeg", "image/png", "image/jpg", "image/webp"}
    if file.content_type and file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Use JPEG, PNG, or WebP.",
        )

    raw_bytes = None
    try:
        # Get OCR engine (lazy init)
        engine = get_ocr_engine()

        # Read and convert image
        raw_bytes = await file.read()
        if len(raw_bytes) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        logger.info(f"📷 Processing receipt image ({len(raw_bytes)} bytes, type={file.content_type})")

        image = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
        img_array = np.array(image)

        # Run OCR
        start = time.time()
        ocr_result = engine.ocr(img_array, cls=True)
        ocr_elapsed = round(time.time() - start, 2)

        # Extract text lines with confidence scores
        lines = []
        if ocr_result and ocr_result[0]:
            for entry in ocr_result[0]:
                try:
                    text = entry[1][0]
                    conf = round(float(entry[1][1]), 3)
                    lines.append({"text": text, "confidence": conf})
                except (IndexError, TypeError, ValueError):
                    continue

        logger.info(f"🔍 OCR completed in {ocr_elapsed}s — {len(lines)} text lines detected")

        if not lines:
            logger.warning("⚠️ No text detected in receipt image")
            return JSONResponse(content=_empty_result())

        # Parse structured data from OCR lines
        parser = ReceiptParser()
        parsed = parser.parse(lines)

        logger.info(
            f"✅ Receipt parsed: merchant={parsed.get('merchant')}, "
            f"amount={parsed.get('amount')}, date={parsed.get('date')}"
        )

        return JSONResponse(content=parsed)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Receipt processing failed: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail="Receipt processing failed. Please try again with a clearer image.",
        )
    finally:
        raw_bytes = None


def _empty_result():
    return {
        "merchant": None,
        "date": None,
        "time": None,
        "amount": None,
        "tax": None,
        "category": "Others",
        "paymentMethod": "Cash",
        "notes": None,
        "confidence": {
            "merchant": False,
            "date": False,
            "time": False,
            "amount": False,
            "tax": False,
            "category": False,
            "paymentMethod": False,
        },
    }


# ---------------------------------------------------------------------------
# Run with Uvicorn when executed directly
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=False, log_level="info")
