export default function Loading() {
  return (
    <div className="p-8 h-full flex flex-col animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="skeleton h-7 w-24" />
          <div className="skeleton h-4 w-32" />
        </div>
      </div>
      <div className="flex gap-4 flex-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-72 space-y-3">
            <div className="flex items-center justify-between">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-3 w-14" />
            </div>
            {Array.from({ length: 3 + i % 2 }).map((_, j) => (
              <div key={j} className="card-sm space-y-2.5">
                <div className="skeleton h-4 w-36" />
                <div className="skeleton h-3 w-24" />
                <div className="skeleton h-3 w-16" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
