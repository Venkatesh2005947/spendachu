#!/bin/bash
# Render build script for OCR service
# Installs Tesseract OCR system package + Python dependencies

set -e

echo "📦 Installing Tesseract OCR..."
apt-get update -qq && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng

echo "🐍 Upgrading pip..."
pip install --upgrade pip

echo "📚 Installing Python dependencies..."
pip install -r requirements.txt

echo "✅ Build complete"
