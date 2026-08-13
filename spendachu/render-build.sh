#!/usr/bin/env bash
# Render Build Script
# This script runs during Render's build phase to prepare both frontend and backend

set -e

echo "==> Installing frontend dependencies..."
npm install

echo "==> Building frontend (Vite)..."
npm run build

echo "==> Installing backend dependencies..."
cd server
npm install

echo "==> Build complete!"
