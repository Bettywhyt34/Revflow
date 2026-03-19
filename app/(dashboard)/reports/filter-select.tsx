'use client'

export default function FilterSelect({
  name,
  defaultValue,
  placeholder,
  options,
}: {
  name: string
  defaultValue: string
  placeholder?: string
  options: { value: string; label: string }[]
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="min-h-[44px] px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
      onChange={(e) => {
        const url = new URL(window.location.href)
        if (e.target.value) url.searchParams.set(name, e.target.value)
        else url.searchParams.delete(name)
        window.location.href = url.toString()
      }}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}
