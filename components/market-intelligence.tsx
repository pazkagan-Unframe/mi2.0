"use client"

/**
 * Market intelligence wrapper — pairs a local scope picker (markets +
 * submarkets) with two tabs:
 *
 *   1. "Portfolio vs market"  — how the broker's own leases compare to the
 *      market in the selected scope. Renders the geographic MarketMap (which
 *      already plots gap by submarket) so the picker drives both.
 *   2. "Market analysis"      — pure market context: size mix, vacancy,
 *      supply/demand, leasing volume, asking-vs-achieved, etc.
 *
 * The scope is *local* — it does not mutate the global Filters used by the
 * portfolio dashboard above. By default every market the broker has at least
 * one lease in is selected, so the section opens already populated. The user
 * can narrow to a single city or submarket; the children re-derive everything
 * from the filtered row set.
 */

import { useMemo, useRef, useState, useEffect } from "react"
import type { LeaseRow } from "@/lib/types"
import { MarketAnalysis } from "@/components/market-analysis"
import { MarketMap } from "@/components/market-map"

type Tab = "portfolio-vs-market" | "market-analysis"

type Props = {
  rows: LeaseRow[]
  /**
   * When this component is rendered as a top-level page mode (the "Market
   * browser" tab), the outer card chrome and intro header are unnecessary —
   * the page tab already frames it. Pass `chromeless` to render just the
   * scope picker, sub-tabs and body.
   */
  chromeless?: boolean
}

export function MarketIntelligence({ rows, chromeless = false }: Props) {
  // Available markets / submarkets derived from the parent rows. Each market
  // carries the count of leases in scope so the picker can show density.
  const markets = useMemo(() => {
    const m = new Map<string, { city: string; state: string; count: number }>()
    for (const r of rows) {
      const key = `${r.city}, ${r.state}`
      const cur = m.get(key)
      if (cur) cur.count++
      else m.set(key, { city: r.city, state: r.state, count: 1 })
    }
    return [...m.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
  }, [rows])

  const submarketsByMarket = useMemo(() => {
    const m = new Map<string, Map<string, number>>()
    for (const r of rows) {
      const mk = `${r.city}, ${r.state}`
      let inner = m.get(mk)
      if (!inner) {
        inner = new Map()
        m.set(mk, inner)
      }
      inner.set(r.submarket, (inner.get(r.submarket) ?? 0) + 1)
    }
    return m
  }, [rows])

  // Default scope: every market the portfolio touches, with no submarket
  // narrowing (interpreted as "all submarkets in the selected markets").
  const allMarketKeys = useMemo(() => markets.map((m) => m.key), [markets])
  const [selectedMarkets, setSelectedMarkets] = useState<Set<string>>(
    () => new Set(allMarketKeys),
  )
  const [selectedSubmarkets, setSelectedSubmarkets] = useState<Set<string>>(
    () => new Set(),
  )

  // If the upstream portfolio shifts so a previously-selected market is gone,
  // drop it. Add brand-new markets to the selection so the section keeps its
  // "everything by default" feel rather than going empty on filter changes.
  useEffect(() => {
    setSelectedMarkets((prev) => {
      const next = new Set<string>()
      for (const k of allMarketKeys) {
        if (prev.size === 0 || prev.has(k)) next.add(k)
      }
      // If the previous set was non-empty but now empty (no overlap), reset.
      if (next.size === 0) for (const k of allMarketKeys) next.add(k)
      return next
    })
    setSelectedSubmarkets((prev) => {
      const validSubs = new Set<string>()
      for (const m of submarketsByMarket.values()) {
        for (const s of m.keys()) validSubs.add(s)
      }
      const next = new Set<string>()
      for (const s of prev) if (validSubs.has(s)) next.add(s)
      return next
    })
  }, [allMarketKeys, submarketsByMarket])

  // Filter rows by the local scope before passing to children.
  const scopedRows = useMemo(() => {
    return rows.filter((r) => {
      const mk = `${r.city}, ${r.state}`
      if (!selectedMarkets.has(mk)) return false
      if (selectedSubmarkets.size > 0 && !selectedSubmarkets.has(r.submarket)) {
        return false
      }
      return true
    })
  }, [rows, selectedMarkets, selectedSubmarkets])

  const [tab, setTab] = useState<Tab>("portfolio-vs-market")

  const allMarketsSelected =
    selectedMarkets.size === allMarketKeys.length && allMarketKeys.length > 0
  const marketsLabel = allMarketsSelected
    ? `All markets (${allMarketKeys.length})`
    : selectedMarkets.size === 0
      ? "Select markets"
      : selectedMarkets.size === 1
        ? [...selectedMarkets][0]
        : `${selectedMarkets.size} markets selected`

  const allSubsForSelected = useMemo(() => {
    const set = new Set<string>()
    for (const mk of selectedMarkets) {
      const inner = submarketsByMarket.get(mk)
      if (inner) for (const s of inner.keys()) set.add(s)
    }
    return [...set].sort()
  }, [selectedMarkets, submarketsByMarket])

  const submarketsLabel =
    selectedSubmarkets.size === 0
      ? `All submarkets (${allSubsForSelected.length})`
      : selectedSubmarkets.size === 1
        ? [...selectedSubmarkets][0]
        : `${selectedSubmarkets.size} submarkets selected`

  return (
    <section className={chromeless ? "mi-card mi-card-bare" : "card mi-card"}>
      {!chromeless && (
        <header className="card-header mi-card-header">
          <div>
            <div className="card-title">Market intelligence</div>
            <div className="card-sub">
              Choose your markets and submarkets, then switch between portfolio
              comparison and pure market analysis.
            </div>
          </div>
        </header>
      )}

      <div className="mi-scope-bar">
        <ScopePicker
          label="Markets"
          placeholder="All markets"
          buttonLabel={marketsLabel}
          options={markets.map((m) => ({
            key: m.key,
            label: m.key,
            count: m.count,
          }))}
          selected={selectedMarkets}
          onToggle={(k) =>
            setSelectedMarkets((prev) => {
              const next = new Set(prev)
              if (next.has(k)) next.delete(k)
              else next.add(k)
              // If the user emptied markets, also clear submarkets so the
              // panel doesn't sit in an inconsistent state.
              if (next.size === 0) setSelectedSubmarkets(new Set())
              return next
            })
          }
          onSelectAll={() => setSelectedMarkets(new Set(allMarketKeys))}
          onClear={() => {
            setSelectedMarkets(new Set())
            setSelectedSubmarkets(new Set())
          }}
        />
        <ScopePicker
          label="Submarkets"
          placeholder="All submarkets"
          buttonLabel={submarketsLabel}
          options={allSubsForSelected.map((s) => {
            // Sum lease count across the currently-selected markets.
            let count = 0
            for (const mk of selectedMarkets) {
              const inner = submarketsByMarket.get(mk)
              if (inner) count += inner.get(s) ?? 0
            }
            return { key: s, label: s, count }
          })}
          selected={selectedSubmarkets}
          onToggle={(k) =>
            setSelectedSubmarkets((prev) => {
              const next = new Set(prev)
              if (next.has(k)) next.delete(k)
              else next.add(k)
              return next
            })
          }
          onSelectAll={() => setSelectedSubmarkets(new Set(allSubsForSelected))}
          onClear={() => setSelectedSubmarkets(new Set())}
          disabled={selectedMarkets.size === 0}
        />
        <div className="mi-scope-meta">
          <span className="mi-scope-meta-num">{scopedRows.length}</span>
          <span className="mi-scope-meta-label">
            {scopedRows.length === 1 ? "lease in scope" : "leases in scope"}
          </span>
        </div>
      </div>

      <div className="mi-tabs" role="tablist" aria-label="Market intelligence view">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "portfolio-vs-market"}
          className={`mi-tab${tab === "portfolio-vs-market" ? " on" : ""}`}
          onClick={() => setTab("portfolio-vs-market")}
        >
          <span className="mi-tab-label">Portfolio</span>
          <span className="mi-tab-sub">Your leases benchmarked against comps</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "market-analysis"}
          className={`mi-tab${tab === "market-analysis" ? " on" : ""}`}
          onClick={() => setTab("market-analysis")}
        >
          <span className="mi-tab-label">Market analysis</span>
          <span className="mi-tab-sub">Vacancy, supply, demand & rent trends</span>
        </button>
      </div>

      <div className="mi-tab-body" role="tabpanel">
        {scopedRows.length === 0 ? (
          <div className="mi-empty">
            No leases in scope. Add a market or submarket to see analysis.
          </div>
        ) : tab === "portfolio-vs-market" ? (
          <MarketMap rows={scopedRows} />
        ) : (
          <MarketAnalysis rows={scopedRows} />
        )}
      </div>
    </section>
  )
}

