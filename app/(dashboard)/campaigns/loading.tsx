export default function CampaignsLoading() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-5 animate-pulse overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 bg-gray-200 rounded-lg" />
        <div className="h-10 w-32 bg-gray-200 rounded-lg" />
      </div>

      {/* Filter bar */}
      <div className="flex gap-3">
        <div className="h-10 w-36 bg-gray-200 rounded-lg" />
        <div className="h-10 w-36 bg-gray-200 rounded-lg" />
        <div className="h-10 w-36 bg-gray-200 rounded-lg" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="h-12 bg-gray-50 border-b border-gray-100" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-50">
            <div className="h-4 w-20 bg-gray-200 rounded" />
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-200 rounded hidden sm:block" />
            <div className="h-4 w-20 bg-gray-200 rounded hidden md:block" />
            <div className="ml-auto h-6 w-24 bg-gray-200 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
