export default function DashboardLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6 animate-pulse overflow-x-hidden">
      {/* KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-muted rounded-lg h-20" />
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-muted rounded-lg h-12" />

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-muted rounded-lg h-64" />
        <div className="bg-muted rounded-lg h-64" />
      </div>

      {/* Table */}
      <div className="bg-muted rounded-lg h-48" />

      {/* Queue + compliance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-muted rounded-lg h-64" />
        <div className="bg-muted rounded-lg h-64" />
      </div>
    </div>
  )
}
