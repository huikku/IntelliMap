import { useState, useRef, useEffect } from 'react';

export default function RAGChat({ currentRepo }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [snapshotId, setSnapshotId] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [taskType, setTaskType] = useState('explain');
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
      const response = await fetch('/api/v1/snapshots', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        setMessages(prev => [...prev, {
          role: 'system',
          content: `✅ Created snapshot ${data.snapshot.id} (${data.snapshot.manifest_hash.substring(0, 8)}...)`
        }]);
        
        // Embed the snapshot
        setMessages(prev => [...prev, {
          role: 'system',
          content: '🔢 Generating embeddings... This may take a few minutes.'
        }]);
        
        const embedResponse = await fetch(`/api/v1/snapshots/${data.snapshot.id}/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'code' })
        });
        
        const embedData = await embedResponse.json();
        
        if (embedData.success) {
          setMessages(prev => [...prev, {
            role: 'system',
            content: `✅ Embedded ${embedData.embedded_chunks} chunks. Ready to answer questions!`
          }]);
          
          setSnapshotId(data.snapshot.id);
          await loadSnapshots();
        }
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
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.answer,
          citations: data.citations,
          metadata: data.metadata
        }]);
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

        <button
          onClick={createSnapshot}
          disabled={isLoading}
          className="w-full px-3 py-1.5 bg-teal/20 hover:bg-teal/30 border border-teal/50 rounded text-xs text-cream transition disabled:opacity-50"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {isLoading ? '⏳ Creating...' : '📸 Create Snapshot'}
        </button>
      </div>

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
                    <p className="text-[10px] text-mint/70 mb-1">📎 Citations:</p>
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

