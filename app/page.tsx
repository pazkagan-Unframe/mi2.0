"use client";

import { useCallback, useState } from "react";
import { PropertyTypeDrawer } from "./drawer";
import { Tooltip } from "./tooltip";
import type { TooltipPayload } from "./intelligence-data";

type TooltipState = { payload: TooltipPayload; anchor: DOMRect } | null;

function useTooltipBindings() {
  const [state, setState] = useState<TooltipState>(null);
  const show = useCallback(
    (payload: TooltipPayload) =>
      (e: React.MouseEvent<HTMLElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setState({ payload, anchor: rect });
      },
    [],
  );
  const hide = useCallback(() => setState(null), []);
  const bind = (payload: TooltipPayload) => ({
    onMouseEnter: show(payload),
    onMouseLeave: hide,
    onFocus: show(payload),
    onBlur: hide,
  });
  return { state, bind };
}

const propertyRows: Array<{
  id: string;
  name: string;
  count: number;
  below: number;
  above: number;
  gap: string;
  gapClass: "danger" | "success";
}> = [
  { id: "office", name: "Office", count: 130, below: 32, above: 64, gap: "−$4.42/SF", gapClass: "danger" },
  { id: "other", name: "Other", count: 113, below: 59, above: 37, gap: "+$23.24/SF", gapClass: "success" },
  { id: "warehouse", name: "Warehouse", count: 34, below: 18, above: 78, gap: "−$7.53/SF", gapClass: "danger" },
  { id: "restaurant", name: "Restaurant", count: 18, below: 89, above: 7, gap: "+$20.37/SF", gapClass: "success" },
  { id: "office_warehouse", name: "Office/Warehouse", count: 15, below: 6, above: 90, gap: "−$5.90/SF", gapClass: "danger" },
  { id: "general_office", name: "General Office", count: 14, below: 22, above: 74, gap: "−$13.52/SF", gapClass: "danger" },
  { id: "industrial", name: "Industrial", count: 10, below: 20, above: 76, gap: "−$7.66/SF", gapClass: "danger" },
  { id: "manufacturing", name: "Manufacturing", count: 9, below: 0, above: 96, gap: "−$10.34/SF", gapClass: "danger" },
];

const mapPins: Array<{
  top: string;
  left: string;
  count: number;
  variant: "danger" | "success" | "warning";
  tt: TooltipPayload;
}> = [
  { top: "38%", left: "22%", count: 8, variant: "danger", tt: { title: "Seattle metro", meta: "WA · 8 leases · Office mix", rent: "$52.40/SF", market: "$44.20/SF", scope: "Sub-market · 12mo · 18 comps", gap: "+$8.20/SF (+19%)", conf: "high" } },
  { top: "32%", left: "38%", count: 15, variant: "danger", tt: { title: "Bay Area", meta: "CA · 15 leases · Office/Industrial", rent: "$58.10/SF", market: "$51.80/SF", scope: "Sub-market · 12mo · 27 comps", gap: "+$6.30/SF (+12%)", conf: "high" } },
  { top: "48%", left: "28%", count: 5, variant: "success", tt: { title: "Los Angeles metro", meta: "CA · 5 leases · Office", rent: "$42.30/SF", market: "$48.10/SF", scope: "Sub-market · 12mo · 22 comps", gap: "−$5.80/SF (−12%)", conf: "high" } },
  { top: "28%", left: "52%", count: 23, variant: "danger", tt: { title: "Chicago metro", meta: "IL · 23 leases · Office", rent: "$38.90/SF", market: "$42.30/SF", scope: "Sub-market · 12mo · 31 comps", gap: "−$3.40/SF (−8%)", conf: "high" } },
  { top: "42%", left: "48%", count: 12, variant: "warning", tt: { title: "Dallas-Fort Worth", meta: "TX · 12 leases · mixed", rent: "$31.40/SF", market: "$28.90/SF", scope: "Sub-market · 24mo · 8 comps", gap: "+$2.50/SF (+9%)", conf: "medium" } },
  { top: "32%", left: "68%", count: 57, variant: "danger", tt: { title: "Atlanta metro", meta: "GA · 57 leases · Office mix", rent: "$25.80/SF", market: "$22.60/SF", scope: "Sub-market · 12mo · 84 comps", gap: "+$3.20/SF (+14%)", conf: "high" } },
  { top: "52%", left: "62%", count: 14, variant: "success", tt: { title: "Florida coast", meta: "FL · 14 leases · Retail/Office", rent: "$58.40/SF", market: "$74.20/SF", scope: "Sub-market · 12mo · 19 comps", gap: "−$15.80/SF (−21%)", conf: "high" } },
  { top: "36%", left: "78%", count: 29, variant: "danger", tt: { title: "Northeast corridor", meta: "NY/NJ · 29 leases · Office", rent: "$71.20/SF", market: "$48.40/SF", scope: "Sub-market · 12mo · 42 comps", gap: "+$22.80/SF (+47%)", conf: "high" } },
  { top: "60%", left: "78%", count: 48, variant: "success", tt: { title: "Mid-Atlantic", meta: "DC/VA/MD · 48 leases · mixed", rent: "$32.80/SF", market: "$41.60/SF", scope: "Sub-market · 12mo · 73 comps", gap: "−$8.80/SF (−21%)", conf: "high" } },
  { top: "50%", left: "35%", count: 2, variant: "warning", tt: { title: "Naples FL", meta: "FL · 2 leases · Office", rent: "$52.00/SF", market: "—", scope: "Sub-market · 24mo · 4 comps", gap: "insufficient data", conf: "low" } },
];

