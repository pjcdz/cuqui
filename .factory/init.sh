#!/bin/bash
set -e

# Cuqui mission init - idempotent
echo "Initializing Cuqui environment..."

# Check if node_modules exists and has critical deps
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Verify critical dependencies exist
node -e "require('next'); require('convex'); require('@clerk/nextjs');" 2>/dev/null || {
  echo "Reinstalling missing dependencies..."
  npm install
}

# Verify ENCRYPTION_KEY env var exists (warn if missing)
if [ -f ".env.local" ]; then
  if ! grep -q "ENCRYPTION_KEY" .env.local 2>/dev/null; then
    echo "WARNING: ENCRYPTION_KEY not found in .env.local - encryption features will use passthrough mode"
  fi
else
  echo "WARNING: .env.local not found"
fi

echo "Init complete."
