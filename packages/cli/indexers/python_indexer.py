#!/usr/bin/env python3
"""
Python AST-based dependency indexer for IntelliMap
Extracts import relationships from Python code
"""

import ast
import json
import sys
import argparse
from pathlib import Path
from collections import defaultdict

def extract_imports(file_path):
    """Extract import statements from a Python file"""
    imports = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            tree = ast.parse(f.read())
        
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    imports.append(node.module)
    except Exception as e:
        pass  # Skip files that can't be parsed
    
    return imports

def build_python_graph(root_path, extra_path=None):
    """Build dependency graph from Python code"""
    nodes = []
    edges = []
    node_map = {}
    
    root = Path(root_path)
    if not root.exists():
        return {"nodes": [], "edges": []}
    
    # Collect all Python files
    py_files = list(root.rglob('*.py'))
    
    for py_file in py_files:
        # Skip common non-source directories
        if any(part in py_file.parts for part in ['__pycache__', '.venv', 'venv', '.egg-info']):
            continue
        
        rel_path = str(py_file.relative_to(root))
        node_id = rel_path
        
        if node_id not in node_map:
            node_map[node_id] = True
            nodes.append({
                "id": node_id,
                "lang": "py",
                "env": "backend",
                "pkg": "backend",
                "folder": rel_path.split('/')[0],
                "changed": False,
            })
        
        # Extract imports
        imports = extract_imports(py_file)
        for imp in imports:
            # Convert import to potential file path
            imp_path = imp.replace('.', '/') + '.py'
            
            # Check if it's a local import
            if (root / imp_path).exists():
                edges.append({
                    "from": node_id,
                    "to": imp_path,
                    "kind": "import",
                })
    
    return {"nodes": nodes, "edges": edges}

def main():
    parser = argparse.ArgumentParser(description='Python dependency indexer')
    parser.add_argument('--root', default='backend', help='Root directory for Python code')
    parser.add_argument('--extra-path', help='Extra Python path for imports')
    
    args = parser.parse_args()
    
    graph = build_python_graph(args.root, args.extra_path)
    print(json.dumps(graph))

if __name__ == '__main__':
    main()