const aboveItems: Array<{
  tt: TooltipPayload;
  name: string;
  meta: string;
  fillPct: number;
  value: string;
}> = [
  { tt: { title: "10 High Street", meta: "Office · Class A · NYC", rent: "$78.40/SF", market: "$47.20/SF", scope: "Midtown · Office · 12mo · 24 comps", gap: "+$31.20/SF (+66%)", conf: "high" }, name: "10 High Street", meta: "Midtown · 8 mo to expiry", fillPct: 100, value: "+$31.20" },
  { tt: { title: "One Exeter Plaza", meta: "Office · Class B · Boston MA", rent: "$62.10/SF", market: "$37.60/SF", scope: "Back Bay · Office · 12mo · 18 comps", gap: "+$24.50/SF (+65%)", conf: "high" }, name: "One Exeter Plaza", meta: "Back Bay · 14 mo to expiry", fillPct: 79, value: "+$24.50" },
  { tt: { title: "Boca Corporate Center I", meta: "Office · Class A · Boca Raton FL", rent: "$48.20/SF", market: "$29.30/SF", scope: "Boca Raton CBD · Office · 24mo · 6 comps", gap: "+$18.90/SF (+64%)", conf: "medium" }, name: "Boca Corporate Center I", meta: "Boca Raton CBD · 22 mo", fillPct: 61, value: "+$18.90" },
  { tt: { title: "Resurgens Plaza", meta: "Office · Class B · Atlanta GA", rent: "$34.80/SF", market: "$23.40/SF", scope: "Buckhead · Office · 12mo · 31 comps", gap: "+$11.40/SF (+49%)", conf: "high" }, name: "Resurgens Plaza", meta: "Buckhead · 11 mo to expiry", fillPct: 37, value: "+$11.40" },
];

const belowItems: Array<{
  tt: TooltipPayload;
  name: string;
  meta: string;
  fillPct: number;
  value: string;
}> = [
  { tt: { title: "772 Boylston Street", meta: "Retail · Boston MA", rent: "$420.00/SF", market: "$700.00/SF", scope: "Back Bay · Retail · 12mo · 12 comps", gap: "−$280.00/SF (−40%)", conf: "high" }, name: "772 Boylston Street", meta: "Back Bay · Retail · 36 mo", fillPct: 100, value: "−$280" },
  { tt: { title: "ATM City Hall Plaza", meta: "Retail · Philadelphia PA", rent: "$181.00/SF", market: "$360.00/SF", scope: "Center City · Retail · 12mo · 14 comps", gap: "−$179.00/SF (−50%)", conf: "high" }, name: "ATM City Hall Plaza", meta: "Philadelphia · 28 mo", fillPct: 64, value: "−$179" },
  { tt: { title: "ATM Beacon Street", meta: "Retail · Boston MA", rent: "$192.00/SF", market: "$335.00/SF", scope: "Beacon Hill · Retail · 12mo · 9 comps", gap: "−$143.00/SF (−43%)", conf: "medium" }, name: "ATM Beacon Street", meta: "Boston · 24 mo", fillPct: 51, value: "−$143" },
  { tt: { title: "Copley Square", meta: "Retail · Boston MA", rent: "$214.00/SF", market: "$320.00/SF", scope: "Back Bay · Retail · 12mo · 12 comps", gap: "−$106.00/SF (−33%)", conf: "high" }, name: "Copley Square", meta: "Back Bay · 30 mo", fillPct: 38, value: "−$106" },
];

