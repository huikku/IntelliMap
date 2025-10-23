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
    except Exception:
        pass  # Skip files that can't be parsed

    return imports

def resolve_import_path(root, import_name):
    """Resolve import name to file path"""
    # Try as module file
    module_path = root / (import_name.replace('.', '/') + '.py')
    if module_path.exists():
        return str(module_path.relative_to(root))

    # Try as package __init__
    package_path = root / import_name.replace('.', '/') / '__init__.py'
    if package_path.exists():
        return str(package_path.relative_to(root))

    return None

def build_python_graph(root_path, extra_path=None):
    """Build dependency graph from Python code"""
    nodes = []
    edges = []
    node_map = {}
    edge_set = set()

    root = Path(root_path)
    if not root.exists():
        return {"nodes": [], "edges": []}

    # Collect all Python files
    py_files = sorted(root.rglob('*.py'))

    for py_file in py_files:
        # Skip common non-source directories
        if any(part in py_file.parts for part in ['__pycache__', '.venv', 'venv', '.egg-info']):
            continue

        rel_path = str(py_file.relative_to(root))
        node_id = rel_path

        if node_id not in node_map:
            node_map[node_id] = True
            folder = rel_path.split('/')[0] if '/' in rel_path else rel_path
            nodes.append({
                "id": node_id,
                "lang": "py",
                "env": "backend",
                "pkg": "backend",
                "folder": folder,
                "changed": False,
            })

        # Extract imports
        imports = extract_imports(py_file)
        for imp in imports:
            # Skip external/stdlib imports
            if imp.startswith('_'):
                continue

            # Resolve local import
            target_path = resolve_import_path(root, imp)
            if target_path and target_path != node_id:
                edge_key = f"{node_id}→{target_path}"
                if edge_key not in edge_set:
                    edge_set.add(edge_key)
                    edges.append({
                        "from": node_id,
                        "to": target_path,
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

