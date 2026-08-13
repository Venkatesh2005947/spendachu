# SpendAchu OCR Service — Dockerfile (Tesseract)
FROM python:3.11-slim

# Install Tesseract OCR + English language data
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY receipt_parser.py .

EXPOSE 8100

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD python -c "import os, urllib.request; port = os.getenv('PORT', '8100'); urllib.request.urlopen(f'http://localhost:{port}/health')" || exit 1

CMD sh -c "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8100}"
