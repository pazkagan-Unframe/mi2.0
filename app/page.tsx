"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { TopBar } from "@/components/top-bar"
import { PageHeader } from "@/components/page-header"
import { FilterBar } from "@/components/filter-bar"
import { PortfolioKpis } from "@/components/portfolio-kpis"
import { PortfolioBreakdown } from "@/components/portfolio-breakdown"
import { LeaseTable } from "@/components/lease-table"
import { MarketMap } from "@/components/market-map"
import { TopVarianceLists } from "@/components/top-variance-lists"
import { MethodologyPanel } from "@/components/methodology-panel"
import { SAMPLE_LEASES } from "@/lib/leases"
import {
  EMPTY_FILTERS,
  aggregate,
  applyFilters,
  buildLeaseRows,
  distinctSubmarkets,
  type Filters,
} from "@/lib/calculations"
import type { BrokerOverrides, PropertyType } from "@/lib/types"

const STORAGE_KEY = "oneadvise:broker-overrides:v1"
// In production this would come from auth — keeping it simple for the prototype.
const BROKER_ID = "pk"

export default function Page() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [overrides, setOverrides] = useState<BrokerOverrides>({})
  const [methodologyOpen, setMethodologyOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate broker overrides from localStorage on mount, scoped per broker.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`${STORAGE_KEY}:${BROKER_ID}`)
      if (raw) {
        const parsed = JSON.parse(raw) as BrokerOverrides
        if (parsed && typeof parsed === "object") setOverrides(parsed)
      }
    } catch {
      // Corrupt or missing — start clean.
    }
    setHydrated(true)
  }, [])

  // Persist on every change after initial hydration.
  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(
        `${STORAGE_KEY}:${BROKER_ID}`,
        JSON.stringify(overrides),
      )
    } catch {
      // Storage unavailable — fail silently in the prototype.
    }
  }, [overrides, hydrated])

  const handleSetEstimate = useCallback((leaseId: string, estimate: number | null) => {
    setOverrides((prev) => {
      if (estimate == null) {
        if (!prev[leaseId]) return prev
        const next = { ...prev }
        delete next[leaseId]
        return next
      }
      return {
        ...prev,
        [leaseId]: {
          estimatePsf: estimate,
          updatedAt: new Date().toISOString(),
        },
      }
    })
  }, [])

  // Everything downstream is computed from overrides + filters.
  const allRows = useMemo(() => buildLeaseRows(SAMPLE_LEASES, overrides), [overrides])
  const filteredRows = useMemo(() => applyFilters(allRows, filters), [allRows, filters])
  const agg = useMemo(() => aggregate(filteredRows), [filteredRows])

  // Filter-bar metadata.
  const propertyTypeCounts = useMemo(() => {
    const m = new Map<PropertyType, number>()
    for (const r of allRows) m.set(r.propertyType, (m.get(r.propertyType) ?? 0) + 1)
    return m
  }, [allRows])

  const submarketCounts = useMemo(() => {
    const m = new Map<string, number>()
    const source = filters.propertyType
      ? allRows.filter((r) => r.propertyType === filters.propertyType)
      : allRows
    for (const r of source) m.set(r.submarket, (m.get(r.submarket) ?? 0) + 1)
    return m
  }, [allRows, filters.propertyType])

  const availableSubmarkets = useMemo(() => {
    const source = filters.propertyType
      ? allRows.filter((r) => r.propertyType === filters.propertyType)
      : allRows
    return distinctSubmarkets(source)
  }, [allRows, filters.propertyType])

  return (
    <>
      <TopBar />

      <div className="container">
        <PageHeader onOpenMethodology={() => setMethodologyOpen(true)} />

        <div className="section-tabs">
          <div className="section-tab active">
            Portfolio
            <span className="count">{allRows.length}</span>
          </div>
          <div className="section-tab" style={{ opacity: 0.5, cursor: "not-allowed" }}>
            Market browser
          </div>
        </div>

        <FilterBar
          filters={filters}
          onChange={setFilters}
          availableSubmarkets={availableSubmarkets}
          propertyTypeCounts={propertyTypeCounts}
          submarketCounts={submarketCounts}
        />

        <PortfolioKpis rows={filteredRows} agg={agg} />

        <PortfolioBreakdown rows={filteredRows} filters={filters} />

        <div style={{ height: 16 }} />
        <LeaseTable rows={filteredRows} onSetEstimate={handleSetEstimate} />

        <div style={{ height: 16 }} />
        <MarketMap rows={filteredRows} />

        <div style={{ height: 16 }} />
        <TopVarianceLists rows={filteredRows} />

        <div className="page-footer">
          Per-lease broker estimates override our market data. Saved to your account.
        </div>
      </div>

      <MethodologyPanel
        open={methodologyOpen}
        onClose={() => setMethodologyOpen(false)}
        filters={filters}
        agg={agg}
      />
    </>
  )
}
