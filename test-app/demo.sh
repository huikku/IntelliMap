#!/bin/bash

# Demo script for IntelliMap runtime analysis

echo "🎯 IntelliMap Runtime Analysis Demo"
echo "===================================="
echo ""

# Step 1: Install dependencies
echo "📦 Step 1: Installing dependencies..."
npm install
echo ""

# Step 2: Index the codebase
echo "📊 Step 2: Indexing codebase..."
cd ..
npm run index -- --entry test-app/server.js --out test-app/.intellimap/graph.json
cd test-app
echo ""

# Step 3: Run the app with runtime analysis
echo "🚀 Step 3: Starting app with runtime analysis..."
echo ""
echo "The app will start on http://localhost:3000"
echo ""
echo "In another terminal, run these commands to exercise the app:"
echo "  curl http://localhost:3000/"
echo "  curl http://localhost:3000/users/123"
echo "  curl http://localhost:3000/products"
echo ""
echo "Then press Ctrl+C here to stop and generate the runtime report"
echo ""

cd ..
npm run run -- "node test-app/server.js"

