"""
SpendAchu OCR Receipt Processing Service (Tesseract)
=====================================================
A self-hosted FastAPI service that uses Tesseract OCR to extract receipt
details from uploaded images. Lightweight (~50MB RAM), works on Render free tier.

Architecture:
  React Frontend → Node.js Backend → This FastAPI Service → Structured JSON
"""

import os
import io
import logging
import time
import traceback

from fastapi import FastAPI, File, UploadFile, Header, HTTPException
from fastapi.responses import JSONResponse
from PIL import Image, ImageFilter, ImageEnhance
import pytesseract

from receipt_parser import ReceiptParser

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("ocr-service")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
OCR_SERVICE_TOKEN = os.getenv("OCR_SERVICE_TOKEN", "spendachu-ocr-secret-2024")
HOST = os.getenv("OCR_HOST", "0.0.0.0")
PORT = int(os.getenv("OCR_PORT", "8100"))


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="SpendAchu OCR Service",
    description="Self-hosted receipt OCR processing for SpendAchu (Tesseract)",
    version="2.0.0",
)


# ---------------------------------------------------------------------------
# Auth helper
# ---------------------------------------------------------------------------
def verify_token(token):
    """Verify the x-ocr-token header."""
    if not token or token != OCR_SERVICE_TOKEN:
        logger.warning("🚫 Unauthorized OCR request")
        raise HTTPException(status_code=401, detail="Unauthorized: invalid or missing x-ocr-token")


# ---------------------------------------------------------------------------
# Image preprocessing for better OCR accuracy
# ---------------------------------------------------------------------------
def preprocess_image(image: Image.Image) -> Image.Image:
    """
    Enhance receipt image for better Tesseract OCR accuracy:
    - Convert to grayscale
    - Increase contrast
    - Sharpen edges
    - Resize to optimal OCR resolution
    """
    # Convert to grayscale
    img = image.convert("L")

    # Resize to improve OCR (receipts are often small/low-res)
    w, h = img.size
    scale = max(1.0, 1800 / max(w, h))
    if scale > 1.0:
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    # Enhance contrast
    img = ImageEnhance.Contrast(img).enhance(2.0)

    # Sharpen
    img = img.filter(ImageFilter.SHARPEN)

    return img


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        version = pytesseract.get_tesseract_version()
        return {"status": "healthy", "engine": "Tesseract", "version": str(version), "ready": True}
    except Exception as e:
        return {"status": "degraded", "engine": "Tesseract", "error": str(e), "ready": False}


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

    allowed_types = {"image/jpeg", "image/png", "image/jpg", "image/webp"}
    if file.content_type and file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Use JPEG or PNG.",
        )

    raw_bytes = None
    try:
        raw_bytes = await file.read()
        if len(raw_bytes) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        logger.info(f"📷 Processing receipt ({len(raw_bytes)} bytes)")

        # Open and preprocess
        image = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
        processed = preprocess_image(image)

        # Run Tesseract OCR
        start = time.time()
        raw_text = pytesseract.image_to_string(
            processed,
            config="--psm 6 --oem 3"   # PSM 6 = assume a uniform block of text
        )
        elapsed = round(time.time() - start, 2)

        logger.info(f"🔍 OCR completed in {elapsed}s")
        logger.debug(f"Raw OCR text:\n{raw_text[:500]}")

        if not raw_text.strip():
            logger.warning("⚠️ No text detected in receipt image")
            return JSONResponse(content=_empty_result())

        # Convert raw text to line dicts with confidence=1.0 (Tesseract gives plain text)
        lines = []
        for line in raw_text.splitlines():
            line = line.strip()
            if line:
                lines.append({"text": line, "confidence": 1.0})

        logger.info(f"📝 {len(lines)} text lines extracted")

        # Parse structured data
        parser = ReceiptParser()
        parsed = parser.parse(lines)

        logger.info(
            f"✅ Parsed: merchant={parsed.get('merchant')}, "
            f"amount={parsed.get('amount')}, date={parsed.get('date')}"
        )

        return JSONResponse(content=parsed)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Processing failed: {e}")
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
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=False, log_level="info")
