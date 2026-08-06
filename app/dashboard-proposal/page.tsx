import type { Metadata } from "next"
import styles from "./dashboard-proposal.module.css"

export const metadata: Metadata = {
  title: "Market dashboard — proposal",
  description:
    "Handoff prototype: header tooltips + a diverging opportunity/at-risk bar for the renewal & spend impact section.",
}

/* ------------------------------------------------------------------ */
/* Numbers mirror the production screenshot so the proposal is a       */
/* like-for-like comparison. Kept in one place for the developer.      */
/* ------------------------------------------------------------------ */
const DATA = {
  position: { below: 13, at: 4, above: 13 },
  renewal: {
    opportunity: 351.79, // $K — above-market leases you can renegotiate down
    atRisk: 503.6, // $K — below-market leases whose savings reset up at renewal
    aboveCount: 13,
    belowCount: 13,
    expiringSpend: 3.71, // $M expiring annual spend
  },
}
const NET = DATA.renewal.opportunity - DATA.renewal.atRisk // -151.81

/* ------------------------------------------------------------------ */
/* InfoTip — accessible hover/focus help popover. Each tooltip states  */
/* WHERE it lives, WHAT it means (one sentence), and HOW it's derived. */
/* ------------------------------------------------------------------ */
function InfoTip({
  location,
  title,
  body,
  calc,
}: {
  location: string
  title: string
  body: string
  calc: string
}) {
  return (
    <span className={styles.tipWrap}>
      <button
        type="button"
        className={styles.tipGlyph}
        aria-label={`About ${title}`}
      >
        ?
      </button>
      <span className={styles.tipPopover} role="tooltip">
        <span className={styles.tipLocation}>{location}</span>
        <span className={styles.tipTitle}>{title}</span>
        <span className={styles.tipBody}>{body}</span>
        <span className={styles.tipCalc}>{calc}</span>
      </span>
    </span>
  )
}

function fmtK(k: number) {
  return `$${k.toFixed(2)}K`
}

/* Small inline icons — avoids unreliable emoji glyphs in the handoff. */
const ico = {
  sparkle: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.8 5.9L20 9.7l-6.2 1.8L12 22l-1.8-10.5L4 9.7l6.2-1.8L12 2z" />
    </svg>
  ),
  bulb: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.7.7 1 1.2 1 2.5h6c0-1.3.3-1.8 1-2.5A6 6 0 0012 3z" />
    </svg>
  ),
  cal: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4" />
    </svg>
  ),
  gear: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
    </svg>
  ),
  bell: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6M9 21h6" />
    </svg>
  ),
}

