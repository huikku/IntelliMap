export default function PlaneSwitcher({ plane, setPlane }) {
  return (
    <div className="flex gap-1">
      <button
        onClick={() => setPlane('static')}
        className={`px-3 py-1 rounded text-sm border ${
          plane === 'static'
            ? 'bg-sage text-white border-sage'
            : 'bg-slate text-cream hover:bg-teal/20 border-teal/30 hover:border-teal'
        }`}
      >
        Static
      </button>
      <button
        onClick={() => setPlane('backend')}
        className={`px-3 py-1 rounded text-sm border ${
          plane === 'backend'
            ? 'bg-teal text-white border-teal'
            : 'bg-slate text-cream hover:bg-teal/20 border-teal/30 hover:border-teal'
        }`}
      >
        Backend
      </button>
      <button
        onClick={() => setPlane('diff')}
        className={`px-3 py-1 rounded text-sm border ${
          plane === 'diff'
            ? 'bg-orange text-white border-orange'
            : 'bg-slate text-cream hover:bg-teal/20 border-teal/30 hover:border-teal'
        }`}
      >
        Diff
      </button>
    </div>
  );
}

