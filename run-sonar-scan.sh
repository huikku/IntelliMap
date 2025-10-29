#!/bin/bash

# SonarQube Scanner Script for IntelliMap
# This script runs SonarQube analysis on the IntelliMap project

echo "=========================================="
echo "IntelliMap - SonarQube Analysis"
echo "=========================================="
echo ""

# Check if sonar-scanner is installed
if ! command -v sonar-scanner &> /dev/null; then
    echo "❌ sonar-scanner is not installed."
    echo ""
    echo "To install sonar-scanner:"
    echo "  1. Download from: https://docs.sonarqube.org/latest/analyzing-source-code/scanners/sonarscanner/"
    echo "  2. Or install via npm: npm install -g sonar-scanner"
    echo ""
    exit 1
fi

# Check if SonarQube server is running
echo "🔍 Checking if SonarQube server is running..."
if ! curl -s http://localhost:9000/api/system/status > /dev/null; then
    echo "❌ SonarQube server is not running at http://localhost:9000"
    echo ""
    echo "Please start SonarQube server first:"
    echo "  cd ~/sonarqube-25.10.0.114319"
    echo "  ./bin/linux-x86-64/sonar.sh console"
    echo ""
    exit 1
fi

echo "✅ SonarQube server is running"
echo ""

# Check if token is provided
if [ -z "$SONAR_TOKEN" ]; then
    echo "⚠️  SONAR_TOKEN environment variable is not set."
    echo ""
    echo "To generate a token:"
    echo "  1. Go to http://localhost:9000"
    echo "  2. Login (admin/admin)"
    echo "  3. Go to My Account > Security > Generate Token"
    echo "  4. Export the token: export SONAR_TOKEN=your_token_here"
    echo ""
    echo "Alternatively, you can pass it as an argument:"
    echo "  ./run-sonar-scan.sh YOUR_TOKEN"
    echo ""
    
    if [ -n "$1" ]; then
        SONAR_TOKEN=$1
        echo "✅ Using token from command line argument"
    else
        exit 1
    fi
fi

# Run tests with coverage (optional but recommended)
echo "📊 Running tests with coverage..."
npm run test:coverage
echo ""

# Run SonarQube scanner
echo "🚀 Running SonarQube analysis..."
sonar-scanner \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.token=$SONAR_TOKEN

echo ""
echo "=========================================="
echo "✅ Analysis complete!"
echo "View results at: http://localhost:9000/dashboard?id=intellimap"
echo "=========================================="

