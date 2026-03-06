export default function Loading() {
  return (
    <div className="p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <div className="skeleton h-7 w-40" />
          <div className="skeleton h-4 w-24" />
        </div>
        <div className="skeleton h-10 w-72 rounded-xl" />
      </div>
      <div className="skeleton h-12 w-80 rounded-xl mb-6" />
      <div className="table-wrapper">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="td flex items-center gap-4 px-5 py-4">
            <div className="skeleton w-9 h-9 rounded-full flex-shrink-0" />
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-4 w-16 ml-2" />
            <div className="skeleton h-3 w-48 ml-4" />
            <div className="skeleton h-5 w-16 rounded-full ml-auto" />
            <div className="skeleton h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}
