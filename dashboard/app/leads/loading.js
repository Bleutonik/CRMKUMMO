export default function Loading() {
  return (
    <div className="p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <div className="skeleton h-7 w-20" />
          <div className="skeleton h-4 w-28" />
        </div>
        <div className="flex gap-3">
          <div className="skeleton h-10 w-40 rounded-xl" />
          <div className="skeleton h-10 w-56 rounded-xl" />
        </div>
      </div>
      <div className="table-wrapper">
        <div className="th flex gap-6 px-5 py-3.5">
          {['Lead','Contacto','Pipeline','Estado','Valor','Creado','Actividad'].map(h => (
            <div key={h} className="skeleton h-3 w-16" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="td flex items-center gap-6 px-5 py-4">
            <div className="space-y-1.5">
              <div className="skeleton h-4 w-36" />
              <div className="skeleton h-3 w-16" />
            </div>
            <div className="skeleton h-4 w-28" />
            <div className="skeleton h-4 w-20" />
            <div className="skeleton h-5 w-20 rounded-full" />
            <div className="skeleton h-4 w-16" />
            <div className="skeleton h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
