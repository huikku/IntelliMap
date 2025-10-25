export default function PlaneSwitcher({ plane, setPlane }) {
  return (
    <div className="flex gap-1">
      <button
        onClick={() => setPlane('static')}
        className={`px-3 py-1 rounded text-sm ${
          plane === 'static'
            ? 'bg-green-600 text-white'
            : 'bg-[#0a0a0a] text-[#a0a0a0] hover:bg-[#1a1a1a]'
        }`}
      >
        Static
      </button>
      <button
        onClick={() => setPlane('backend')}
        className={`px-3 py-1 rounded text-sm ${
          plane === 'backend'
            ? 'bg-purple-600 text-white'
            : 'bg-[#0a0a0a] text-[#a0a0a0] hover:bg-[#1a1a1a]'
        }`}
      >
        Backend
      </button>
      <button
        onClick={() => setPlane('diff')}
        className={`px-3 py-1 rounded text-sm ${
          plane === 'diff'
            ? 'bg-red-600 text-white'
            : 'bg-[#0a0a0a] text-[#a0a0a0] hover:bg-[#1a1a1a]'
        }`}
      >
        Diff
      </button>
    </div>
  );
}

