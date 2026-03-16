'use client'

import React from 'react'
import type { TemplateId } from './template-types'

// ── Template Thumbnail ───────────────────────────────────────────────────────
// Small visual previews of each template style.
// Used in Settings → Documents → Document Templates.

interface Props {
  templateId: TemplateId
  primaryColor: string
  active?: boolean
}

export default function TemplateThumbnail({ templateId, primaryColor: pc, active }: Props) {
  const ring = active ? `ring-2 ring-offset-1` : 'ring-1 ring-gray-200'

  if (templateId === '1') {
    // QVT Classic: colored divider, colored header row
    return (
      <div
        className={`w-[88px] h-[60px] bg-white rounded overflow-hidden ${ring} cursor-pointer`}
        style={active ? { outline: `2px solid ${pc}`, outlineOffset: '1px' } : {}}
      >
        {/* Header row */}
        <div className="flex justify-between items-center px-1.5 py-1">
          <div className="h-2 w-6 rounded-sm bg-gray-300" />
          <div className="h-1.5 w-10 rounded bg-gray-300" />
        </div>
        {/* Divider */}
        <div style={{ height: 2, backgroundColor: pc }} />
        {/* Meta strip */}
        <div className="flex gap-1 px-1.5 py-1">
          {[3, 2, 3].map((w, i) => (
            <div key={i} className="flex-1">
              <div className="h-[3px] w-full rounded bg-gray-200 mb-0.5" />
              <div className="h-[4px] rounded bg-gray-300" style={{ width: `${w * 10}px` }} />
            </div>
          ))}
        </div>
        {/* Table header row */}
        <div className="mx-1.5 flex" style={{ backgroundColor: pc, height: 6, borderRadius: 1 }} />
        {/* Table rows */}
        {[1, 2].map((i) => (
          <div key={i} className="mx-1.5 flex gap-1 border-b border-gray-100 py-0.5">
            <div className="h-[3px] w-3 rounded bg-gray-200" />
            <div className="flex-1 h-[3px] rounded bg-gray-200" />
          </div>
        ))}
      </div>
    )
  }

  if (templateId === '2') {
    // Modern Minimal: thin accent line, grey info band, color-only table headers
    return (
      <div
        className={`w-[88px] h-[60px] bg-white rounded overflow-hidden ${ring} cursor-pointer`}
      >
        {/* Header: small logo + thin title */}
        <div className="flex justify-between items-start px-1.5 pt-1.5 pb-1">
          <div className="h-2 w-5 rounded-sm bg-gray-300" />
          <div className="h-[5px] w-12 rounded bg-gray-400" style={{ letterSpacing: 1 }} />
        </div>
        {/* Thin accent line */}
        <div style={{ height: 1, backgroundColor: pc, marginLeft: 6, marginRight: 6 }} />
        {/* Grey info band */}
        <div className="flex gap-0.5 mx-1.5 my-1 bg-gray-100 rounded px-1 py-0.5">
          {[1, 2, 1].map((_, i) => (
            <div key={i} className="flex-1">
              <div className="h-[2px] w-full rounded bg-gray-300 mb-0.5" />
              <div className="h-[3px] w-full rounded bg-gray-400" />
            </div>
          ))}
        </div>
        {/* Table: color headers, alternating rows, no outer border */}
        <div className="mx-1.5 border-b pb-0.5" style={{ borderColor: pc }}>
          <div className="flex gap-1">
            {[1, 3, 1].map((w, i) => (
              <div key={i} className="h-[3px] rounded" style={{ flex: w, backgroundColor: pc, opacity: 0.7 }} />
            ))}
          </div>
        </div>
        {[true, false, true].map((alt, i) => (
          <div key={i} className="mx-1.5 flex gap-1 border-b border-gray-100 py-0.5" style={alt ? { backgroundColor: '#fafafa' } : {}}>
            <div className="h-[2px] w-2 rounded bg-gray-200" />
            <div className="flex-1 h-[2px] rounded bg-gray-200" />
          </div>
        ))}
      </div>
    )
  }

  // Template 3: Bold Corporate — dark header
  return (
    <div
      className={`w-[88px] h-[60px] rounded overflow-hidden ${ring} cursor-pointer`}
    >
      {/* Dark header */}
      <div
        className="flex justify-between items-center px-1.5 py-1.5"
        style={{ backgroundColor: pc }}
      >
        <div className="h-2 w-5 rounded-sm bg-white/30" />
        <div className="h-[5px] w-10 rounded bg-white/70" />
      </div>
      {/* Body */}
      <div className="bg-white px-1.5 py-1 space-y-0.5">
        {/* Two mini cards */}
        <div className="flex gap-1 mb-1">
          {[0, 1].map((i) => (
            <div key={i} className="flex-1 border border-gray-200 rounded p-0.5">
              <div className="h-[2px] w-full rounded bg-gray-200 mb-0.5" />
              <div className="h-[3px] w-3/4 rounded bg-gray-300" />
            </div>
          ))}
        </div>
        {/* Table header */}
        <div className="flex" style={{ backgroundColor: pc, height: 5, borderRadius: 1 }} />
        {/* Rows */}
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-1 border-b border-gray-100 py-0.5">
            <div className="h-[2px] w-2 rounded bg-gray-200" />
            <div className="flex-1 h-[2px] rounded bg-gray-200" />
          </div>
        ))}
        {/* Footer strip */}
        <div style={{ backgroundColor: pc, height: 4, borderRadius: 1, marginTop: 2 }} />
      </div>
    </div>
  )
}
