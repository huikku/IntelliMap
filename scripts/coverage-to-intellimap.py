#!/usr/bin/env python3
"""
Convert coverage.py data to IntelliMap runtime trace format
"""

import json
import os
import subprocess
from pathlib import Path
from datetime import datetime

def get_git_info():
    try:
        branch = subprocess.check_output(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], 
                                        stderr=subprocess.DEVNULL).decode().strip()
        commit = subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD'],
                                        stderr=subprocess.DEVNULL).decode().strip()
        return branch, commit
    except:
        return 'unknown', 'unknown'

def convert_coverage():
    print('🔬 Converting coverage.py data to IntelliMap runtime trace...')
    
    # Check if coverage data exists
    if not os.path.exists('.coverage.json'):
        print('❌ No coverage data found at .coverage.json')
        print('   Run: coverage run -m pytest')
        print('   Then: coverage json')
        return
    
    with open('.coverage.json', 'r') as f:
        coverage_data = json.load(f)
    
    nodes = []
    files = coverage_data.get('files', {})
    
    for filepath, file_data in files.items():
        # Get relative path
        rel_path = os.path.relpath(filepath)
        
        # Calculate coverage
        summary = file_data.get('summary', {})
        total_statements = summary.get('num_statements', 0)
        covered_statements = summary.get('covered_lines', 0)
        coverage_percent = (covered_statements / total_statements * 100) if total_statements > 0 else 0
        
        # Estimate execution count from covered lines
        execution_count = len(file_data.get('executed_lines', []))
        
        nodes.append({
            'id': rel_path,
            'executionCount': execution_count,
            'totalTime': execution_count * 0.01,  # Estimate
            'coverage': coverage_percent
        })
    
    # Get git info
    branch, commit = get_git_info()
    
    # Create trace
    trace = {
        'metadata': {
            'timestamp': int(datetime.now().timestamp() * 1000),
            'branch': branch,
            'commit': commit,
            'runId': f'coverage-{int(datetime.now().timestamp())}',
            'environment': os.getenv('ENVIRONMENT', 'test'),
            'description': 'coverage.py data',
            'source': 'coverage.py'
        },
        'edges': [],  # Will be inferred from static graph
        'nodes': nodes
    }
    
    # Save trace
    runtime_dir = Path('.intellimap/runtime')
    runtime_dir.mkdir(parents=True, exist_ok=True)
    
    trace_file = runtime_dir / f'trace-{int(datetime.now().timestamp() * 1000)}.json'
    with open(trace_file, 'w') as f:
        json.dump(trace, f, indent=2)
    
    print(f'✅ Converted coverage.py data to IntelliMap trace!')
    print(f'📁 Saved to: {trace_file}')
    print(f'📊 Stats: {len(nodes)} files with coverage')

if __name__ == '__main__':
    convert_coverage()