export default function DashboardProposalPage() {
  const { position, renewal } = DATA
  const totalPos = position.below + position.at + position.above
  const pct = (n: number) => `${(n / totalPos) * 100}%`

  // Diverging bar geometry. Both sides share a scale anchored to the larger
  // magnitude, so the longer bar reads as the dominant force.
  const maxMag = Math.max(renewal.opportunity, renewal.atRisk)
  const oppW = (renewal.opportunity / maxMag) * 50 // % of full track (right half)
  const riskW = (renewal.atRisk / maxMag) * 50 // % of full track (left half)
  // Net marker: center (50%) shifted by net magnitude on the shared scale.
  const netLeft = 50 + (NET / maxMag) * 50
  const netPositive = NET >= 0

  return (
    <div className={styles.page}>
      {/* ---- Top bar ---- */}
      <header className={styles.topbar}>
        <div className={styles.topTitle}>Market dashboard</div>
        <div className={styles.topRight}>
          <span className={styles.selectClients}>
            Select clients
            <span className={styles.chevron}>▾</span>
          </span>
          <span className={styles.topDivider} />
          <span className={styles.pill}>{ico.sparkle} AI Assistant</span>
          <span className={styles.pill}>{ico.bulb} Relaunch tour</span>
          <span className={styles.iconBtn}>?</span>
          <span className={styles.iconBtn}>{ico.gear}</span>
          <span className={styles.iconBtn}>{ico.bell}</span>
          <span className={styles.avatar}>AU</span>
        </div>
      </header>

      <main className={styles.body}>
        {/* ---- Filters ---- */}
        <div className={styles.filters}>
          <span className={styles.filterChip}>
            Client: <strong>All (1)</strong> <span className={styles.chevron}>▾</span>
          </span>
          <span className={styles.filterChip}>
            Property type: <strong>All (16)</strong>{" "}
            <span className={styles.chevron}>▾</span>
          </span>
          <span className={styles.filterChip}>
            Sub-market: <strong>All (276)</strong>{" "}
            <span className={styles.chevron}>▾</span>
          </span>
          <span className={styles.filterChip}>
            Expires: <strong>Within 12 mo</strong>{" "}
            <span className={styles.chevron}>▾</span>
          </span>
          <span className={styles.filterChip}>
            Confidence: <strong>High</strong> <span className={styles.chevron}>▾</span>
          </span>
        </div>

        {/* ---- Portfolio market position ---- */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitleRow}>
              <span className={styles.cardTitle}>Portfolio market position</span>
              <InfoTip
                location="Top of dashboard · stacked bar"
                title="Portfolio market position"
                body="How your in-scope leases compare to current market rent, split into Below (>5% under), At (±5%), and Above (>5% over)."
                calc="Gap = (current − market rent) ÷ market rent."
              />
            </div>
          </div>

          <div className={styles.posBar} aria-hidden="true">
            <div
              className={`${styles.posSeg} ${styles.segBelow}`}
              style={{ width: pct(position.below) }}
            />
            <div
              className={`${styles.posSeg} ${styles.segAt}`}
              style={{ width: pct(position.at) }}
            />
            <div
              className={`${styles.posSeg} ${styles.segAbove}`}
              style={{ width: pct(position.above) }}
            />
          </div>

          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={`${styles.dot} ${styles.dotBelow}`} /> Below market
              (&lt;-5%) <strong>{position.below}</strong>
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.dot} ${styles.dotAt}`} /> At market (±5%){" "}
              <strong>{position.at}</strong>
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.dot} ${styles.dotAbove}`} /> Above market
              (&gt;+5%) <strong>{position.above}</strong>
            </span>
          </div>
        </section>

        {/* ---- Renewal & spend impact (proposed diverging bar) ---- */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitleRow}>
              <span className={styles.cardTitle}>Renewal &amp; spend impact</span>
              <InfoTip
                location="Section header · below the position bar"
                title="Renewal & spend impact"
                body="Today's rent vs. market on leases expiring in the selected window."
                calc="Annualized; expiring leases only."
              />
            </div>
            <span className={styles.windowSelect}>
              {ico.cal} Next 24 mo <span className={styles.chevron}>▾</span>
            </span>
          </div>

          {/* Diverging bar: opportunity (green, right) vs at-risk (red, left),
              net marker where the two forces settle. */}
          <div className={styles.diverge}>
            <div className={styles.divergeLabels}>
              <span>← Savings at risk</span>
              <span>Renegotiation opportunity →</span>
            </div>
            <div className={styles.divergeTrack}>
              <div className={styles.divergeCenter} />
              <div
                className={styles.barRisk}
                style={{ width: `${riskW}%` }}
                title={`Savings at risk ${fmtK(renewal.atRisk)}`}
              >
                −{fmtK(renewal.atRisk)}
              </div>
              <div
                className={styles.barOpp}
                style={{ width: `${oppW}%` }}
                title={`Renegotiation opportunity ${fmtK(renewal.opportunity)}`}
              >
                +{fmtK(renewal.opportunity)}
              </div>
              <div className={styles.netMarker} style={{ left: `${netLeft}%` }}>
                <span className={styles.netFlag}>
                  Net {netPositive ? "+" : "−"}
                  {fmtK(Math.abs(NET))}
                </span>
              </div>
            </div>
          </div>

          {/* Explicit equation: makes opportunity − at-risk = net legible. */}
          <div className={styles.equation}>
            <div className={styles.eqCell}>
              <span className={styles.eqLabelRow}>
                <span className={`${styles.dot} ${styles.dotAbove}`} />
                Renegotiation opportunity
                <InfoTip
                  location="Left of the equation"
                  title="Renegotiation opportunity at renewal"
                  body="Annual savings you could win by renegotiating above-market expiring leases down to market."
                  calc="Σ (current − market rent) × SF, above-market leases."
                />
              </span>
              <span className={`${styles.eqValue} ${styles.pos}`}>
                +{fmtK(renewal.opportunity)}
              </span>
              <span className={styles.eqMeta}>
                {renewal.aboveCount} above-market leases expiring
              </span>
            </div>

            <span className={styles.eqOp}>−</span>

            <div className={styles.eqCell}>
              <span className={styles.eqLabelRow}>
                <span className={`${styles.dot} ${styles.dotBelow}`} />
                Savings at risk
                <InfoTip
                  location="Middle of the equation"
                  title="Savings at risk at renewal"
                  body="Annual savings you'd lose if below-market expiring leases reset up to market."
                  calc="Σ (market − current rent) × SF, below-market leases."
                />
              </span>
              <span className={`${styles.eqValue} ${styles.neg}`}>
                {fmtK(renewal.atRisk)}
              </span>
              <span className={styles.eqMeta}>
                {renewal.belowCount} below-market leases expiring
              </span>
            </div>

            <span className={styles.eqOp}>=</span>

            <div className={`${styles.eqCell} ${styles.netCell}`}>
              <span className={styles.eqLabelRow}>
                Net renewal impact
                <InfoTip
                  location="Right of the equation"
                  title="Net renewal impact"
                  body="Net annual swing if everything renewed at market. Negative means rent goes up."
                  calc="Opportunity − savings at risk."
                />
              </span>
              <span className={`${styles.eqValue} ${styles.net}`}>
                {netPositive ? "+" : "−"}
                {fmtK(Math.abs(NET))}
              </span>
              <span className={styles.eqMeta}>
                across ${renewal.expiringSpend.toFixed(2)}M in expiring annual spend
              </span>
            </div>
          </div>

          <div className={styles.annotation}>
            <span className={styles.annotationTag}>Proposed</span>
            <span>
              The three flat stat cards become one diverging bar plus an
              explicit equation, so a broker reads{" "}
              <strong>opportunity − at-risk = net</strong> at a glance instead
              of inferring it. Net is demoted from a co-equal metric to the
              result of the two forces.
            </span>
          </div>
        </section>

        {/* ---- Geographic distribution ---- */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitleRow}>
              <span className={styles.cardTitle}>Geographic distribution</span>
              <InfoTip
                location="Above the map"
                title="Geographic distribution"
                body="Where your leases sit and each market's above/below-market split."
                calc="Same ±5% bands as market position."
              />
            </div>
            <span className={styles.mapToggle}>
              <span className={`${styles.mapToggleOpt} ${styles.on}`}>Map</span>
              <span className={styles.mapToggleOpt}>Satellite</span>
            </span>
          </div>
          <div className={styles.mapArea}>
            <p className={styles.mapNote}>
              Map markers unchanged. <strong>Proposed:</strong> size each marker
              by renegotiation opportunity ($), not lease count, so brokers see
              where the money is — not just where the leases are.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