/* ---------------- Scope picker (multi-select dropdown) ---------------- */

type ScopeOption = { key: string; label: string; count: number }

function ScopePicker({
  label,
  placeholder,
  buttonLabel,
  options,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  disabled = false,
}: {
  label: string
  placeholder: string
  buttonLabel: string
  options: ScopeOption[]
  selected: Set<string>
  onToggle: (key: string) => void
  onSelectAll: () => void
  onClear: () => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const wrapRef = useRef<HTMLDivElement>(null)

  // Close on outside click / Escape — the picker is a true popover, not a
  // modal, so brokers can keep typing in surrounding controls.
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q))
    : options

  return (
    <div className="mi-scope-field" ref={wrapRef}>
      <label className="mi-scope-label">{label}</label>
      <button
        type="button"
        className={`mi-scope-trigger${open ? " open" : ""}${disabled ? " disabled" : ""}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="mi-scope-value">
          {options.length === 0 ? placeholder : buttonLabel}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          className="mi-scope-caret"
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="mi-scope-pop" role="listbox" aria-multiselectable="true">
          <div className="mi-scope-search">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              autoFocus
            />
          </div>
          <div className="mi-scope-actions">
            <button type="button" className="mi-scope-action" onClick={onSelectAll}>
              Select all
            </button>
            <button type="button" className="mi-scope-action" onClick={onClear}>
              Clear
            </button>
          </div>
          <ul className="mi-scope-list">
            {filtered.length === 0 ? (
              <li className="mi-scope-empty">No matches</li>
            ) : (
              filtered.map((o) => {
                const checked = selected.has(o.key)
                return (
                  <li key={o.key}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={checked}
                      className={`mi-scope-opt${checked ? " on" : ""}`}
                      onClick={() => onToggle(o.key)}
                    >
                      <span
                        className="mi-scope-check"
                        aria-hidden="true"
                        data-checked={checked}
                      >
                        {checked && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path
                              d="M2 5.5L4 7.5L8 3"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      <span className="mi-scope-opt-label">{o.label}</span>
                      <span className="mi-scope-opt-count">{o.count}</span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
