import { useState, useEffect } from 'react';

export default function FilePreview({ filePath, currentRepo, maxLines = 500 }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [lineCount, setLineCount] = useState(0);

  useEffect(() => {
    if (!filePath || !currentRepo) {
      setContent(null);
      return;
    }

    const fetchFileContent = async () => {
      setLoading(true);
      setError(null);
      setWarning(null);
      try {
        const response = await fetch(
          `/api/file-content?repo=${encodeURIComponent(currentRepo)}&file=${encodeURIComponent(filePath)}`
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || data.error || 'Failed to load file');
        }

        const data = await response.json();
        setContent(data.content);
        setWarning(data.warning || null);
        setLineCount(data.content.split('\n').length);
      } catch (err) {
        setError(err.message);
        setContent(null);
      } finally {
        setLoading(false);
      }
    };

    fetchFileContent();
  }, [filePath, currentRepo]);

  if (!filePath) {
    return (
      <div className="text-xs text-gray-500 p-2">
        Select a file to preview
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-xs text-gray-400 p-2">
        Loading file...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 bg-gray-900 border border-red-900">
        <div className="text-sm text-red-400 font-semibold mb-2">
          ⚠️ Cannot Preview File
        </div>
        <div className="text-xs text-gray-300 leading-relaxed">
          {error}
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="text-xs text-gray-500 p-2">
        Unable to preview file
      </div>
    );
  }

  // Truncate content if too large
  const lines = content.split('\n');
  const isTruncated = lines.length > maxLines;
  const displayLines = lines.slice(0, maxLines);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* File info header */}
      <div className="px-2 py-1 bg-gray-800 border-b border-gray-700 text-xs text-gray-400">
        <div className="truncate font-mono text-xs">{filePath}</div>
        <div className="text-xs text-gray-500 font-condensed">{lineCount} lines</div>
      </div>

      {/* Warning for minified/bundled files */}
      {warning && (
        <div className="px-3 py-2 bg-yellow-900 border-b border-yellow-800 text-xs text-yellow-200">
          <div className="font-semibold mb-1">⚠️ Build Artifact</div>
          <div className="leading-relaxed">{warning}</div>
        </div>
      )}

      {/* Code preview */}
      <div className="flex-1 overflow-y-auto font-mono text-xs bg-gray-950">
        <div className="p-2">
          {displayLines.map((line, idx) => (
            <div key={idx} className="flex">
              <span className="text-gray-600 w-8 text-right pr-2 select-none">
                {idx + 1}
              </span>
              <span className="text-gray-300 flex-1 whitespace-pre-wrap break-words">
                {line || ' '}
              </span>
            </div>
          ))}
          
          {isTruncated && (
            <div className="text-gray-500 mt-2 text-center">
              ... ({lines.length - maxLines} more lines)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

