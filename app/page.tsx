"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { FilterBar } from "@/components/filter-bar"
import { HeadlineChart } from "@/components/headline-chart"
import { HeadlineSummary } from "@/components/headline-summary"
import { LeaseTable } from "@/components/lease-table"
import { MethodologyPanel } from "@/components/methodology-panel"
import { PageHeader } from "@/components/page-header"
import {
  aggregate,
  applyFilters,
  buildLeaseRows,
  distinctSubmarkets,
  EMPTY_FILTERS,
  type Filters,
} from "@/lib/calculations"
import { SAMPLE_LEASES } from "@/lib/leases"
import type { BrokerOverrides, PropertyType } from "@/lib/types"

const STORAGE_KEY = "halberd:broker-overrides:v1"

export default function Page() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [overrides, setOverrides] = useState<BrokerOverrides>({})
  const [methodologyOpen, setMethodologyOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Load broker overrides from localStorage on mount.
  // Per-broker persistence; in production this would key off the authenticated broker id.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as BrokerOverrides
        if (parsed && typeof parsed === "object") {
          setOverrides(parsed)
        }
      }
    } catch {
      // Ignore corrupt storage; fall back to empty overrides.
    }
    setHydrated(true)
  }, [])

  // Persist whenever overrides change (after the initial hydration).
  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
    } catch {
      // Storage may be unavailable (private mode, quota); silently skip.
    }
  }, [overrides, hydrated])

  const handleSetEstimate = useCallback(
    (leaseId: string, estimate: number | null, note?: string) => {
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
            note,
            updatedAt: new Date().toISOString(),
          },
        }
      })
    },
    [],
  )

  // Compute everything downstream from overrides + filters.
  const allRows = useMemo(() => buildLeaseRows(SAMPLE_LEASES, overrides), [overrides])
  const filteredRows = useMemo(() => applyFilters(allRows, filters), [allRows, filters])
  const filteredAgg = useMemo(() => aggregate(filteredRows), [filteredRows])

  // Sub-market list reflects current property-type filter (empty = all types).
  const availableSubmarkets = useMemo(() => {
    const scope = filters.propertyType
      ? allRows.filter((r) => r.propertyType === filters.propertyType)
      : allRows
    return distinctSubmarkets(scope)
  }, [allRows, filters.propertyType])

  // Chart drill-down: clicking a property-type bar (no type filter) sets propertyType;
  // clicking a sub-market bar (within a type filter) sets submarket.
  const handleChartSelect = useCallback(
    (groupKey: string) => {
      if (!filters.propertyType) {
        setFilters({ ...filters, propertyType: groupKey as PropertyType, submarket: null })
      } else {
        setFilters({ ...filters, submarket: groupKey })
      }
      requestAnimationFrame(() => {
        document
          .querySelector(".lease-table-card")
          ?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
    },
    [filters],
  )

  return (
    <>
      <PageHeader onOpenMethodology={() => setMethodologyOpen(true)} />

      <main className="container">
        <header className="page-header">
          <h1 className="page-title">Portfolio intelligence</h1>
          <p className="page-subtitle">
            Benchmark every lease in your portfolio against current market rents. Override with your
            own estimates where you have a stronger read.
          </p>
        </header>

        <FilterBar
          filters={filters}
          onChange={setFilters}
          availableSubmarkets={availableSubmarkets}
          totalCount={allRows.length}
          filteredCount={filteredRows.length}
        />

        <HeadlineSummary agg={filteredAgg} filters={filters} />

        <HeadlineChart rows={filteredRows} filters={filters} onSelectGroup={handleChartSelect} />

        <LeaseTable rows={filteredRows} onSetEstimate={handleSetEstimate} />

        <div className="page-bottom-spacer" />
      </main>

      <MethodologyPanel
        open={methodologyOpen}
        onClose={() => setMethodologyOpen(false)}
        filters={filters}
        agg={filteredAgg}
      />
    </>
  )
}
