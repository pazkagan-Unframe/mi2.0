"use client"

/**
 * Market analysis section. Hosts a local scope picker (markets + submarkets)
 * and renders the twelve-widget MarketAnalysis view inside that scope.
 *
 * Default scope = every market the broker's portfolio currently touches
 * (derived from `portfolioRows`). The user can narrow that scope or widen
 * it by adding comparable markets that aren't in the portfolio (sourced
 * from EXTRA_MARKETS below). Submarkets are restricted to whatever exists
 * in the selected markets that come from the portfolio — added markets
 * don't carry submarket data in this prototype.
 *
 * The scope is local: the page-level FilterBar above is unchanged.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import type { LeaseRow } from "@/lib/types"
import { MarketAnalysis } from "@/components/market-analysis"

type Props = {
  /**
   * Rows reflecting the broker's current portfolio (already filtered by the
   * global FilterBar). Drives the default market selection and provides the
   * underlying lease data for rows-derived widgets.
   */
  portfolioRows: LeaseRow[]
}

/**
 * Comparable markets the user can widen into. These have no portfolio leases
 * — selecting them affects synthetic series (vacancy, supply/demand, etc.)
 * but does not add rows to the lease-derived widgets.
 */
const EXTRA_MARKETS: { city: string; state: string }[] = [
  { city: "Houston", state: "TX" },
  { city: "Austin", state: "TX" },
  { city: "Phoenix", state: "AZ" },
  { city: "Denver", state: "CO" },
  { city: "Nashville", state: "TN" },
  { city: "Charlotte", state: "NC" },
  { city: "Minneapolis", state: "MN" },
  { city: "Portland", state: "OR" },
  { city: "San Diego", state: "CA" },
  { city: "Detroit", state: "MI" },
]

