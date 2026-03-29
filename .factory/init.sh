#!/bin/bash
set -e

# Cuqui mission init - idempotent
echo "Initializing Cuqui environment..."

# Install dependencies if needed
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Verify critical dependencies
echo "Verifying dependencies..."
node -e "require('next'); require('convex'); require('@clerk/nextjs');" 2>/dev/null || {
  echo "Installing missing dependencies..."
  npm install
}

echo "Init complete."
