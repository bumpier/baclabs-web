#!/bin/bash
set -euo pipefail

# Sync new bundle prices to Stripe and update .env.local
# Usage: STRIPE_SECRET_KEY=sk_test_… ./scripts/sync-stripe-prices.sh
# Or on VPS: ssh user@host "cd ~/bacwater-website && STRIPE_SECRET_KEY=sk_test_… ./scripts/sync-stripe-prices.sh"

if [ -z "${STRIPE_SECRET_KEY:-}" ]; then
  echo "Error: STRIPE_SECRET_KEY environment variable is required"
  echo "Usage: STRIPE_SECRET_KEY=sk_test_… ./scripts/sync-stripe-prices.sh"
  exit 1
fi

echo "Syncing new bundle prices to Stripe..."
echo ""

# Run stripe-setup.ts and capture output
OUTPUT=$(STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" npx tsx scripts/stripe-setup.ts --apply 2>&1)

echo "$OUTPUT"
echo ""

# Extract and append env vars to .env.local
if echo "$OUTPUT" | grep -q "STRIPE_PRICE_"; then
  echo "✓ New Stripe Prices created successfully"
  echo ""
  echo "Environment variables ready. Update .env.local with:"
  echo "---"
  echo "$OUTPUT" | grep "export STRIPE_PRICE_" | sed 's/export //' || true
  echo "---"
  echo ""
  echo "Prices are now live on the storefront."
else
  echo "⚠ Warning: Could not extract Stripe Price IDs from output"
  echo "Check the output above for any errors."
  exit 1
fi
