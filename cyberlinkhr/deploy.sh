#!/usr/bin/env bash
# CyberlinkHR — Production Deployment Script
# Run on Hetzner VPS as a user with Docker access.
# Usage: ./deploy.sh [--build]

set -euo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml"

# ── Preflight checks ─────────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  echo "ERROR: .env not found. Copy .env.production.example to .env and fill in values."
  exit 1
fi

# ── Generate RSA keys if missing ─────────────────────────────────────────────
if [ ! -f "keys/private.pem" ] || [ ! -f "keys/public.pem" ]; then
  echo "Generating RSA key pair..."
  mkdir -p keys
  openssl genrsa -out keys/private.pem 2048
  openssl rsa -in keys/private.pem -pubout -out keys/public.pem
  chmod 600 keys/private.pem
  echo "Keys generated at keys/private.pem and keys/public.pem"
fi

# ── Create backups directory ──────────────────────────────────────────────────
mkdir -p backups

# ── Pull latest code ─────────────────────────────────────────────────────────
echo "Pulling latest code..."
git pull --ff-only

# ── Build and restart services ────────────────────────────────────────────────
echo "Building Docker images..."
$COMPOSE build --no-cache

echo "Starting services..."
$COMPOSE up -d

echo ""
echo "✓ Deployment complete."
echo ""

# Show status
$COMPOSE ps
