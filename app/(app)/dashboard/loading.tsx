export default function Loading() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading">
      <div className="grid gap-2"><div className="skeleton h-3 w-24" /><div className="skeleton h-8 w-72" /></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
      <div className="grid gap-3 md:grid-cols-2">{[0, 1].map((i) => <div key={i} className="skeleton h-56 rounded-2xl" />)}</div>
    </div>
  );
}
