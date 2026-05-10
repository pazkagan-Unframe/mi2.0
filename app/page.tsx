"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { TopBar } from "@/components/top-bar"
import { PageHeader } from "@/components/page-header"
import { FilterBar } from "@/components/filter-bar"
import { PortfolioPulse } from "@/components/portfolio-pulse"
import { PortfolioBreakdown } from "@/components/portfolio-breakdown"
import {
  BreakdownPanel,
  type BreakdownPanelSelection,
} from "@/components/breakdown-panel"
import { LeaseTable } from "@/components/lease-table"
import { LeaseDetailPanel } from "@/components/lease-detail-panel"
import { MarketMap } from "@/components/market-map"
import { TopVarianceLists } from "@/components/top-variance-lists"
import { MethodologyPanel } from "@/components/methodology-panel"
import { RenewalTimeline } from "@/components/renewal-timeline"
import { SpendComposition } from "@/components/spend-composition"
import type { Granularity } from "@/lib/timeline"
import { SAMPLE_LEASES } from "@/lib/leases"
import { buildLeasesWithScopes } from "@/lib/scope-chain"
import {
  EMPTY_FILTERS,
  aggregate,
  applyFilters,
  buildLeaseRows,
  distinctSubmarkets,
  pulseStats,
  type Filters,
} from "@/lib/calculations"
import type { BrokerOverrides, PropertyType } from "@/lib/types"

const STORAGE_KEY = "oneadvise:broker-overrides:v2"
// In production this would come from auth — kept simple for the prototype.
const BROKER_ID = "pk"

// Build the leases-with-scopes once at module load.
const PORTFOLIO = buildLeasesWithScopes(SAMPLE_LEASES)

