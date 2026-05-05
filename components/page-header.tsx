type Props = {
  onOpenMethodology: () => void
}

export function PageHeader({ onOpenMethodology }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="logo">
          Halberd<span>·</span>Intelligence
        </div>
        <nav className="top-nav" aria-label="Primary">
          <a href="#" className="active">
            Portfolio
          </a>
          <a href="#">Market Browser</a>
          <a href="#">Transactions</a>
          <a href="#">Reports</a>
        </nav>
      </div>
      <div className="top-utils">
        <button
          type="button"
          className="utility-btn"
          onClick={onOpenMethodology}
          aria-label="How this is calculated"
        >
          How this is calculated
        </button>
        <div className="avatar" aria-hidden="true">
          MR
        </div>
      </div>
    </header>
  )
}
