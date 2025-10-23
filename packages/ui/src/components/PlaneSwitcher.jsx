export default function PlaneSwitcher({ plane, setPlane }) {
  return (
    <div className="flex gap-1">
      <button
        onClick={() => setPlane('static')}
        className={`px-3 py-1 rounded text-sm ${
          plane === 'static'
            ? 'bg-green-600 text-white'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        }`}
      >
        Static
      </button>
      <button
        onClick={() => setPlane('backend')}
        className={`px-3 py-1 rounded text-sm ${
          plane === 'backend'
            ? 'bg-purple-600 text-white'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        }`}
      >
        Backend
      </button>
      <button
        onClick={() => setPlane('diff')}
        className={`px-3 py-1 rounded text-sm ${
          plane === 'diff'
            ? 'bg-red-600 text-white'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        }`}
      >
        Diff
      </button>
    </div>
  );
}

