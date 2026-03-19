export default function ReportsLoading() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6 animate-pulse overflow-x-hidden">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-32 bg-gray-200 rounded-lg" />
        <div className="h-4 w-56 bg-gray-200 rounded" />
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gray-200 rounded-xl" />
              <div className="space-y-1.5">
                <div className="h-4 w-28 bg-gray-200 rounded" />
                <div className="h-3 w-20 bg-gray-200 rounded" />
              </div>
            </div>
            <div className="h-3 w-full bg-gray-200 rounded" />
            <div className="h-3 w-3/4 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