export default function Page() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [overrides, setOverrides] = useState<BrokerOverrides>({})
  const [methodologyOpen, setMethodologyOpen] = useState(false)
  const [breakdownPanel, setBreakdownPanel] =
    useState<BreakdownPanelSelection | null>(null)
  const [leaseDetailId, setLeaseDetailId] = useState<string | null>(null)
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

  const handlePickScope = useCallback((leaseId: string, scopeId: string) => {
    setOverrides((prev) => {
      const lease = PORTFOLIO.find((l) => l.id === leaseId)
      if (!lease) return prev
      const scope = lease.scopes.find((s) => s.id === scopeId)
      if (!scope) return prev
      // If the chosen scope IS the system default and there's no existing
      // override, no-op (keeps URL/storage clean).
      if (lease.defaultScopeId === scopeId && !prev[leaseId]) return prev
      // If the chosen scope IS the system default and there IS an override, clear it.
      if (lease.defaultScopeId === scopeId) {
        const next = { ...prev }
        delete next[leaseId]
        return next
      }
      return {
        ...prev,
        [leaseId]: {
          estimatePsf: scope.rentPsf,
          kind: "scope",
          scopeId,
          sourceLabel: scope.label,
          updatedAt: new Date().toISOString(),
        },
      }
    })
  }, [])

  const handleSetManual = useCallback((leaseId: string, estimate: number) => {
    setOverrides((prev) => ({
      ...prev,
      [leaseId]: {
        estimatePsf: estimate,
        kind: "manual",
        sourceLabel: "Your ERV",
        updatedAt: new Date().toISOString(),
      },
    }))
  }, [])

  const handlePickSystemErv = useCallback((leaseId: string) => {
    setOverrides((prev) => {
      const lease = PORTFOLIO.find((l) => l.id === leaseId)
      if (!lease || lease.systemErvPsf == null) return prev
      return {
        ...prev,
        [leaseId]: {
          estimatePsf: lease.systemErvPsf,
          kind: "system-erv",
          sourceLabel: "External ERV",
          updatedAt: new Date().toISOString(),
        },
      }
    })
  }, [])

  const handleClearOverride = useCallback((leaseId: string) => {
    setOverrides((prev) => {
      if (!prev[leaseId]) return prev
      const next = { ...prev }
      delete next[leaseId]
      return next
    })
  }, [])

  // Everything downstream is computed from overrides + filters.
  const allRows = useMemo(() => buildLeaseRows(PORTFOLIO, overrides), [overrides])
  const filteredRows = useMemo(() => applyFilters(allRows, filters), [allRows, filters])
  const agg = useMemo(() => aggregate(filteredRows), [filteredRows])
  const pulse = useMemo(() => pulseStats(filteredRows), [filteredRows])

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

  const filterLowConfidence = useCallback(() => {
    setFilters((f) => ({ ...f, confidence: "highmedium" }))
  }, [])

  // Open the breakdown side panel for a given outer group. We only store the
  // selection key; the panel re-derives its rows from the latest filteredRows
  // so override changes are reflected live.
  const handleBreakdownSelect = useCallback(
    (outerGroupBy: "propertyType" | "submarket", key: string) => {
      setMethodologyOpen(false)
      setBreakdownPanel({ kind: "group", outerGroupBy, outerKey: key })
    },
    [],
  )
  const handleBreakdownClose = useCallback(() => setBreakdownPanel(null), [])

  // Open the breakdown panel filtered to a specific renewal period (a quarter
  // or month). Doesn't touch global filters — pure drill-down.
  const handleTimelineSelect = useCallback(
    (bucketKey: string, bucketLabel: string, granularity: Granularity) => {
      setMethodologyOpen(false)
      setBreakdownPanel({
        kind: "period",
        bucketKey,
        label: bucketLabel,
        granularity,
      })
    },
    [],
  )

  // Lease detail panel — stacks above breakdown panel, can also be opened
  // from the top-variance lists or any lease row in the table.
  const handleLeaseClick = useCallback((leaseId: string) => {
    setLeaseDetailId(leaseId)
  }, [])
  const handleLeaseDetailClose = useCallback(() => setLeaseDetailId(null), [])

  const detailRow = useMemo(
    () => (leaseDetailId ? allRows.find((r) => r.id === leaseDetailId) ?? null : null),
    [allRows, leaseDetailId],
  )

  // When filters change, close any open panels — their data may be out of scope.
  useEffect(() => {
    setBreakdownPanel(null)
    setLeaseDetailId(null)
  }, [filters])

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

        <PortfolioPulse
          stats={pulse}
          filters={filters}
          onFilterLowConfidence={filterLowConfidence}
        />

        <div style={{ height: 16 }} />
        <SpendComposition
          rows={filteredRows}
          onSelectPeriod={handleTimelineSelect}
        />

        <div style={{ height: 16 }} />
        <RenewalTimeline rows={filteredRows} onSelectPeriod={handleTimelineSelect} />

        <div style={{ height: 16 }} />
        <div className="row split-50-50">
          <PortfolioBreakdown
            rows={filteredRows}
            groupBy="propertyType"
            onSelect={(key) => handleBreakdownSelect("propertyType", key)}
            selectedKey={
              breakdownPanel?.kind === "group" &&
              breakdownPanel.outerGroupBy === "propertyType"
                ? breakdownPanel.outerKey
                : null
            }
          />
          <PortfolioBreakdown
            rows={filteredRows}
            groupBy="submarket"
            onSelect={(key) => handleBreakdownSelect("submarket", key)}
            selectedKey={
              breakdownPanel?.kind === "group" &&
              breakdownPanel.outerGroupBy === "submarket"
                ? breakdownPanel.outerKey
                : null
            }
          />
        </div>

        <div style={{ height: 16 }} />
        <MarketMap rows={filteredRows} />

        <div style={{ height: 16 }} />
        <TopVarianceLists rows={filteredRows} onLeaseClick={handleLeaseClick} />

        <div style={{ height: 16 }} />
        <LeaseTable
          rows={filteredRows}
          onPickScope={handlePickScope}
          onSetManual={handleSetManual}
          onPickSystemErv={handlePickSystemErv}
          onClearOverride={handleClearOverride}
          onLeaseClick={handleLeaseClick}
        />

        <div className="page-footer">
          Per-lease overrides — manual estimates or alternate comp scopes — replace
          our system default in all calculations. Saved to your account.
        </div>
      </div>

      <MethodologyPanel
        open={methodologyOpen}
        onClose={() => setMethodologyOpen(false)}
        filters={filters}
        agg={agg}
      />

      <BreakdownPanel
        open={breakdownPanel !== null}
        selection={breakdownPanel}
        allRows={filteredRows}
        onClose={handleBreakdownClose}
        onPickScope={handlePickScope}
        onSetManual={handleSetManual}
        onPickSystemErv={handlePickSystemErv}
        onClearOverride={handleClearOverride}
      />

      <LeaseDetailPanel
        open={leaseDetailId !== null}
        row={detailRow}
        onClose={handleLeaseDetailClose}
        onPickScope={handlePickScope}
        onPickSystemErv={handlePickSystemErv}
        onClearOverride={handleClearOverride}
      />
    </>
  )
}