const kpiTooltips: TooltipPayload[] = [
  { title: "Total gap exposure", meta: "Aggregate of leases above their own market", rent: "$5,140K above", market: "$17,360K above (raw)", scope: "Per-lease vs sub-market avg", gap: "−$12.2M net exposure", conf: "high", formula: "Sum of (lease rent − sub-market avg) × leased SF for above-market leases" },
  { title: "Renegotiation pool", meta: "High-priority action candidates", rent: "47 leases qualify", market: "−$4.8M total above-market", scope: "Above market AND <18mo to expiry", gap: "$2.1M annual savings opportunity", conf: "high", formula: "Filtered: above-market + expires within 18 months" },
  { title: "Below-market savings", meta: "Aggregate of leases below their own market", rent: "$27.9M below market", market: "vs sub-market avgs", scope: "Per-lease vs sub-market avg", gap: "+$27.9M positive position", conf: "high", formula: "Sum of (sub-market avg − lease rent) × leased SF for below-market leases" },
  { title: "Benchmark coverage", meta: "Leases with sufficient comparable data", rent: "379 of 971 leases", market: "≥5 comps in sub-market", scope: "Sub-market default · 24mo window", gap: "592 require widening or have no comps", conf: "high", formula: "Coverage = leases with ≥5 comps in their sub-market within 24mo" },
];

