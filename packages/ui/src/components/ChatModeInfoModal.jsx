const ChatModeInfoModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const modes = [
    {
      icon: '🔍',
      name: 'Explain',
      description: 'Understand how code works',
      useCases: [
        'How does authentication work in this codebase?',
        'What does the payment processing flow look like?',
        'Explain the data flow from API to UI',
        'How are errors handled in this module?'
      ],
      bestFor: 'Understanding existing code, learning the codebase, onboarding new developers'
    },
    {
      icon: '💥',
      name: 'Impact',
      description: 'Analyze the impact of changes',
      useCases: [
        'What would break if I change this function signature?',
        'Which files depend on this module?',
        'What\'s the blast radius of refactoring this class?',
        'How many files would be affected by this API change?'
      ],
      bestFor: 'Planning refactors, assessing risk, understanding dependencies'
    },
    {
      icon: '🏥',
      name: 'Triage',
      description: 'Prioritize issues and technical debt',
      useCases: [
        'Which files should I refactor first?',
        'What are the biggest hotspots in the codebase?',
        'Which modules have the highest complexity?',
        'What files change most frequently?'
      ],
      bestFor: 'Code quality improvement, technical debt management, sprint planning'
    },
    {
      icon: '🔧',
      name: 'Transform',
      description: 'Get refactoring suggestions',
      useCases: [
        'How can I simplify this complex function?',
        'Suggest a better architecture for this module',
        'How should I split this large file?',
        'What design patterns would improve this code?'
      ],
      bestFor: 'Refactoring guidance, code improvement, architectural decisions'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-navy border border-teal/30 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-teal/20">
          <h2 className="text-xl text-cream" style={{ fontFamily: "'Inter', sans-serif" }}>
            💬 Chat Modes
          </h2>
          <p className="text-sm text-cream/60 mt-1" style={{ fontFamily: "'Inter', sans-serif" }}>
            Choose the right mode for your question to get the best results
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {modes.map((mode, index) => (
            <div key={index} className="bg-slate/30 border border-teal/10 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">{mode.icon}</div>
                <div className="flex-1">
                  <h3 className="text-base text-mint mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
                    {mode.name}
                  </h3>
                  <p className="text-sm text-cream/70 mb-3" style={{ fontFamily: "'Inter', sans-serif" }}>
                    {mode.description}
                  </p>
                  
                  <div className="mb-3">
                    <p className="text-xs text-cream/50 mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                      Example questions:
                    </p>
                    <ul className="space-y-1">
                      {mode.useCases.map((useCase, i) => (
                        <li key={i} className="text-xs text-cream/60 pl-4" style={{ fontFamily: "'Inter', sans-serif" }}>
                          • {useCase}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="bg-navy/50 rounded px-3 py-2">
                    <p className="text-xs text-teal" style={{ fontFamily: "'Inter', sans-serif" }}>
                      <span className="text-cream/50">Best for:</span> {mode.bestFor}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-teal/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-teal/20 hover:bg-teal/30 text-teal rounded transition-colors text-sm"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatModeInfoModal;

