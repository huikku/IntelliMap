import React, { useState, useEffect } from 'react';

export default function MOTHPanel({ onClose }) {
  const [mothData, setMothData] = useState(null);
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState('summary'); // 'summary', 'manifest', 'files', 'metrics'

  useEffect(() => {
    loadMOTHData();
  }, []);

  const loadMOTHData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load index and validation
      const [indexRes, validationRes] = await Promise.all([
        fetch('/api/moth-index'),
        fetch('/api/moth-validation')
      ]);

      if (indexRes.ok && validationRes.ok) {
        const index = await indexRes.json();
        const val = await validationRes.json();
        setMothData(index);
        setValidation(val);
      } else {
        setError('No MOTH data found. Generate a manifest first.');
      }
    } catch (err) {
      setError('Failed to load MOTH data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateMOTH = async () => {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/moth-generate', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        // Reload data
        await loadMOTHData();
      } else {
        setError('Generation failed: ' + data.error);
      }
    } catch (err) {
      setError('Failed to generate MOTH: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const downloadManifest = async () => {
    try {
      const res = await fetch('/api/moth-manifest');
      const manifest = await res.text();
      const blob = new Blob([manifest], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'REPO.moth';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download manifest: ' + err.message);
    }
  };

  const downloadIndex = () => {
    if (!mothData) return;
    const blob = new Blob([JSON.stringify(mothData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'moth.index.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-navy border-2 border-teal rounded-lg p-8 max-w-md">
          <div className="text-center">
            <img src="/logo-mono.png" alt="MOTH" className="w-16 h-16 mx-auto mb-4 opacity-60" />
            <div className="text-xl font-bold text-cream">Loading MOTH data...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-navy border-2 border-teal rounded-lg w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-slate">
          <div className="flex items-center gap-3">
            <img src="/logo-mono.png" alt="MOTH" className="w-10 h-10 opacity-80" />
            <div>
              <h2 className="text-2xl font-bold text-cream">MOTH Manifest</h2>
              <p className="text-xs text-mint">Machine-Optimized Text Hierarchy</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate hover:bg-teal/20 border border-teal/30 hover:border-teal rounded text-cream text-sm transition"
          >
            ✕ Close
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between p-4 border-b-2 border-slate">
          <div className="flex gap-2">
            <button
              onClick={() => setView('summary')}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${
                view === 'summary' ? 'bg-teal text-white' : 'bg-slate hover:bg-teal/20 text-cream'
              }`}
            >
              📊 Summary
            </button>
            <button
              onClick={() => setView('files')}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${
                view === 'files' ? 'bg-teal text-white' : 'bg-slate hover:bg-teal/20 text-cream'
              }`}
            >
              📁 Files
            </button>
            <button
              onClick={() => setView('metrics')}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${
                view === 'metrics' ? 'bg-teal text-white' : 'bg-slate hover:bg-teal/20 text-cream'
              }`}
            >
              📈 Metrics
            </button>
            <button
              onClick={() => setView('manifest')}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${
                view === 'manifest' ? 'bg-teal text-white' : 'bg-slate hover:bg-teal/20 text-cream'
              }`}
            >
              📄 Raw Manifest
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={generateMOTH}
              disabled={generating}
              className="px-3 py-1 bg-sage hover:bg-olive disabled:bg-slate disabled:text-mint disabled:cursor-not-allowed rounded text-white text-xs font-semibold transition"
            >
              {generating ? '⏳ Generating...' : '🔄 Regenerate'}
            </button>
            <button
              onClick={downloadManifest}
              disabled={!mothData}
              className="px-3 py-1 bg-teal hover:bg-teal/80 disabled:bg-slate disabled:text-mint disabled:cursor-not-allowed rounded text-white text-xs font-semibold transition"
            >
              ⬇️ Download .moth
            </button>
            <button
              onClick={downloadIndex}
              disabled={!mothData}
              className="px-3 py-1 bg-teal hover:bg-teal/80 disabled:bg-slate disabled:text-mint disabled:cursor-not-allowed rounded text-white text-xs font-semibold transition"
            >
              ⬇️ Download .json
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {error && (
            <div className="bg-rust/20 border-2 border-rust rounded p-4 mb-4">
              <div className="font-bold text-cream mb-2">❌ Error</div>
              <div className="text-sm text-mint">{error}</div>
              <button
                onClick={generateMOTH}
                className="mt-3 px-3 py-1 bg-rust hover:bg-rust/80 rounded text-white text-xs font-semibold transition"
              >
                Generate MOTH Manifest
              </button>
            </div>
          )}

          {!error && mothData && validation && (
            <>
              {view === 'summary' && <SummaryView validation={validation} mothData={mothData} />}
              {view === 'files' && <FilesView mothData={mothData} />}
              {view === 'metrics' && <MetricsView mothData={mothData} />}
              {view === 'manifest' && <ManifestView />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryView({ validation, mothData }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#0a0a0a] rounded p-4">
          <div className="text-xs text-[#6a6a6a] mb-1">Project</div>
          <div className="text-xl font-bold text-purple-300">{validation.project}</div>
        </div>
        <div className="bg-[#0a0a0a] rounded p-4">
          <div className="text-xs text-[#6a6a6a] mb-1">Generated</div>
          <div className="text-sm">{new Date(validation.timestamp).toLocaleString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#0a0a0a] rounded p-4">
          <div className="text-xs text-[#6a6a6a] mb-1">Files</div>
          <div className="text-2xl font-bold text-blue-400">{validation.summary.totalFiles.toLocaleString()}</div>
        </div>
        <div className="bg-[#0a0a0a] rounded p-4">
          <div className="text-xs text-[#6a6a6a] mb-1">Lines of Code</div>
          <div className="text-2xl font-bold text-green-400">{validation.summary.totalLines.toLocaleString()}</div>
        </div>
        <div className="bg-[#0a0a0a] rounded p-4">
          <div className="text-xs text-[#6a6a6a] mb-1">Complexity</div>
          <div className="text-2xl font-bold text-yellow-400">{validation.summary.totalComplexity.toLocaleString()}</div>
        </div>
        <div className="bg-slate rounded p-4 border border-teal/30">
          <div className="text-xs text-mint mb-1">Avg Depth</div>
          <div className="text-2xl font-bold text-cream">{validation.summary.averageDepth.toFixed(2)}</div>
        </div>
      </div>

      <div className="bg-slate rounded p-4 border border-teal/30">
        <div className="text-sm font-bold text-cream mb-3">Validation Status</div>
        <div className="grid grid-cols-2 gap-2 text-sm text-cream">
          <div className="flex items-center gap-2">
            <span>{validation.validation.schemaValid ? '✅' : '❌'}</span>
            <span>Schema Valid</span>
          </div>
          <div className="flex items-center gap-2">
            <span>{validation.validation.checksumsValid ? '✅' : '❌'}</span>
            <span>Checksums Valid</span>
          </div>
          <div className="flex items-center gap-2">
            <span>{validation.validation.pathsResolved ? '✅' : '❌'}</span>
            <span>Paths Resolved</span>
          </div>
          <div className="flex items-center gap-2">
            <span>{validation.validation.metricsValid ? '✅' : '❌'}</span>
            <span>Metrics Valid</span>
          </div>
        </div>
      </div>

      <div className="bg-slate rounded p-4 border border-teal/30">
        <div className="text-xs text-mint mb-1">Manifest Hash</div>
        <div className="font-mono text-xs text-cream break-all">{validation.validation.manifestHash}</div>
      </div>
    </div>
  );
}

function FilesView({ mothData }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('path'); // 'path', 'loc', 'complexity', 'churn'

  const files = Object.entries(mothData.files || {});
  
  const filtered = files.filter(([path]) => 
    path.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    const [pathA, dataA] = a;
    const [pathB, dataB] = b;
    
    switch (sortBy) {
      case 'loc':
        return dataB.metrics.loc - dataA.metrics.loc;
      case 'complexity':
        return dataB.metrics.complexity - dataA.metrics.complexity;
      case 'churn':
        return dataB.metrics.churn - dataA.metrics.churn;
      default:
        return pathA.localeCompare(pathB);
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search files..."
          className="flex-1 px-3 py-2 bg-slate border border-teal/30 rounded text-sm text-cream placeholder-mint"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 bg-slate border border-teal/30 rounded text-sm text-cream"
        >
          <option value="path">Sort by Path</option>
          <option value="loc">Sort by Lines</option>
          <option value="complexity">Sort by Complexity</option>
          <option value="churn">Sort by Churn</option>
        </select>
      </div>

      <div className="text-xs text-mint">
        Showing {sorted.length} of {files.length} files
      </div>

      <div className="space-y-2">
        {sorted.map(([path, data]) => (
          <div key={path} className="bg-slate rounded p-3 hover:bg-teal/10 border border-teal/20 transition">
            <div className="font-mono text-sm text-cream mb-2">{path}</div>
            <div className="grid grid-cols-6 gap-2 text-xs text-cream">
              <div>
                <span className="text-mint">LOC:</span> {data.metrics.loc}
              </div>
              <div>
                <span className="text-mint">Complexity:</span> {data.metrics.complexity}
              </div>
              <div>
                <span className="text-mint">Churn:</span> {data.metrics.churn}
              </div>
              <div>
                <span className="text-mint">Fanin:</span> {data.metrics.fanin}
              </div>
              <div>
                <span className="text-mint">Fanout:</span> {data.metrics.fanout}
              </div>
              <div>
                <span className="text-mint">Depth:</span> {data.metrics.depth}
              </div>
            </div>
            {data.symbols && data.symbols.length > 0 && (
              <div className="mt-2 text-xs text-[#6a6a6a]">
                Symbols: {data.symbols.slice(0, 5).join(', ')}
                {data.symbols.length > 5 && ` +${data.symbols.length - 5} more`}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricsView({ mothData }) {
  const files = Object.values(mothData.files || {});
  
  const topByLOC = [...files].sort((a, b) => b.metrics.loc - a.metrics.loc).slice(0, 10);
  const topByComplexity = [...files].sort((a, b) => b.metrics.complexity - a.metrics.complexity).slice(0, 10);
  const topByChurn = [...files].sort((a, b) => b.metrics.churn - a.metrics.churn).slice(0, 10);

  return (
    <div className="grid grid-cols-3 gap-4">
      <MetricsList title="📏 Largest Files" items={topByLOC} metric="loc" label="lines" />
      <MetricsList title="🔥 Most Complex" items={topByComplexity} metric="complexity" label="complexity" />
      <MetricsList title="⚡ Most Changed" items={topByChurn} metric="churn" label="changes" />
    </div>
  );
}

function MetricsList({ title, items, metric, label }) {
  return (
    <div className="bg-[#0a0a0a] rounded p-4">
      <div className="text-sm font-bold text-purple-300 mb-3">{title}</div>
      <div className="space-y-2">
        {items.map((item, idx) => {
          const path = Object.keys(item)[0] || 'unknown';
          return (
            <div key={idx} className="text-xs">
              <div className="font-mono text-[#a0a0a0] truncate">{path}</div>
              <div className="text-[#6a6a6a]">{item.metrics[metric].toLocaleString()} {label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ManifestView() {
  const [manifest, setManifest] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/moth-manifest')
      .then(res => res.text())
      .then(text => {
        setManifest(text);
        setLoading(false);
      })
      .catch(err => {
        setManifest('Error loading manifest: ' + err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="text-center text-[#6a6a6a]">Loading manifest...</div>;
  }

  return (
    <div className="bg-[#0a0a0a] rounded p-4">
      <pre className="text-xs font-mono text-[#a0a0a0] whitespace-pre-wrap overflow-auto max-h-[600px]">
        {manifest}
      </pre>
    </div>
  );
}

