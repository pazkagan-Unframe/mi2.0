"use client";

import { useEffect } from "react";
import { fmtCurrency, propertyTypeData } from "./intelligence-data";

type Props = {
  typeId: string | null;
  onClose: () => void;
};

export function PropertyTypeDrawer({ typeId, onClose }: Props) {
  const isOpen = typeId !== null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [isOpen, onClose]);

  const data = typeId ? propertyTypeData[typeId] : null;
  const sorted = data
    ? data.submarkets.slice().sort((a, b) => {
        const av = a.gap === null ? -Infinity : a.gap;
        const bv = b.gap === null ? -Infinity : b.gap;
        return bv - av;
      })
    : [];

  return (
    <>
      <div
        className={`drawer-backdrop${isOpen ? " open" : ""}`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />
      <aside
        className={`drawer${isOpen ? " open" : ""}`}
        aria-hidden={!isOpen}
        aria-label="Property type drill-down"
      >
        <div className="drawer-header">
          <div className="drawer-title-block">
            <div className="drawer-eyebrow">Property type drill-down</div>
            <div className="drawer-title">
              {data ? `${data.name} portfolio` : ""}
            </div>
            <div className="drawer-subtitle">
              {data
                ? `${data.leases} leases · ${data.netGap} net gap · ${data.submarketCount} sub-markets`
                : ""}
            </div>
          </div>
          <button
            type="button"
            className="drawer-close"
            onClick={onClose}
            aria-label="Close drawer"
          >
            ×
          </button>
        </div>
        <div className="drawer-mini-kpis">
          <div className="drawer-mini-kpi">
            <div className="lbl">Above market</div>
            <div className="val danger">{data?.above ?? ""}</div>
          </div>
          <div className="drawer-mini-kpi">
            <div className="lbl">Below market</div>
            <div className="val success">{data?.below ?? ""}</div>
          </div>
          <div className="drawer-mini-kpi">
            <div className="lbl">Insufficient data</div>
            <div className="val muted">{data?.insufficient ?? ""}</div>
          </div>
        </div>
        <div className="drawer-body">
          <div className="drawer-section-title">
            <span>Sub-market segmentation</span>
            <span className="sort">Sort: gap descending ▼</span>
          </div>
          <div className="submarket-row header">
            <div>Sub-market</div>
            <div style={{ textAlign: "right" }}>Leases</div>
            <div style={{ textAlign: "right" }}>Your avg / market</div>
            <div style={{ textAlign: "right" }}>Gap</div>
          </div>
          {sorted.map((s, i) => {
            const gapClass =
              s.gap === null ? "muted" : s.gap > 0 ? "danger" : "success";
            const gapDisplay =
              s.gap === null ? "insufficient" : fmtCurrency(s.gap);
            const marketDisplay =
              s.market === null ? "—" : "$" + s.market.toFixed(2);
            return (
              <div className="submarket-row" key={`${s.name}-${i}`}>
                <div>
                  <div className="submarket-name">{s.name}</div>
                  <div className="submarket-meta">
                    {s.city} · {s.comps} comps
                  </div>
                </div>
                <div className="submarket-count mono">{s.leases}</div>
                <div className="submarket-rents">
                  <span className="yours mono">${s.yours.toFixed(2)}</span>
                  <span className="market mono">vs {marketDisplay}</span>
                </div>
                <div className="submarket-gap">
                  <div className={`val ${gapClass} mono`}>{gapDisplay}</div>
                  <div className={`conf ${s.conf}`}>{s.conf} confidence</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="drawer-footer">
          <div className="drawer-footer-meta">
            {data
              ? `Showing all sub-markets where Bosch has ${data.name} leases`
              : ""}
          </div>
          <button type="button" className="drawer-footer-action">
            {data
              ? `Filter table to all ${data.leases} ${data.name.toLowerCase()} leases →`
              : ""}
          </button>
        </div>
      </aside>
    </>
  );
}
