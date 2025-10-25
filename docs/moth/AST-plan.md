Plan: Implement AST-Based Parsing in analyze.mjsGoal: Replace the regex-based extractCodeInfo function with Abstract Syntax Tree (AST) parsing to accurately extract import dependencies and symbol definitions (functions, classes, etc.) for supported languages (primarily TypeScript/JavaScript and Python).Current State: extractCodeInfo uses regular expressions, which are inaccurate for complex code syntax, leading to errors in the dependency graph (fanin, fanout, depth) and symbol lists (fn:[...]) in the MOTH manifest.Target State: extractCodeInfo uses dedicated AST parsers for each language, reliably identifying imports and symbols by traversing the code's actual syntactic structure.Steps:1. Install Dependencies:Add necessary AST parsing libraries to your project.For JavaScript/TypeScript: @typescript-eslint/typescript-estree is recommended as it handles both well.npm install @typescript-eslint/typescript-estree --save-dev
# OR yarn add @typescript-eslint/typescript-estree --dev
For AST Traversal (optional but helpful): estraversenpm install estraverse --save-dev
# OR yarn add estraverse --dev
(Python parsing will use a helper script, no direct Node.js dependency needed initially).2. Refactor extractCodeInfo Function:Modify the function signature if needed (though (content, filePath) is likely fine).Add conditional logic based on file extension (e.g., .js, .jsx, .ts, .tsx, .py).3. Implement JS/TS AST Parsing:Import Parser: import * as parser from '@typescript-eslint/typescript-estree'; (or your chosen library).Parse Content: Inside the JS/TS file condition:let ast;
try {
  ast = parser.parse(content, {
    jsx: filePath.endsWith('x'), // Enable JSX parsing for .jsx/.tsx
    loc: false, // Don't need location info
    range: false, // Don't need range info
    // Add error tolerance if desired, though strict parsing is often better
  });
} catch (error) {
  console.warn(`⚠️ AST Parsing failed for ${filePath}: ${error.message}`);
  return { imports: [], symbols: [] }; // Return empty on parse failure
}
Traverse AST: Use estraverse or a custom recursive visitor function to walk the ast object.const imports = new Set();
const symbols = new Set();

// Using estraverse example:
// import estraverse from 'estraverse';
// estraverse.traverse(ast, {
//   enter: function (node, parent) {
//     // Logic to find nodes (see below)
//   }
// });

// Or a simple recursive visitor:
function visit(node) {
  if (!node) return;

  // --- Import Logic ---
  if (node.type === 'ImportDeclaration' && node.source && typeof node.source.value === 'string') {
    imports.add(node.source.value);
  } else if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require' && node.arguments.length > 0 && node.arguments[0].type === 'Literal' && typeof node.arguments[0].value === 'string') {
    imports.add(node.arguments[0].value); // Handle require('module')
  } else if (node.type === 'ImportExpression' && node.source && node.source.type === 'Literal' && typeof node.source.value === 'string') {
    imports.add(node.source.value); // Handle dynamic import('module')
  }
  // Add logic for re-exports (ExportNamedDeclaration with source, ExportAllDeclaration) if needed

  // --- Symbol Logic ---
  // Basic function/class declarations
  if ((node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') && node.id) {
    symbols.add(node.id.name);
  }
  // Variable declarations (check if exported or top-level)
  if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
    // Check parent nodes to see if it's exported or global scope if needed
    symbols.add(node.id.name); // Simplistic: add all declared vars/consts/lets
  }
  // Exported names: export { name1, name2 }
  if (node.type === 'ExportSpecifier' && node.exported.type === 'Identifier') {
    symbols.add(node.exported.name);
  }
  // Export default function/class directly: export default function name() {}
  if (node.type === 'ExportDefaultDeclaration' && node.declaration && (node.declaration.type === 'FunctionDeclaration' || node.declaration.type === 'ClassDeclaration') && node.declaration.id) {
     symbols.add(node.declaration.id.name);
  }

  // Recursively visit children
  for (const key in node) {
    if (node.hasOwnProperty(key)) {
      const child = node[key];
      if (typeof child === 'object' && child !== null) {
        if (Array.isArray(child)) {
          child.forEach(visit);
        } else {
          visit(child);
        }
      }
    }
  }
}
visit(ast); // Start traversal

