export default function LayoutProgressModal({ isVisible, layoutName, progress, message, details }) {
  if (!isVisible) return null;

  const progressPercent = Math.round(progress * 100);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center pointer-events-auto z-50">
      <div className="bg-navy border border-slate rounded-lg p-8 w-96 shadow-2xl">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-cream mb-2">Computing Layout</h2>
          <p className="text-sm text-mint">
            {layoutName ? `Layout: ${layoutName}` : 'Initializing...'}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-[#6a6a6a]">Progress</span>
            <span className="text-xs font-mono text-orange-400">{progressPercent}%</span>
          </div>
          <div className="w-full h-2 bg-[#2F5060] rounded-full overflow-hidden border border-[#5F9B8C]/30">
            <div
              className="h-full bg-gradient-to-r from-[#5F9B8C] to-[#7BAEA2] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Main Message */}
        <div className="mb-4 p-3 bg-[#2F5060] rounded border border-[#5F9B8C]/30">
          <p className="text-sm text-[#F6DA80] font-mono">{message}</p>
        </div>

        {/* Details */}
        {details && (
          <div className="mb-4 p-3 bg-[#2F5060] rounded border border-[#5F9B8C]/30 max-h-32 overflow-y-auto">
            <p className="text-xs text-[#7BAEA2] font-mono whitespace-pre-wrap">{details}</p>
          </div>
        )}

        {/* Spinner */}
        <div className="flex justify-center">
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 border-2 border-[#2a2a2a] rounded-full"></div>
            <div className="absolute inset-0 border-2 border-transparent border-t-orange-400 border-r-orange-400 rounded-full animate-spin"></div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-500 text-center mt-4">
          This may take a moment for large graphs...
        </p>
      </div>
    </div>
  );
}

