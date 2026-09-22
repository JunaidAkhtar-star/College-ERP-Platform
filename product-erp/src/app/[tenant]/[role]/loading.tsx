export default function WorkspacePageLoading() {
  return (
    <div className="animate-pulse space-y-5" role="status" aria-label="Loading page">
      <div className="h-8 w-52 rounded-lg bg-slate-200/80" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 rounded-2xl bg-white" />
        ))}
      </div>
      <div className="h-72 rounded-2xl bg-white" />
      <span className="sr-only">Loading workspace page…</span>
    </div>
  );
}
