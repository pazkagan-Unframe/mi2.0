type Props = {
  onOpenMethodology: () => void
}

export function PageHeader({ onOpenMethodology }: Props) {
  return (
    <div className="page-header">
      <div>
        <div className="page-title">Intelligence</div>
        <div className="page-subtitle">Benchmark your portfolio against the market.</div>
      </div>
      <div className="page-actions">
        <button type="button" className="btn-ghost accent" onClick={onOpenMethodology}>
          <span className="info-glyph">i</span>
          How this is calculated
        </button>
      </div>
    </div>
  )
}
