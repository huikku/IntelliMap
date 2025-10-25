#!/usr/bin/env python3
"""
Python AST Parser for MOTH Generator
Extracts imports and symbols from Python source code using AST parsing.
"""

import ast
import sys
import json


class Analyzer(ast.NodeVisitor):
    """AST visitor that extracts imports and symbol definitions."""
    
    def __init__(self):
        self.imports = set()
        self.symbols = set()
    
    def visit_Import(self, node):
        """Handle: import module"""
        for alias in node.names:
            self.imports.add(alias.name)
        self.generic_visit(node)
    
    def visit_ImportFrom(self, node):
        """Handle: from module import name"""
        if node.module:
            self.imports.add(node.module)
        # Optionally add imported names as well
        # for alias in node.names:
        #     self.imports.add(f"{node.module}.{alias.name}")
        self.generic_visit(node)
    
    def visit_FunctionDef(self, node):
        """Handle: def function_name()"""
        self.symbols.add(node.name)
        self.generic_visit(node)
    
    def visit_AsyncFunctionDef(self, node):
        """Handle: async def function_name()"""
        self.symbols.add(node.name)
        self.generic_visit(node)
    
    def visit_ClassDef(self, node):
        """Handle: class ClassName"""
        self.symbols.add(node.name)
        self.generic_visit(node)


def analyze_code(code):
    """
    Parse Python code and extract imports and symbols.
    
    Args:
        code (str): Python source code
        
    Returns:
        dict: {"imports": [...], "symbols": [...]}
    """
    try:
        tree = ast.parse(code)
        analyzer = Analyzer()
        analyzer.visit(tree)
        return {
            "imports": sorted(list(analyzer.imports)),
            "symbols": sorted(list(analyzer.symbols))
        }
    except SyntaxError as e:
        # Write errors to stderr so Node.js can see them
        print(f"Python Syntax Error: {e}", file=sys.stderr)
        return {"imports": [], "symbols": [], "error": str(e)}
    except Exception as e:
        print(f"Python AST Error: {e}", file=sys.stderr)
        return {"imports": [], "symbols": [], "error": str(e)}


if __name__ == "__main__":
    # Read code from stdin
    code_to_analyze = sys.stdin.read()
    results = analyze_code(code_to_analyze)
    # Output JSON to stdout
    print(json.dumps(results))

