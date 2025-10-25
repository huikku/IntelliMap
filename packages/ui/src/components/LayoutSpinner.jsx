export default function LayoutSpinner({ isVisible }) {
  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center pointer-events-none z-50">
      <div className="bg-[#000000] border border-[#2a2a2a] rounded-lg p-6 flex flex-col items-center gap-4">
        {/* Spinner */}
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-[#2a2a2a] rounded-full"></div>
          <div className="absolute inset-0 border-4 border-transparent border-t-orange-400 border-r-orange-400 rounded-full animate-spin"></div>
        </div>
        
        {/* Text */}
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-200">Calculating layout...</p>
          <p className="text-xs text-[#6a6a6a] mt-1">This may take a moment</p>
        </div>
      </div>
    </div>
  );
}

