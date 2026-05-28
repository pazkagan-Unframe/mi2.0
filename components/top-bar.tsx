export function TopBar() {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="logo">
          One<span>Advise</span>
        </div>
        <nav className="top-nav" aria-label="Primary">
          <a>Portfolio</a>
          <a>Documents</a>
          <a>Map</a>
          <a>Dashboards</a>
          <a className="active">Intelligence</a>
          <a>Manage</a>
        </nav>
      </div>
      <div className="top-utils">
        <span>Bosch</span>
        <div className="avatar" aria-label="User">
          PK
        </div>
      </div>
    </div>
  )
}
