# SonarQube Setup for IntelliMap

This guide will help you set up SonarQube analysis for the IntelliMap project and connect it to VS Code's SonarLint extension.

## Prerequisites

✅ SonarQube server is running at http://localhost:9000  
✅ Configuration files have been created:
- `sonar-project.properties` - Project configuration
- `run-sonar-scan.sh` - Scanner script

## Step 1: Install SonarQube Scanner

You need to install the SonarQube scanner to analyze your code.

### Option A: Install via npm (Recommended)
```bash
npm install -g sonar-scanner
```

### Option B: Download manually
1. Download from: https://docs.sonarqube.org/latest/analyzing-source-code/scanners/sonarscanner/
2. Extract and add to your PATH

## Step 2: Create Project in SonarQube

1. Open http://localhost:9000 in your browser
2. Login with default credentials:
   - Username: `admin`
   - Password: `admin`
3. **Change the password** when prompted (security requirement)
4. Click "Create Project" → "Manually"
5. Enter:
   - Project key: `intellimap`
   - Display name: `IntelliMap`
6. Click "Set Up"

## Step 3: Generate Authentication Token

1. In the project setup wizard, select "Locally"
2. Generate a token:
   - Token name: `intellimap-local`
   - Click "Generate"
3. **Copy the token** - you'll need it for the next steps

Alternatively, generate a token manually:
1. Click on your profile (top right) → "My Account"
2. Go to "Security" tab
3. Under "Generate Tokens", enter a name and click "Generate"
4. Copy the token

## Step 4: Run SonarQube Analysis

Run the analysis script with your token:

```bash
cd /home/john/IntelliMap

# Option 1: Set token as environment variable
export SONAR_TOKEN=your_token_here
./run-sonar-scan.sh

# Option 2: Pass token as argument
./run-sonar-scan.sh your_token_here
```

The script will:
1. Check if SonarQube server is running
2. Run tests with coverage (`npm run test:coverage`)
3. Upload results to SonarQube
4. Provide a link to view results

## Step 5: View Results

After the scan completes, view your results at:
http://localhost:9000/dashboard?id=intellimap

You'll see:
- Code quality metrics
- Security vulnerabilities
- Code smells
- Test coverage
- Technical debt

## Step 6: Install SonarLint Extension in VS Code

1. Open VS Code
2. Press `Ctrl+Shift+X` to open Extensions
3. Search for "SonarLint"
4. Install the official **SonarLint** extension by SonarSource
5. Reload VS Code if prompted

## Step 7: Connect SonarLint to SonarQube (Connected Mode)

### 7.1 Add SonarQube Connection

1. Open Command Palette (`Ctrl+Shift+P`)
2. Type: `SonarLint: Add SonarQube Connection`
3. Enter connection details:
   - **Server URL**: `http://localhost:9000`
   - **Connection name**: `Local SonarQube`
4. Choose authentication method: **Token**
5. Paste the token you generated in Step 3
6. Click "Save Connection"

### 7.2 Bind Project to SonarQube

1. Open the IntelliMap project in VS Code
2. Open Command Palette (`Ctrl+Shift+P`)
3. Type: `SonarLint: Bind to SonarQube or SonarCloud`
4. Select your connection: `Local SonarQube`
5. Select the project: `IntelliMap`
6. Confirm the binding

### 7.3 Verify Connection

1. Open any JavaScript/TypeScript file in the project
2. SonarLint should now analyze it in real-time
3. You'll see issues highlighted in the editor
4. Check the "Problems" panel (`Ctrl+Shift+M`) for SonarLint issues

## Benefits of Connected Mode

✅ **Consistent Rules**: Same quality rules as your SonarQube server  
✅ **Shared Configuration**: Team-wide quality profiles and settings  
✅ **Issue Synchronization**: See server-side issues in your IDE  
✅ **False Positive Management**: Suppressions sync between IDE and server  
✅ **Focus on New Code**: Clean as You Code methodology

## Configuration Files

### sonar-project.properties

This file configures what SonarQube analyzes:

```properties
sonar.projectKey=intellimap
sonar.projectName=IntelliMap
sonar.projectVersion=0.1.0

# Source code locations
sonar.sources=packages/cli,packages/server,packages/ui/src

# Test locations
sonar.tests=packages/cli/__tests__,packages/server/__tests__,packages/ui/__tests__

# Exclusions
sonar.exclusions=**/node_modules/**,**/dist/**,**/build/**,**/coverage/**

# Coverage report
sonar.javascript.lcov.reportPaths=coverage/lcov.info
```

You can customize these settings as needed.

## Troubleshooting

### SonarQube server not running
```bash
cd ~/sonarqube-25.10.0.114319
./bin/linux-x86-64/sonar.sh console
```

### Scanner not found
Install sonar-scanner:
```bash
npm install -g sonar-scanner
```

### Connection issues in VS Code
1. Check SonarQube is accessible at http://localhost:9000
2. Verify your token is still valid
3. Try removing and re-adding the connection

### No issues showing in VS Code
1. Make sure you've run the scanner at least once
2. Verify the project is bound correctly
3. Check SonarLint output: View → Output → Select "SonarLint"

## Next Steps

1. **Configure Quality Gates**: Set up rules for what constitutes passing code
2. **Set up CI/CD**: Integrate SonarQube analysis into your build pipeline
3. **Explore Rules**: Customize which rules are active for your project
4. **Review Issues**: Go through and fix or acknowledge existing issues
5. **Monitor Metrics**: Track code quality over time

## Useful Commands

```bash
# Run analysis
./run-sonar-scan.sh YOUR_TOKEN

# Run tests with coverage
npm run test:coverage

# View coverage report locally
open coverage/index.html
```

## Resources

- SonarQube Documentation: https://docs.sonarqube.org/
- SonarLint for VS Code: https://marketplace.visualstudio.com/items?itemName=SonarSource.sonarlint-vscode
- JavaScript/TypeScript Rules: https://rules.sonarsource.com/javascript/

---

**Happy Coding with Clean Code! 🎯**