return { imports: [...imports], symbols: [...symbols] };
Refine Logic: The above symbol extraction is basic. You might need more sophisticated checks (e.g., checking parent nodes for ExportNamedDeclaration, handling export * as ns from 'mod') depending on the desired level of detail.4. Implement Python AST Parsing:Create Helper Script (parse_python.py):import ast
import sys
import json

class Analyzer(ast.NodeVisitor):
    def __init__(self):
        self.imports = set()
        self.symbols = set()

    def visit_Import(self, node):
        for alias in node.names:
            self.imports.add(alias.name)
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        if node.module:
            self.imports.add(node.module)
        # Could add imported names: for alias in node.names: ...
        self.generic_visit(node)

    def visit_FunctionDef(self, node):
        self.symbols.add(node.name)
        self.generic_visit(node)

    def visit_ClassDef(self, node):
        self.symbols.add(node.name)
        self.generic_visit(node)

    # Add AsyncFunctionDef if needed

def analyze_code(code):
    try:
        tree = ast.parse(code)
        analyzer = Analyzer()
        analyzer.visit(tree)
        return {"imports": sorted(list(analyzer.imports)), "symbols": sorted(list(analyzer.symbols))}
    except Exception as e:
        # Write errors to stderr so Node.js can see them
        print(f"Python AST Error: {e}", file=sys.stderr)
        return {"imports": [], "symbols": [], "error": str(e)}

if __name__ == "__main__":
    code_to_analyze = sys.stdin.read()
    results = analyze_code(code_to_analyze)
    print(json.dumps(results))

Call Helper from Node.js: Inside the .py file condition in extractCodeInfo:import { spawnSync } from 'child_process'; // Add to imports

// ... inside extractCodeInfo for .py files
try {
  const pythonProcess = spawnSync('python', ['path/to/parse_python.py'], {
    input: content,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'] // stdin, stdout, stderr
  });

  if (pythonProcess.error) {
    throw pythonProcess.error;
  }
  if (pythonProcess.status !== 0) {
     throw new Error(`Python script exited with code ${pythonProcess.status}: ${pythonProcess.stderr}`);
  }

  const result = JSON.parse(pythonProcess.stdout);
  if (result.error) {
       console.warn(`⚠️ Python AST analysis error for ${filePath}: ${result.error}`);
       return { imports: [], symbols: [] };
  }
  return { imports: result.imports || [], symbols: result.symbols || [] };

} catch (error) {
  console.warn(`⚠️ Failed to run Python AST parser for ${filePath}: ${error.message}`);
  // Log stderr if available: console.error(error.stderr);
  return { imports: [], symbols: [] };
}
Ensure Python: Make sure Python 3 is installed and accessible in the environment where analyze.mjs runs.5. Update Dependency Resolution (If Needed):Review the resolveImport function. AST parsing might extract slightly different path formats (e.g., handling baseUrl or paths from tsconfig.json more accurately, though full support is complex). For now, the existing relative path and @external logic might be sufficient.6. Test Thoroughly:Create sample .ts, .tsx, .js, .py files covering various import/export/definition syntaxes.Run the updated analyze.mjs script on these samples.Inspect the imports and symbols logged or saved in moth.index.json to verify correctness.Run on the full project and compare the output manifests (REPO.moth, moth.index.json) with the previous versions to assess the improvements in accuracy. Pay attention to fanin/fanout/depth metrics and the fn:[...] lists.7. (Optional) Refine Metrics:Complexity: Explore integrating libraries like eslint-plugin-complexity (requires running ESLint programmatically) or calling out to radon via child_process for Python to get standard cyclomatic complexity. Update calculateComplexity.Churn: Ensure the optimized buildChurnMap is working correctly. Add comments explaining the line-count heuristic used.This plan provides a structured way to significantly enhance the semantic accuracy of your MOTH generator by moving from fragile regex to robust AST parsing. Prioritize the JS/TS implementation first, as it covers the bulk of the codebase according to the file list.