import { useState, useEffect } from 'react';

const SettingsModal = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState({
    openaiApiKey: '',
    openrouterApiKey: '',
    anthropicApiKey: '',
    models: {
      explain: 'gpt-4-turbo',
      impact: 'gpt-4-turbo',
      triage: 'google/gemini-2.0-flash-exp:free',
      transform: 'deepseek/deepseek-chat'
    }
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('intellimap-settings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('intellimap-settings', JSON.stringify(settings));
    onClose();
  };

  const modelOptions = {
    openai: [
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' }
    ],
    openrouter: [
      { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
      { value: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (Free)' },
      { value: 'deepseek/deepseek-chat', label: 'DeepSeek Chat' },
      { value: 'mistralai/mistral-large-2411', label: 'Mistral Large' },
      { value: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B' }
    ],
    anthropic: [
      { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' }
    ]
  };

  const allModels = [
    ...modelOptions.openai,
    ...modelOptions.openrouter,
    ...modelOptions.anthropic
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-navy border border-teal/30 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-teal/20">
          <h2 className="text-xl text-cream" style={{ fontFamily: "'Inter', sans-serif" }}>
            ⚙️ Settings
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* API Keys Section */}
          <div>
            <h3 className="text-base text-mint mb-3" style={{ fontFamily: "'Inter', sans-serif" }}>
              API Keys
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-cream/70 mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
                  OpenAI API Key
                </label>
                <input
                  type="password"
                  value={settings.openaiApiKey}
                  onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 bg-slate/50 border border-teal/20 rounded text-cream text-sm"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                />
              </div>
              <div>
                <label className="block text-sm text-cream/70 mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
                  OpenRouter API Key
                </label>
                <input
                  type="password"
                  value={settings.openrouterApiKey}
                  onChange={(e) => setSettings({ ...settings, openrouterApiKey: e.target.value })}
                  placeholder="sk-or-..."
                  className="w-full px-3 py-2 bg-slate/50 border border-teal/20 rounded text-cream text-sm"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                />
              </div>
              <div>
                <label className="block text-sm text-cream/70 mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
                  Anthropic API Key (Optional)
                </label>
                <input
                  type="password"
                  value={settings.anthropicApiKey}
                  onChange={(e) => setSettings({ ...settings, anthropicApiKey: e.target.value })}
                  placeholder="sk-ant-..."
                  className="w-full px-3 py-2 bg-slate/50 border border-teal/20 rounded text-cream text-sm"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                />
              </div>
            </div>
          </div>

          {/* Model Selection Section */}
          <div>
            <h3 className="text-base text-mint mb-3" style={{ fontFamily: "'Inter', sans-serif" }}>
              Model Selection
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-cream/70 mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
                  🔍 Explain Mode
                </label>
                <select
                  value={settings.models.explain}
                  onChange={(e) => setSettings({ 
                    ...settings, 
                    models: { ...settings.models, explain: e.target.value }
                  })}
                  className="w-full px-3 py-2 bg-slate/50 border border-teal/20 rounded text-cream text-sm"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {allModels.map(model => (
                    <option key={model.value} value={model.value}>{model.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-cream/70 mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
                  💥 Impact Mode
                </label>
                <select
                  value={settings.models.impact}
                  onChange={(e) => setSettings({ 
                    ...settings, 
                    models: { ...settings.models, impact: e.target.value }
                  })}
                  className="w-full px-3 py-2 bg-slate/50 border border-teal/20 rounded text-cream text-sm"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {allModels.map(model => (
                    <option key={model.value} value={model.value}>{model.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-cream/70 mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
                  🏥 Triage Mode
                </label>
                <select
                  value={settings.models.triage}
                  onChange={(e) => setSettings({ 
                    ...settings, 
                    models: { ...settings.models, triage: e.target.value }
                  })}
                  className="w-full px-3 py-2 bg-slate/50 border border-teal/20 rounded text-cream text-sm"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {allModels.map(model => (
                    <option key={model.value} value={model.value}>{model.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-cream/70 mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
                  🔧 Transform Mode
                </label>
                <select
                  value={settings.models.transform}
                  onChange={(e) => setSettings({ 
                    ...settings, 
                    models: { ...settings.models, transform: e.target.value }
                  })}
                  className="w-full px-3 py-2 bg-slate/50 border border-teal/20 rounded text-cream text-sm"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {allModels.map(model => (
                    <option key={model.value} value={model.value}>{model.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="text-xs text-cream/50 bg-slate/30 p-3 rounded" style={{ fontFamily: "'Inter', sans-serif" }}>
            💡 Settings are stored locally in your browser. API keys are never sent to IntelliMap servers.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-teal/20 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-cream/70 hover:text-cream transition-colors text-sm"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-teal/20 hover:bg-teal/30 text-teal rounded transition-colors text-sm"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;

