#!/bin/bash

# Sui Flash Loan DApp - Testnet Deployment Script
# This script deploys the flash loan contracts to Sui testnet

set -e

echo "🚀 Starting Sui Flash Loan DApp Testnet Deployment"
echo "=================================================="

# Check if Sui CLI is installed
if ! command -v sui &> /dev/null; then
    echo "❌ Sui CLI not found. Installing..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
    cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui
fi

echo "✅ Sui CLI found"

# Switch to testnet
echo "🔄 Switching to Sui testnet..."
sui client switch --env testnet

# Get active address
ACTIVE_ADDRESS=$(sui client active-address)
echo "📍 Active address: $ACTIVE_ADDRESS"

# Check balance
echo "💰 Checking SUI balance..."
sui client gas

# Navigate to contracts directory
cd contracts

# Build contracts
echo "🔨 Building Move contracts..."
sui move build

# Run tests
echo "🧪 Running Move tests..."
sui move test

# Deploy contracts
echo "📦 Deploying contracts to testnet..."
DEPLOY_OUTPUT=$(sui client publish --gas-budget 100000000 --json)

# Extract package ID
PACKAGE_ID=$(echo $DEPLOY_OUTPUT | jq -r '.objectChanges[] | select(.type == "published") | .packageId')

echo "✅ Contracts deployed successfully!"
echo "📦 Package ID: $PACKAGE_ID"

# Save package ID to file
echo $PACKAGE_ID > ../PACKAGE_ID.txt
echo "💾 Package ID saved to PACKAGE_ID.txt"

# Create initial pool
echo "🏊 Creating initial flash loan pool..."

# Get a coin for initial deposit (1000 SUI)
COIN_ID=$(sui client gas --json | jq -r '.[0].gasCoinId')

sui client call \
  --package $PACKAGE_ID \
  --module flash_loan \
  --function create_pool_entry \
  --args $COIN_ID 5 500000000000 \
  --gas-budget 10000000 \
  --json > pool_creation.json

POOL_ID=$(cat pool_creation.json | jq -r '.objectChanges[] | select(.objectType | contains("FlashLoanPool")) | .objectId')

echo "✅ Pool created successfully!"
echo "🏊 Pool ID: $POOL_ID"
echo $POOL_ID > ../POOL_ID.txt

# Update environment files
echo "📝 Updating environment configuration..."
cd ..

# Update backend .env
if [ -f "backend/.env" ]; then
    sed -i "s/PACKAGE_ID=.*/PACKAGE_ID=$PACKAGE_ID/" backend/.env
else
    echo "PACKAGE_ID=$PACKAGE_ID" >> backend/.env
fi

# Update frontend .env.local
if [ -f "frontend/.env.local" ]; then
    sed -i "s/NEXT_PUBLIC_PACKAGE_ID=.*/NEXT_PUBLIC_PACKAGE_ID=$PACKAGE_ID/" frontend/.env.local
else
    echo "NEXT_PUBLIC_PACKAGE_ID=$PACKAGE_ID" >> frontend/.env.local
fi

echo ""
echo "=================================================="
echo "✅ Deployment Complete!"
echo "=================================================="
echo ""
echo "📦 Package ID: $PACKAGE_ID"
echo "🏊 Pool ID: $POOL_ID"
echo "🌐 Network: Sui Testnet"
echo "📍 Deployer: $ACTIVE_ADDRESS"
echo ""
echo "🔗 View on Sui Explorer:"
echo "   Package: https://suiexplorer.com/object/$PACKAGE_ID?network=testnet"
echo "   Pool: https://suiexplorer.com/object/$POOL_ID?network=testnet"
echo ""
echo "📝 Next Steps:"
echo "   1. Update backend/.env with PACKAGE_ID"
echo "   2. Update frontend/.env.local with NEXT_PUBLIC_PACKAGE_ID"
echo "   3. Start backend: cd backend && npm start"
echo "   4. Start frontend: cd frontend && npm run dev"
echo ""