export default function IntelligencePage() {
  const [drawerType, setDrawerType] = useState<string | null>(null);
  const { state, bind } = useTooltipBindings();

  return (
    <>
      <header className="topbar">
        <div className="logo">
          One<span>Advise</span>
        </div>
        <nav className="top-nav" aria-label="Primary">
          <a href="#">Portfolio</a>
          <a href="#">Documents</a>
          <a href="#">Map</a>
          <a href="#">Dashboards</a>
          <a href="#" className="active" aria-current="page">
            Intelligence
          </a>
          <a href="#">Manage</a>
        </nav>
        <div className="top-utils">
          <span>Bosch</span>
          <div className="avatar" aria-label="Account">
            PK
          </div>
        </div>
      </header>

      <main className="container">
        <section className="wireframe-meta">
          <div className="left">
            <h1>Portfolio Intelligence — Redesign Wireframe v1</h1>
            <p>Working draft for Thursday review with Nir, Joel, design team</p>
          </div>
          <div className="right">
            <div>
              <strong>Author</strong>Paz Kagan
            </div>
            <div>
              <strong>Status</strong>Draft
            </div>
            <div>
              <strong>Date</strong>May 2026
            </div>
          </div>
        </section>

        <section className="annotation-grid" aria-label="Design principles">
          <div className="annotation-card">
            <div className="num">Principle 01</div>
            <div className="title">Per-lease per-its-area comparison</div>
            <div className="desc">
              Each lease compares against the average of the specific sub-market
              it sits in — never against a blended portfolio average.
            </div>
          </div>
          <div className="annotation-card">
            <div className="num">Principle 02</div>
            <div className="title">Sub-market default, user widens</div>
            <div className="desc">
              Default is the lowest granularity available. Below 10 comps,
              surface widen-to-market option but never auto-apply.
            </div>
          </div>
          <div className="annotation-card">
            <div className="num">Principle 03</div>
            <div className="title">Two-section dashboard</div>
            <div className="desc">
              Portfolio-vs-market analytics and pure-market data are different
              use cases that should not share the same scroll.
            </div>
          </div>
        </section>

        <div className="page-header">
          <div>
            <div className="page-title">
              Intelligence<span className="badge-new">Redesign</span>
            </div>
            <div className="page-subtitle">
              Benchmark your portfolio. Browse the market.
            </div>
          </div>
        </div>

        <div className="section-tabs" role="tablist">
          <div className="section-tab active" role="tab" aria-selected="true">
            Portfolio Intelligence
            <span className="count">971 leases</span>
          </div>
          <div className="section-tab" role="tab" aria-selected="false">
            Market Browser
            <span className="count">505 markets</span>
          </div>
        </div>

        <div className="filter-bar">
          <div className="filter-chip primary">
            <span className="label">Client</span>
            <span className="value">Bosch</span>
            <span className="caret">▼</span>
          </div>
          <div className="filter-chip">
            <span className="label">Sub-markets</span>
            <span className="value">All (42)</span>
            <span className="caret">▼</span>
          </div>
          <div className="filter-chip">
            <span className="label">Property type</span>
            <span className="value">All</span>
            <span className="caret">▼</span>
          </div>
          <div className="filter-chip">
            <span className="label">Period</span>
            <span className="value">Last 24 mo</span>
            <span className="caret">▼</span>
          </div>
          <div className="filter-chip">
            <span className="label">Comp window</span>
            <span className="value">12 mo</span>
            <span className="caret">▼</span>
          </div>
          <div className="spacer" />
          <div className="save-view">+ Save view</div>
        </div>

        <div className="kpi-strip">
          <div className="kpi" {...bind(kpiTooltips[0])}>
            <div className="kpi-label">
              Total gap exposure<span className="info-icon">i</span>
            </div>
            <div className="kpi-value danger">−$12.2M</div>
            <div className="kpi-meta">
              216 leases above market · <span className="accent">view all →</span>
            </div>
          </div>
          <div className="kpi" {...bind(kpiTooltips[1])}>
            <div className="kpi-label">
              Renegotiation pool<span className="info-icon">i</span>
            </div>
            <div className="kpi-value">47</div>
            <div className="kpi-meta">
              {"expiring <18 mo · above market · "}
              <span className="accent">act on these →</span>
            </div>
          </div>
          <div className="kpi" {...bind(kpiTooltips[2])}>
            <div className="kpi-label">
              Below-market savings<span className="info-icon">i</span>
            </div>
            <div className="kpi-value success">+$27.9M</div>
            <div className="kpi-meta">
              163 leases below market · <span className="accent">view all →</span>
            </div>
          </div>
          <div className="kpi" {...bind(kpiTooltips[3])}>
            <div className="kpi-label">
              Benchmark coverage<span className="info-icon">i</span>
            </div>
            <div className="kpi-value">
              379
              <span
                style={{
                  fontSize: 16,
                  color: "var(--text-3)",
                  fontWeight: 400,
                }}
              >
                {" / 971"}
              </span>
            </div>
            <div className="kpi-meta">39% have comparable sub-market data</div>
          </div>
        </div>

        <div className="row split-60-40">
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                Portfolio gap by property type
                <span className="badge-new">Updated</span>
              </div>
              <div className="card-actions">
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                  click any type to drill into sub-markets
                </span>
                <span className="ai-insight">AI Insight</span>
              </div>
            </div>
            <div className="card-body">
              <div className="ptype-row header">
                <div>Property type</div>
                <div style={{ textAlign: "right" }}>Leases</div>
                <div>Distribution (above ↔ below market)</div>
                <div style={{ textAlign: "right" }}>Net gap</div>
                <div />
              </div>
              {propertyRows.map((r) => (
                <div
                  key={r.id}
                  className="ptype-row"
                  data-ptype={r.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDrawerType(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setDrawerType(r.id);
                    }
                  }}
                >
                  <div className="ptype-name">{r.name}</div>
                  <div className="ptype-count mono">{r.count}</div>
                  <div className="ptype-bar">
                    <div className="below" style={{ width: `${r.below}%` }} />
                    <div style={{ width: "4%" }} />
                    <div className="above" style={{ width: `${r.above}%` }} />
                    <div className="marker" style={{ left: "50%" }} />
                  </div>
                  <div className={`ptype-gap ${r.gapClass} mono`}>{r.gap}</div>
                  <div className="ptype-action">filter →</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Portfolio vs market</div>
              <div className="card-actions">
                <span className="ai-insight">AI Insight</span>
              </div>
            </div>
            <div className="card-body">
              <div className="donut-wrap">
                <div className="donut">
                  <svg
                    viewBox="0 0 36 36"
                    width="180"
                    height="180"
                    style={{ transform: "rotate(-90deg)" }}
                    aria-hidden="true"
                  >
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke="#E5E3DB"
                      strokeWidth="3.5"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke="#0F6E56"
                      strokeWidth="3.5"
                      strokeDasharray="16.8 100"
                      strokeDashoffset="0"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke="#A32D2D"
                      strokeWidth="3.5"
                      strokeDasharray="22.2 100"
                      strokeDashoffset="-16.8"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke="#D3D1C7"
                      strokeWidth="3.5"
                      strokeDasharray="61 100"
                      strokeDashoffset="-39"
                    />
                  </svg>
                  <div className="donut-center">
                    <div className="num">971</div>
                    <div className="lbl">Total leases</div>
                  </div>
                </div>
                <div className="donut-legend">
                  <div className="donut-legend-item">
                    <div className="left">
                      <span
                        className="swatch"
                        style={{ background: "var(--success)" }}
                      />
                      Below market
                    </div>
                    <div className="right">163</div>
                  </div>
                  <div className="donut-legend-item">
                    <div className="left">
                      <span
                        className="swatch"
                        style={{ background: "var(--danger)" }}
                      />
                      Above market
                    </div>
                    <div className="right">216</div>
                  </div>
                  <div className="donut-legend-item">
                    <div className="left">
                      <span
                        className="swatch"
                        style={{ background: "var(--border-strong)" }}
                      />
                      No comparable data
                    </div>
                    <div className="right">592</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row full">
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                Lease-by-lease benchmark<span className="badge-new">New</span>
              </div>
              <div className="card-actions">
                <span>Showing 6 of 379 benchmarked leases</span>
                <span className="ai-insight">AI Insight</span>
              </div>
            </div>
            <div className="table-toolbar">
              <span className="ptype-filter-chip active">
                All<span className="ct">971</span>
              </span>
              <span className="ptype-filter-chip">
                Office<span className="ct">130</span>
              </span>
              <span className="ptype-filter-chip">
                Warehouse<span className="ct">34</span>
              </span>
              <span className="ptype-filter-chip">
                Restaurant<span className="ct">18</span>
              </span>
              <span className="ptype-filter-chip">
                Industrial<span className="ct">10</span>
              </span>
              <span className="ptype-filter-chip">More…</span>
              <div className="spacer" />
              <div className="sort-select">Sort: gap descending ▼</div>
            </div>
            <table className="lease-table">
              <thead>
                <tr>
                  <th>Lease</th>
                  <th className="right">Current rent</th>
                  <th>Benchmark scope</th>
                  <th className="right">Market avg</th>
                  <th className="right">Gap</th>
                  <th className="right">Expires</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div className="lease-name">10 High Street</div>
                    <div className="lease-meta">Office · Class A · New York NY</div>
                  </td>
                  <td className="right mono">$78.40/SF</td>
                  <td>
                    <div className="scope-chip">
                      <div className="scope-text">Midtown · Office · 12 mo</div>
                      <div className="scope-conf high">24 comps · high confidence</div>
                    </div>
                  </td>
                  <td className="right mono">$47.20/SF</td>
                  <td className="right">
                    <div className="gap-cell">
                      <div className="gap-value danger mono">+$31.20</div>
                      <div className="gap-pct">+66% above market</div>
                    </div>
                  </td>
                  <td className="right expiry-cell urgent">8 mo</td>
                </tr>
                <tr>
                  <td>
                    <div className="lease-name">One Exeter Plaza</div>
                    <div className="lease-meta">Office · Class B · Boston MA</div>
                  </td>
                  <td className="right mono">$62.10/SF</td>
                  <td>
                    <div className="scope-chip">
                      <div className="scope-text">Back Bay · Office · 12 mo</div>
                      <div className="scope-conf high">18 comps · high confidence</div>
                    </div>
                  </td>
                  <td className="right mono">$37.60/SF</td>
                  <td className="right">
                    <div className="gap-cell">
                      <div className="gap-value danger mono">+$24.50</div>
                      <div className="gap-pct">+65% above market</div>
                    </div>
                  </td>
                  <td className="right expiry-cell">14 mo</td>
                </tr>
                <tr>
                  <td>
                    <div className="lease-name">Boca Corporate Center I</div>
                    <div className="lease-meta">Office · Class A · Boca Raton FL</div>
                  </td>
                  <td className="right mono">$48.20/SF</td>
                  <td>
                    <div className="scope-chip">
                      <div className="scope-text">Boca Raton CBD · Office · 24 mo</div>
                      <div className="scope-conf med">6 comps · medium confidence</div>
                      <a className="widen-link">widen to market →</a>
                    </div>
                  </td>
                  <td className="right mono">$29.30/SF</td>
                  <td className="right">
                    <div className="gap-cell">
                      <div className="gap-value danger mono">+$18.90</div>
                      <div className="gap-pct">+64% above market</div>
                    </div>
                  </td>
                  <td className="right expiry-cell">22 mo</td>
                </tr>
                <tr>
                  <td>
                    <div className="lease-name">Resurgens Plaza</div>
                    <div className="lease-meta">Office · Class B · Atlanta GA</div>
                  </td>
                  <td className="right mono">$34.80/SF</td>
                  <td>
                    <div className="scope-chip">
                      <div className="scope-text">Buckhead · Office · 12 mo</div>
                      <div className="scope-conf high">31 comps · high confidence</div>
                    </div>
                  </td>
                  <td className="right mono">$23.40/SF</td>
                  <td className="right">
                    <div className="gap-cell">
                      <div className="gap-value danger mono">+$11.40</div>
                      <div className="gap-pct">+49% above market</div>
                    </div>
                  </td>
                  <td className="right expiry-cell urgent">11 mo</td>
                </tr>
                <tr>
                  <td>
                    <div className="lease-name">Naples Executive Suites</div>
                    <div className="lease-meta">Office · Class A · Naples FL</div>
                  </td>
                  <td className="right mono">$52.00/SF</td>
                  <td>
                    <div className="scope-chip">
                      <div className="scope-text">Naples · Office · 24 mo</div>
                      <div className="scope-conf low">4 comps · low confidence</div>
                      <a className="widen-link">widen to market →</a>
                    </div>
                  </td>
                  <td className="right mono" style={{ color: "var(--text-3)" }}>
                    insufficient
                  </td>
                  <td className="right">
                    <div className="gap-cell">
                      <div
                        className="gap-value mono"
                        style={{ color: "var(--text-3)" }}
                      >
                        —
                      </div>
                      <div className="gap-pct">scope too narrow</div>
                    </div>
                  </td>
                  <td className="right expiry-cell">19 mo</td>
                </tr>
                <tr>
                  <td>
                    <div className="lease-name">772 Boylston Street</div>
                    <div className="lease-meta">Retail · Boston MA</div>
                  </td>
                  <td className="right mono">$420.00/SF</td>
                  <td>
                    <div className="scope-chip">
                      <div className="scope-text">Back Bay · Retail · 12 mo</div>
                      <div className="scope-conf high">12 comps · high confidence</div>
                    </div>
                  </td>
                  <td className="right mono">$700.00/SF</td>
                  <td className="right">
                    <div className="gap-cell">
                      <div className="gap-value success mono">−$280.00</div>
                      <div className="gap-pct">−40% below market</div>
                    </div>
                  </td>
                  <td className="right expiry-cell">36 mo</td>
                </tr>
              </tbody>
            </table>
            <div className="table-footer">
              971 leases · 379 benchmarked ·{" "}
              <a style={{ color: "var(--accent)", textDecoration: "none" }}>
                view all →
              </a>
            </div>
          </div>
        </div>

        <div className="row split-60-40">
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                Per-lease variance map<span className="badge-new">Fix</span>
              </div>
              <div className="card-actions">
                <span>Sub-market scope</span>
                <span className="ai-insight">AI Insight</span>
              </div>
            </div>
            <div className="map-stub">
              <div className="map-note">
                Each pin colored by lease-vs-its-own-market gap, not by blended
                portfolio average
              </div>
              {mapPins.map((p, i) => (
                <div
                  key={i}
                  className={`map-pin ${p.variant}`}
                  style={{ top: p.top, left: p.left }}
                  {...bind(p.tt)}
                >
                  {p.count}
                </div>
              ))}
              <div className="map-legend">
                <div className="map-legend-item">
                  <div
                    className="dot"
                    style={{ background: "var(--danger)" }}
                  />
                  Above market
                </div>
                <div className="map-legend-item">
                  <div
                    className="dot"
                    style={{ background: "var(--success)" }}
                  />
                  Below market
                </div>
                <div className="map-legend-item">
                  <div
                    className="dot"
                    style={{ background: "var(--warning)" }}
                  />
                  Low confidence
                </div>
                <div className="map-legend-item">
                  <div className="dot" style={{ background: "#BDBDB7" }} />
                  No data
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card">
              <div className="card-header">
                <div className="card-title">Top above-market leases</div>
                <div className="card-actions">
                  <span className="ai-insight">AI Insight</span>
                </div>
              </div>
              <div
                className="card-body"
                style={{ paddingTop: 8, paddingBottom: 8 }}
              >
                {aboveItems.map((it, i) => (
                  <div key={i} className="list-item" {...bind(it.tt)}>
                    <div>
                      <div className="list-item-name">{it.name}</div>
                      <div className="list-item-meta">{it.meta}</div>
                    </div>
                    <div className="list-item-bar-wrap">
                      <div className="list-item-bar">
                        <div
                          className="fill danger"
                          style={{ width: `${it.fillPct}%` }}
                        />
                      </div>
                      <div className="list-item-val danger mono">{it.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-header">
                <div className="card-title">Top below-market leases</div>
                <div className="card-actions">
                  <span className="ai-insight">AI Insight</span>
                </div>
              </div>
              <div
                className="card-body"
                style={{ paddingTop: 8, paddingBottom: 8 }}
              >
                {belowItems.map((it, i) => (
                  <div key={i} className="list-item" {...bind(it.tt)}>
                    <div>
                      <div className="list-item-name">{it.name}</div>
                      <div className="list-item-meta">{it.meta}</div>
                    </div>
                    <div className="list-item-bar-wrap">
                      <div className="list-item-bar">
                        <div
                          className="fill success"
                          style={{ width: `${it.fillPct}%` }}
                        />
                      </div>
                      <div className="list-item-val success mono">{it.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="section-divider">
          <div className="section-divider-title">
            Section 2 · Market Browser (separate scroll)
          </div>
        </div>

        <div className="market-preview">
          <h3>Market Browser tab</h3>
          <p>
            Pure market analytics — separate from your portfolio view. Twelve
            widgets relocate here.
          </p>
          <div className="widget-grid">
            <div className="widget-stub">Availability by class</div>
            <div className="widget-stub">Asking vs achieved trend</div>
            <div className="widget-stub">Quarterly leasing volume</div>
            <div className="widget-stub">Rent by class</div>
            <div className="widget-stub">Availability by size</div>
            <div className="widget-stub">Total lease area by size</div>
            <div className="widget-stub">Top sub-markets by inventory</div>
            <div className="widget-stub">Construction completed</div>
            <div className="widget-stub">Supply vs demand</div>
            <div className="widget-stub">Vacancy trend</div>
            <div className="widget-stub">Top recent leases</div>
            <div className="widget-stub">Top available spaces</div>
          </div>
        </div>

        <div className="section-divider">
          <div className="section-divider-title">Open decisions for the call</div>
        </div>

        <div className="annotation-grid">
          <div className="annotation-card">
            <div className="num">Decision 01</div>
            <div className="title">Comp threshold</div>
            <div className="desc">
              10 comps as the high/medium boundary, 5 as the medium/low boundary
              {" — does Nir's data support this?"}
            </div>
          </div>
          <div className="annotation-card">
            <div className="num">Decision 02</div>
            <div className="title">Cascade order on widen</div>
            <div className="desc">
              Sub-market + property type → market + property type. Or include a
              class-relaxation step in between?
            </div>
          </div>
          <div className="annotation-card">
            <div className="num">Decision 03</div>
            <div className="title">NER vs headline rent</div>
            <div className="desc">
              {"Pending Khushboo's lease abstraction test. Show both with a metric toggle, or pick one?"}
            </div>
          </div>
          <div className="annotation-card">
            <div className="num">Decision 04</div>
            <div className="title">Per-row vs table-level scope</div>
            <div className="desc">
              Each lease independently resolves scope, or one toggle applies to
              the whole table?
            </div>
          </div>
          <div className="annotation-card">
            <div className="num">Decision 05</div>
            <div className="title">Action layer connection</div>
            <div className="desc">
              Renegotiation pool KPI → does clicking it create a transaction in
              the Cockpit, or just filter the table?
            </div>
          </div>
          <div className="annotation-card">
            <div className="num">Decision 06</div>
            <div className="title">Module name</div>
            <div className="desc">
              {'"Intelligence" with two tabs, or split into "Portfolio Intelligence" and "Market Intelligence" as separate nav items?'}
            </div>
          </div>
        </div>

        <footer>
          Wireframe v1 · Working draft · Not final design · Built for review
        </footer>
      </main>

      <Tooltip
        payload={state?.payload ?? null}
        anchor={state?.anchor ?? null}
      />
      <PropertyTypeDrawer
        typeId={drawerType}
        onClose={() => setDrawerType(null)}
      />
    </>
  );
}