export function MarketIntelligence({ portfolioRows }: Props) {
  // ---- Markets in the portfolio ----
  const portfolioMarkets = useMemo(() => {
    const m = new Map<string, { city: string; state: string; count: number }>()
    for (const r of portfolioRows) {
      const key = `${r.city}, ${r.state}`
      const cur = m.get(key)
      if (cur) cur.count++
      else m.set(key, { city: r.city, state: r.state, count: 1 })
    }
    return [...m.entries()]
      .map(([key, v]) => ({ key, ...v, fromPortfolio: true as const }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
  }, [portfolioRows])

  const portfolioMarketKeys = useMemo(
    () => portfolioMarkets.map((m) => m.key),
    [portfolioMarkets],
  )
  const portfolioMarketSet = useMemo(
    () => new Set(portfolioMarketKeys),
    [portfolioMarketKeys],
  )

  // Comparable markets the user can add — filter out any that happen to
  // already be in the portfolio (defensive, e.g. if SAMPLE_LEASES grows).
  const extraMarkets = useMemo(
    () =>
      EXTRA_MARKETS.map((m) => ({
        key: `${m.city}, ${m.state}`,
        city: m.city,
        state: m.state,
        count: 0,
        fromPortfolio: false as const,
      })).filter((m) => !portfolioMarketSet.has(m.key)),
    [portfolioMarketSet],
  )

  const allMarketOptions = useMemo(
    () => [...portfolioMarkets, ...extraMarkets],
    [portfolioMarkets, extraMarkets],
  )

  // Submarkets exist only inside portfolio markets.
  const submarketsByMarket = useMemo(() => {
    const m = new Map<string, Map<string, number>>()
    for (const r of portfolioRows) {
      const mk = `${r.city}, ${r.state}`
      let inner = m.get(mk)
      if (!inner) {
        inner = new Map()
        m.set(mk, inner)
      }
      inner.set(r.submarket, (inner.get(r.submarket) ?? 0) + 1)
    }
    return m
  }, [portfolioRows])

  // ---- Selection state ----
  // Defaults to every portfolio market. No submarket narrowing by default
  // (interpreted as "all submarkets in the selected portfolio markets").
  const [selectedMarkets, setSelectedMarkets] = useState<Set<string>>(
    () => new Set(portfolioMarketKeys),
  )
  const [selectedSubmarkets, setSelectedSubmarkets] = useState<Set<string>>(
    () => new Set(),
  )

  // Track the previous portfolio set so we can detect newly-added markets
  // (and auto-include them) without resetting the user's manual choices.
  const prevPortfolioRef = useRef<Set<string>>(portfolioMarketSet)
  useEffect(() => {
    const prev = prevPortfolioRef.current
    const curr = portfolioMarketSet

    setSelectedMarkets((sel) => {
      const next = new Set(sel)
      // Drop selections that are no longer valid (gone from both portfolio
      // and extras) — extras are stable so this only affects portfolio rows
      // that disappeared due to upstream filtering.
      const validKeys = new Set([
        ...curr,
        ...extraMarkets.map((m) => m.key),
      ])
      for (const k of [...next]) if (!validKeys.has(k)) next.delete(k)

      // Auto-add brand-new portfolio markets so the section keeps reflecting
      // the broker's current portfolio scope by default.
      for (const k of curr) if (!prev.has(k)) next.add(k)

      // If the selection went empty (e.g. portfolio scope shrank to zero),
      // fall back to whatever portfolio still has so the section isn't blank.
      if (next.size === 0) for (const k of curr) next.add(k)

      return next
    })

    setSelectedSubmarkets((subs) => {
      const valid = new Set<string>()
      for (const inner of submarketsByMarket.values()) {
        for (const s of inner.keys()) valid.add(s)
      }
      const next = new Set<string>()
      for (const s of subs) if (valid.has(s)) next.add(s)
      return next
    })

    prevPortfolioRef.current = curr
  }, [portfolioMarketSet, extraMarkets, submarketsByMarket])

  // ---- Derived rows for the analysis ----
  // Widgets that derive from real leases use the rows that fall inside the
  // selection. Widgets that synthesise from market keys use selectedMarkets
  // directly — that's what makes added markets affect supply/vacancy/etc.
  const scopedRows = useMemo(() => {
    return portfolioRows.filter((r) => {
      const mk = `${r.city}, ${r.state}`
      if (!selectedMarkets.has(mk)) return false
      if (selectedSubmarkets.size > 0 && !selectedSubmarkets.has(r.submarket)) {
        return false
      }
      return true
    })
  }, [portfolioRows, selectedMarkets, selectedSubmarkets])

  // ---- Labels ----
  const portfolioSelected = useMemo(() => {
    let n = 0
    for (const k of selectedMarkets) if (portfolioMarketSet.has(k)) n++
    return n
  }, [selectedMarkets, portfolioMarketSet])
  const extraSelected = selectedMarkets.size - portfolioSelected

  const marketsLabel = (() => {
    if (selectedMarkets.size === 0) return "Select markets"
    if (selectedMarkets.size === 1) return [...selectedMarkets][0]
    if (
      portfolioSelected === portfolioMarketKeys.length &&
      extraSelected === 0 &&
      portfolioMarketKeys.length > 0
    ) {
      return `Portfolio markets (${portfolioMarketKeys.length})`
    }
    if (extraSelected > 0) {
      return `${selectedMarkets.size} markets · +${extraSelected} added`
    }
    return `${selectedMarkets.size} markets selected`
  })()

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

  // Reset back to the current portfolio scope. Useful after the user has
  // added/removed markets and wants to get back to the default.
  const resetToPortfolio = () => {
    setSelectedMarkets(new Set(portfolioMarketKeys))
    setSelectedSubmarkets(new Set())
  }
  const isCustomScope =
    extraSelected > 0 ||
    portfolioSelected !== portfolioMarketKeys.length ||
    selectedSubmarkets.size > 0

  return (
    <section className="mi-card mi-card-bare">
      <div className="mi-scope-bar">
        <ScopePicker
          label="Markets"
          placeholder="All markets"
          buttonLabel={marketsLabel}
          options={allMarketOptions.map((m) => ({
            key: m.key,
            label: m.key,
            count: m.count,
            group: m.fromPortfolio ? "Your portfolio" : "Add comparable markets",
          }))}
          selected={selectedMarkets}
          onToggle={(k) =>
            setSelectedMarkets((prev) => {
              const next = new Set(prev)
              if (next.has(k)) next.delete(k)
              else next.add(k)
              if (next.size === 0) setSelectedSubmarkets(new Set())
              return next
            })
          }
          onSelectAll={() =>
            setSelectedMarkets(new Set(allMarketOptions.map((m) => m.key)))
          }
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
        <div className="mi-scope-actions-inline">
          {isCustomScope && (
            <button
              type="button"
              className="mi-scope-reset"
              onClick={resetToPortfolio}
              title="Reset to your portfolio's markets"
            >
              Reset to portfolio
            </button>
          )}
          <div className="mi-scope-meta">
            <span className="mi-scope-meta-num">{selectedMarkets.size}</span>
            <span className="mi-scope-meta-label">
              {selectedMarkets.size === 1 ? "market" : "markets"}
            </span>
          </div>
        </div>
      </div>

      <div className="mi-tab-body" role="tabpanel">
        {selectedMarkets.size === 0 ? (
          <div className="mi-empty">
            No markets selected. Choose at least one market to see analysis.
          </div>
        ) : (
          <MarketAnalysis rows={scopedRows} marketKeys={[...selectedMarkets]} />
        )}
      </div>
    </section>
  )
}

/* ---------------- Scope picker ---------------- */

type ScopeOption = {
  key: string
  label: string
  count: number
  /** Optional group label for sectioning the option list. */
  group?: string
}

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

  // Group while preserving order.
  const grouped: { group: string | undefined; items: ScopeOption[] }[] = []
  for (const o of filtered) {
    const last = grouped[grouped.length - 1]
    if (last && last.group === o.group) last.items.push(o)
    else grouped.push({ group: o.group, items: [o] })
  }

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
              placeholder={`Search ${label.toLowerCase()}...`}
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
              grouped.map((g, gi) => (
                <li key={`g-${gi}-${g.group ?? "all"}`}>
                  {g.group && <div className="mi-scope-group">{g.group}</div>}
                  <ul className="mi-scope-sublist">
                    {g.items.map((o) => {
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
                                <svg
                                  width="10"
                                  height="10"
                                  viewBox="0 0 10 10"
                                  fill="none"
                                >
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
                            <span className="mi-scope-opt-count">
                              {o.count > 0 ? o.count : "—"}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
