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
  type PulseBucket,
} from "@/components/breakdown-panel"
import { LeaseTable } from "@/components/lease-table"
import { LeaseDetailPanel } from "@/components/lease-detail-panel"
import { MarketIntelligence } from "@/components/market-intelligence"
import { MarketMap } from "@/components/market-map"
import { TopVarianceLists } from "@/components/top-variance-lists"
import { MethodologyPanel } from "@/components/methodology-panel"
import { SpendComposition } from "@/components/spend-composition"
import {
  MarketCoverageGate,
} from "@/components/market-coverage-gate"
import { READINESS_THRESHOLD, coverageStats } from "@/lib/coverage"
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

  // Open the breakdown panel scoped to a pulse bucket (above / at / below
  // market). Same surface as the period drill-down.
  const handlePulseSelect = useCallback((bucket: PulseBucket) => {
    setMethodologyOpen(false)
    setBreakdownPanel({ kind: "pulse", bucket })
  }, [])

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

  // Three-tab navigation. Configuration is the data-hygiene step (where the
  // broker confirms market estimates per lease); Dashboard is the high-level
  // portfolio-vs-market view; Market analysis is the broader market context.
  // Coverage is computed against the FULL portfolio (allRows), not the
  // filtered view — filters shouldn't be able to mask missing comps. We
  // default new portfolios to Configuration; portfolios already past the
  // readiness threshold land directly on Dashboard. We never auto-flip
  // afterwards — tab choice is the broker's.
  const coverage = useMemo(() => coverageStats(allRows), [allRows])
  type Tab = "config" | "dashboard" | "market"
  const [tab, setTab] = useState<Tab>(() =>
    coverage.readyPct >= READINESS_THRESHOLD && coverage.total > 0
      ? "dashboard"
      : "config",
  )
  const dashboardLocked =
    coverage.readyPct < READINESS_THRESHOLD && coverage.total > 0

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

        <FilterBar
          filters={filters}
          onChange={setFilters}
          availableSubmarkets={availableSubmarkets}
          propertyTypeCounts={propertyTypeCounts}
          submarketCounts={submarketCounts}
        />

        <div className="section-tabs" role="tablist" aria-label="Workspace">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "config"}
            className={`section-tab${tab === "config" ? " active" : ""}`}
            onClick={() => setTab("config")}
          >
            Configuration
            {coverage.attention > 0 && (
              <span
                className="count"
                title={`${coverage.attention} ${coverage.attention === 1 ? "lease needs" : "leases need"} attention`}
              >
                {coverage.attention}
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "dashboard"}
            className={`section-tab${tab === "dashboard" ? " active" : ""}`}
            onClick={() => setTab("dashboard")}
            disabled={dashboardLocked}
            title={
              dashboardLocked
                ? `Dashboard unlocks at ${Math.round(READINESS_THRESHOLD * 100)}% coverage`
                : undefined
            }
          >
            Portfolio dashboard
            <span className="count">{filteredRows.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "market"}
            className={`section-tab${tab === "market" ? " active" : ""}`}
            onClick={() => setTab("market")}
          >
            Market analysis
          </button>
        </div>

        {tab === "config" ? (
          <MarketCoverageGate
            rows={allRows}
            coverage={coverage}
            onPickScope={handlePickScope}
            onSetManual={handleSetManual}
            onPickSystemErv={handlePickSystemErv}
            onClearOverride={handleClearOverride}
          />
        ) : tab === "dashboard" ? (
          <>
            <PortfolioPulse
              stats={pulse}
              filters={filters}
              onFilterLowConfidence={filterLowConfidence}
              onSelectBucket={handlePulseSelect}
            />

            <div style={{ height: 16 }} />
            <SpendComposition
              rows={filteredRows}
              onSelectPeriod={handleTimelineSelect}
            />

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
          </>
        ) : (
          <MarketIntelligence portfolioRows={filteredRows} />
        )}

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
