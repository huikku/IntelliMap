import { useState, useRef, useEffect } from 'react';

export default function RAGChat({ currentRepo, onHighlightNodes }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [snapshotId, setSnapshotId] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [taskType, setTaskType] = useState('explain');
  const [highlightedPaths, setHighlightedPaths] = useState([]);
  const [embeddingProgress, setEmbeddingProgress] = useState(null); // { current, total, percentage }
  const messagesEndRef = useRef(null);

  // Load snapshots on mount
  useEffect(() => {
    loadSnapshots();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadSnapshots = async () => {
    try {
      const response = await fetch('/api/v1/snapshots');
      const data = await response.json();
      setSnapshots(data.snapshots || []);
      
      // Auto-select the latest snapshot
      if (data.snapshots && data.snapshots.length > 0) {
        setSnapshotId(data.snapshots[0].id);
      }
    } catch (error) {
      console.error('Error loading snapshots:', error);
    }
  };

  const createSnapshot = async () => {
    try {
      setIsLoading(true);
      setEmbeddingProgress(null);

      const response = await fetch('/api/v1/snapshots', { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        setMessages(prev => [...prev, {
          role: 'system',
          content: `✅ Created snapshot ${data.snapshot.id} (${data.snapshot.manifest_hash.substring(0, 8)}...)`
        }]);

        // Embed the snapshot with SSE progress
        setMessages(prev => [...prev, {
          role: 'system',
          content: '🔢 Generating embeddings...',
          isProgress: true
        }]);

        // Use EventSource for SSE
        const eventSource = new EventSource(`/api/v1/snapshots/${data.snapshot.id}/embed?type=code`);

        eventSource.onmessage = (event) => {
          const progressData = JSON.parse(event.data);

          if (progressData.type === 'progress') {
            setEmbeddingProgress({
              current: progressData.current,
              total: progressData.total,
              percentage: progressData.percentage
            });
          } else if (progressData.type === 'complete') {
            setEmbeddingProgress(null);
            setMessages(prev => {
              // Remove the progress message
              const filtered = prev.filter(m => !m.isProgress);
              return [...filtered, {
                role: 'system',
                content: `✅ Embedded ${progressData.embedded_chunks} chunks. Ready to answer questions!`
              }];
            });

            setSnapshotId(data.snapshot.id);
            loadSnapshots();
            eventSource.close();
            setIsLoading(false);
          } else if (progressData.type === 'error') {
            setEmbeddingProgress(null);
            setMessages(prev => {
              const filtered = prev.filter(m => !m.isProgress);
              return [...filtered, {
                role: 'system',
                content: `❌ Error: ${progressData.error}`
              }];
            });
            eventSource.close();
            setIsLoading(false);
          }
        };

        eventSource.onerror = (error) => {
          console.error('SSE error:', error);
          setEmbeddingProgress(null);
          setMessages(prev => {
            const filtered = prev.filter(m => !m.isProgress);
            return [...filtered, {
              role: 'system',
              content: '❌ Error: Connection lost during embedding'
            }];
          });
          eventSource.close();
          setIsLoading(false);
        };
      }
    } catch (error) {
      setEmbeddingProgress(null);
      setMessages(prev => [...prev, {
        role: 'system',
        content: `❌ Error: ${error.message}`
      }]);
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    if (!snapshotId) {
      setMessages(prev => [...prev, {
        role: 'system',
        content: '⚠️ Please create a snapshot first by clicking "Create Snapshot"'
      }]);
      return;
    }

    const userMessage = input.trim();
    setInput('');
    
    // Add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage
    }]);

    setIsLoading(true);

    try {
      const response = await fetch('/api/v1/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot_id: snapshotId,
          question: userMessage,
          task: taskType
        })
      });

      const data = await response.json();

      if (data.answer) {
        // Extract file paths from citations
        const paths = data.citations ? data.citations.map(c => c.path) : [];

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.answer,
          citations: data.citations,
          metadata: data.metadata,
          highlightPaths: paths
        }]);

        // Highlight nodes in the graph
        if (paths.length > 0 && onHighlightNodes) {
          setHighlightedPaths(paths);
          onHighlightNodes(paths);
        }
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'system',
        content: `❌ Error: ${error.message}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHighlights = () => {
    setHighlightedPaths([]);
    if (onHighlightNodes) {
      onHighlightNodes([]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-slate">
        <h3 className="text-xs text-mint font-semibold mb-2">RAG CHAT</h3>
        
        {/* Snapshot selector */}
        <div className="mb-2">
          <select
            value={snapshotId || ''}
            onChange={(e) => setSnapshotId(Number(e.target.value))}
            className="w-full px-2 py-1 bg-navy border border-teal/30 rounded text-xs text-cream"
            style={{ colorScheme: 'dark' }}
          >
            <option value="">Select snapshot...</option>
            {snapshots.map(s => (
              <option key={s.id} value={s.id}>
                #{s.id} - {s.project} ({new Date(s.created_at).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>

        {/* Task type selector */}
        <div className="mb-2">
          <select
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
            className="w-full px-2 py-1 bg-navy border border-teal/30 rounded text-xs text-cream"
            style={{ colorScheme: 'dark' }}
          >
            <option value="explain">💡 Explain</option>
            <option value="impact">⚡ Impact Analysis</option>
            <option value="triage">🎯 Triage (Fast)</option>
            <option value="transform">🔄 Transform</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={createSnapshot}
            disabled={isLoading}
            className="flex-1 px-3 py-1.5 bg-teal/20 hover:bg-teal/30 border border-teal/50 rounded text-xs text-cream transition disabled:opacity-50"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {isLoading ? '⏳ Creating...' : '📸 Snapshot'}
          </button>

          {highlightedPaths.length > 0 && (
            <button
              onClick={clearHighlights}
              className="px-3 py-1.5 bg-rust/20 hover:bg-rust/30 border border-rust/50 rounded text-xs text-cream transition"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
              title="Clear all highlights"
            >
              🔆 Clear
            </button>
          )}
        </div>
      </div>

      {/* Embedding Progress Bar */}
      {embeddingProgress && (
        <div className="px-3 py-2 bg-navy/50 border-b border-teal/20">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-mint" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              Embedding chunks...
            </span>
            <span className="text-[10px] text-cream" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {embeddingProgress.current}/{embeddingProgress.total} ({embeddingProgress.percentage}%)
            </span>
          </div>
          <div className="w-full bg-slate/50 rounded-full h-2 overflow-hidden">
            <div
              className="bg-teal h-full transition-all duration-300 ease-out"
              style={{ width: `${embeddingProgress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-xs text-mint/50 text-center mt-8">
            <p className="mb-2">💬 Ask questions about your codebase</p>
            <p className="text-[10px]">Examples:</p>
            <ul className="text-[10px] mt-2 space-y-1 text-left max-w-[200px] mx-auto">
              <li>• How does authentication work?</li>
              <li>• What are the main components?</li>
              <li>• Explain the graph visualization</li>
            </ul>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-xs ${
              msg.role === 'user' ? 'text-cream' :
              msg.role === 'system' ? 'text-mint/70' :
              'text-teal'
            }`}
          >
            {msg.role === 'user' && (
              <div className="bg-slate/50 rounded p-2 mb-1">
                <span className="font-semibold text-cream">You:</span>
                <p className="mt-1 whitespace-pre-wrap">{msg.content}</p>
              </div>
            )}

            {msg.role === 'assistant' && (
              <div className="bg-navy/50 rounded p-2 mb-1">
                <span className="font-semibold text-teal">🤖 RepoGPT:</span>
                <p className="mt-1 whitespace-pre-wrap text-cream/90 leading-relaxed">
                  {msg.content}
                </p>
                
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate/50">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] text-mint/70">📎 Citations ({msg.citations.length}):</p>
                      {msg.highlightPaths && msg.highlightPaths.length > 0 && (
                        <button
                          onClick={() => {
                            if (onHighlightNodes) {
                              const isCurrentlyHighlighted =
                                JSON.stringify(highlightedPaths.sort()) ===
                                JSON.stringify(msg.highlightPaths.sort());

                              if (isCurrentlyHighlighted) {
                                clearHighlights();
                              } else {
                                setHighlightedPaths(msg.highlightPaths);
                                onHighlightNodes(msg.highlightPaths);
                              }
                            }
                          }}
                          className="px-2 py-0.5 bg-teal/20 hover:bg-teal/30 border border-teal/50 rounded text-[9px] text-cream transition"
                        >
                          {JSON.stringify(highlightedPaths.sort()) ===
                           JSON.stringify(msg.highlightPaths.sort())
                            ? '🔆 Clear'
                            : '🔍 Highlight'}
                        </button>
                      )}
                    </div>
                    {msg.citations.map((cite, j) => (
                      <div key={j} className="text-[10px] text-teal/80 font-mono">
                        {cite.path}:{cite.start_line}-{cite.end_line}
                      </div>
                    ))}
                  </div>
                )}

                {msg.metadata && (
                  <div className="mt-2 pt-2 border-t border-slate/50 text-[9px] text-mint/50">
                    Model: {msg.metadata.model} | 
                    Tokens: {msg.metadata.tokensIn}→{msg.metadata.tokensOut} | 
                    Cost: ${msg.metadata.cost?.toFixed(4) || '0.0000'}
                  </div>
                )}
              </div>
            )}

            {msg.role === 'system' && (
              <div className="text-[10px] text-mint/70 italic">
                {msg.content}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="text-xs text-mint/70 animate-pulse">
            🤔 Thinking...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question..."
            disabled={isLoading}
            className="flex-1 px-2 py-1.5 bg-navy border border-teal/30 rounded text-xs text-cream resize-none disabled:opacity-50"
            style={{ colorScheme: 'dark', fontFamily: "'JetBrains Mono', monospace" }}
            rows={2}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="px-3 bg-teal/20 hover:bg-teal/30 border border-teal/50 rounded text-xs text-cream transition disabled:opacity-50"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Send
          </button>
        </div>
        <p className="text-[9px] text-mint/50 mt-1">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

