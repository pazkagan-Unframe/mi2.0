"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { LeaseRow } from "@/lib/types"
import { MIN_COMPS_FOR_SCOPE } from "@/lib/scope-chain"
import { formatPsf } from "@/lib/format"

type Props = {
  row: LeaseRow
  anchorRect: DOMRect | null
  onClose: () => void
  onPickScope: (scopeId: string) => void
  onClearOverride: () => void
  onSetManual: (estimate: number) => void
}

/**
 * Popover anchored to the market $/SF cell in the lease table. Lets the broker
 * see the scope chain backing the system's default market figure, switch to a
 * different scope, type a manual estimate, or clear an override.
 */
export function ScopePopover({
  row,
  anchorRect,
  onClose,
  onPickScope,
  onClearOverride,
  onSetManual,
}: Props) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [manualDraft, setManualDraft] = useState(
    row.brokerOverride && row.brokerOverride.kind === "manual"
      ? String(row.brokerOverride.estimatePsf)
      : "",
  )

  // Position the popover next to the anchor, clamped to the viewport.
  useLayoutEffect(() => {
    if (!anchorRect) return
    const popWidth = 360
    const popHeight = popRef.current?.offsetHeight ?? 360
    const margin = 8

    let left = anchorRect.right - popWidth
    if (left < margin) left = margin
    if (left + popWidth > window.innerWidth - margin)
      left = window.innerWidth - popWidth - margin

    let top = anchorRect.bottom + 6
    if (top + popHeight > window.innerHeight - margin) {
      top = anchorRect.top - popHeight - 6
    }
    if (top < margin) top = margin

    setPos({ left, top })
  }, [anchorRect])

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  if (!anchorRect) return null

  const selectedScopeId =
    row.brokerOverride?.kind === "scope"
      ? row.brokerOverride.scopeId
      : row.defaultScopeId
  const isManualSelected = row.brokerOverride?.kind === "manual"

  const commitManual = () => {
    const trimmed = manualDraft.trim()
    if (trimmed === "") return
    const parsed = Number.parseFloat(trimmed)
    if (Number.isFinite(parsed) && parsed > 0) {
      onSetManual(parsed)
    }
  }

  return (
    <>
      <div className="scope-popover-overlay" onClick={onClose} />
      <div
        className="scope-popover"
        ref={popRef}
        style={pos ? { left: pos.left, top: pos.top } : { visibility: "hidden" }}
        role="dialog"
        aria-label="Choose comp scope"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="scope-popover-header">
          <div className="scope-popover-title">Comp set for this lease</div>
          <div className="scope-popover-sub">
            {row.address} · {row.propertyType} · {row.submarket}
          </div>
        </div>

        {row.fellBack && (
          <div className="scope-popover-fallback">
            <span aria-hidden="true">⚠</span>
            <span>
              Narrowest scope had fewer than {MIN_COMPS_FOR_SCOPE} comps. Using a
              wider scope by default.
            </span>
          </div>
        )}

        <div className="scope-popover-list">
          {row.scopes.map((s) => {
            const isSelected = !isManualSelected && s.id === selectedScopeId
            const isSystemDefault = s.id === row.defaultScopeId
            const isTooNarrow = s.compCount < MIN_COMPS_FOR_SCOPE
            return (
              <button
                key={s.id}
                type="button"
                className={`scope-option${isSelected ? " selected" : ""}`}
                onClick={() => {
                  if (isSystemDefault && !row.brokerOverride) {
                    onClose()
                    return
                  }
                  onPickScope(s.id)
                }}
                disabled={isTooNarrow && !isSelected}
                style={isTooNarrow && !isSelected ? { opacity: 0.5 } : undefined}
              >
                <span className="scope-option-radio" />
                <span className="scope-option-body">
                  <span className="scope-option-label">
                    {s.label}
                    {isSystemDefault && <span className="badge">System default</span>}
                  </span>
                  <span className="scope-option-meta">
                    <span>
                      {s.compCount} {s.compCount === 1 ? "comp" : "comps"}
                    </span>
                    <span className={`conf ${confClass(s.confidence)}`}>{s.confidence}</span>
                    {isTooNarrow && <span style={{ color: "var(--text-3)" }}>not enough comps</span>}
                  </span>
                </span>
                <span className="scope-option-rent">{formatPsf(s.rentPsf)}</span>
              </button>
            )
          })}
        </div>

        <div className="scope-popover-manual">
          <div className="scope-popover-manual-label">
            {isManualSelected ? "Broker estimate (active)" : "Or type your own estimate"}
          </div>
          <div className="scope-popover-manual-row">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="$/SF"
              value={manualDraft}
              onChange={(e) => setManualDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  commitManual()
                  onClose()
                }
              }}
            />
            <button type="button" onClick={() => { commitManual(); onClose() }}>
              {isManualSelected ? "Update" : "Apply"}
            </button>
          </div>
          {row.brokerOverride && (
            <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  onClearOverride()
                  onClose()
                }}
              >
                Reset to system default
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function confClass(c: "high" | "medium" | "low"): string {
  if (c === "high") return "high"
  if (c === "medium") return "med"
  return "low"
}
