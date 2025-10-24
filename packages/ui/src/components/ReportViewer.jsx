import { useState, useEffect } from 'react';

export default function ReportViewer({ report, reportType, onClose }) {
  const [copied, setCopied] = useState(false);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!report) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getTitle = () => {
    if (reportType === 'cycles') return '🔴 Circular Dependency Report';
    if (reportType === 'runtime') return '⚡ Runtime Analysis Report';
    if (reportType === 'analysis') return '📊 Architecture Analysis Report';
    return '📋 Report';
  };

  const lineCount = report.split('\n').length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border-2 border-gray-700 rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 bg-gray-800 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white">{getTitle()}</h2>
            <span className="text-xs text-gray-400">
              {lineCount} lines
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded text-sm font-semibold transition flex items-center gap-2"
              title="Copy report to clipboard"
            >
              {copied ? (
                <>
                  <span>✓</span>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <span>📋</span>
                  <span>Copy</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl leading-none px-2"
              title="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-auto bg-gray-950 p-6">
          <pre className="text-sm font-mono text-gray-300 leading-relaxed whitespace-pre-wrap">
            {report}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-700 bg-gray-800 rounded-b-lg flex items-center justify-between">
          <div className="text-xs text-gray-400">
            Press <kbd className="px-2 py-1 bg-gray-700 border border-gray-600 rounded font-mono">Esc</kbd> to close
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

