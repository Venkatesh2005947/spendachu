"""
SpendAchu PaddleOCR Receipt Processing Service
================================================
A self-hosted FastAPI service that uses PaddleOCR to extract receipt details
from uploaded images. Replaces Gemini Vision API for privacy and cost savings.

Architecture:
  React Frontend → Node.js Backend → This FastAPI Service → Structured JSON

The service:
  1. Receives receipt images via multipart/form-data
  2. Runs PaddleOCR text detection + recognition (initialized once at startup)
  3. Uses rule-based parsing to extract merchant, date, time, amount, tax, etc.
  4. Returns JSON in the exact format the SpendAchu frontend expects
"""

import os
import io
import logging
import time

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
# PaddleOCR Singleton — initialized once at startup
# ---------------------------------------------------------------------------
ocr_engine = None


def init_ocr():
    """Initialize PaddleOCR engine once. Called on startup."""
    global ocr_engine
    logger.info("🚀 Initializing PaddleOCR engine (this may take 30-60 seconds on first run)...")
    start = time.time()

    from paddleocr import PaddleOCR

    ocr_engine = PaddleOCR(
        use_angle_cls=True,    # Handle rotated text
        lang="en",             # English receipts
        use_gpu=False,         # CPU-only
        show_log=False,        # Suppress PaddleOCR internal logs
        det_db_score_mode="slow",  # Better accuracy for receipts
    )
    elapsed = round(time.time() - start, 2)
    logger.info(f"✅ PaddleOCR engine ready in {elapsed}s")


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="SpendAchu PaddleOCR Service",
    description="Self-hosted receipt OCR processing for SpendAchu",
    version="1.0.0",
)


@app.on_event("startup")
async def startup_event():
    """Load OCR model into memory once when the service starts."""
    init_ocr()


# ---------------------------------------------------------------------------
# Auth middleware helper
# ---------------------------------------------------------------------------
def verify_token(token: str | None):
    """Verify the x-ocr-token header matches the expected service token."""
    if not token or token != OCR_SERVICE_TOKEN:
        logger.warning("🚫 Unauthorized OCR request (bad or missing x-ocr-token)")
        raise HTTPException(status_code=401, detail="Unauthorized: invalid or missing x-ocr-token")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring and load balancer probes."""
    return {
        "status": "healthy",
        "engine": "PaddleOCR",
        "ready": ocr_engine is not None,
    }


@app.post("/process-receipt")
async def process_receipt(
    file: UploadFile = File(..., description="Receipt image (JPEG/PNG)"),
    x_ocr_token: str | None = Header(None, alias="x-ocr-token"),
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

    try:
        # Read and convert image
        raw_bytes = await file.read()
        if len(raw_bytes) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        logger.info(f"📷 Processing receipt image ({len(raw_bytes)} bytes, type={file.content_type})")

        image = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
        img_array = np.array(image)

        # Run OCR
        start = time.time()
        ocr_result = ocr_engine.ocr(img_array, cls=True)
        ocr_elapsed = round(time.time() - start, 2)

        # Extract text lines with confidence scores
        lines = []
        if ocr_result and ocr_result[0]:
            for entry in ocr_result[0]:
                text = entry[1][0]           # detected text
                conf = round(entry[1][1], 3) # confidence score 0-1
                lines.append({"text": text, "confidence": conf})

        logger.info(f"🔍 OCR completed in {ocr_elapsed}s — {len(lines)} text lines detected")

        if not lines:
            logger.warning("⚠️ No text detected in receipt image")
            return JSONResponse(content={
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
            })

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
        logger.error(f"❌ Receipt processing failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Receipt processing failed. Please try again with a clearer image.",
        )
    finally:
        # Never persist receipt images in memory
        raw_bytes = None


# ---------------------------------------------------------------------------
# Run with Uvicorn when executed directly
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=False, log_level="info")
