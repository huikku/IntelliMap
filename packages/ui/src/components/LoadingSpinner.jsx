export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#000000] border border-[#2a2a2a] rounded-lg p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="relative w-16 h-16">
            {/* Outer rotating ring */}
            <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 border-r-blue-500 rounded-full animate-spin"></div>
            
            {/* Middle rotating ring (opposite direction) */}
            <div className="absolute inset-2 border-4 border-transparent border-b-purple-500 border-l-purple-500 rounded-full animate-spin" style={{ animationDirection: 'reverse' }}></div>
            
            {/* Inner pulsing circle */}
            <div className="absolute inset-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse"></div>
          </div>
        </div>
        
        <h2 className="text-xl font-bold text-white mb-2">Processing Repository</h2>
        <p className="text-[#6a6a6a] text-sm">{message}</p>
        
        <div className="mt-4 text-xs text-gray-500">
          <p>This may take a moment for large repositories...</p>
        </div>
      </div>
    </div>
  );
}

