import { useState } from 'react'

interface Milestone {
  id: string
  title: string
  status: 'completed' | 'in-progress' | 'pending'
  date: string
  owner: string
  category: string
}

const INITIAL_MILESTONES: Milestone[] = [
  { id: 'm1', title: 'Client Onboarding & Scope Alignment', status: 'completed', date: 'Sept 4, 2026', owner: 'Ryan Haver', category: 'Strategy' },
  { id: 'm2', title: 'Ecosystem Architecture & MCP Bridge Design', status: 'completed', date: 'Sept 8, 2026', owner: 'Agent Architect', category: 'Architecture' },
  { id: 'm3', title: 'Portal Customizer & Hub Integration Sprint', status: 'in-progress', date: 'Sept 12, 2026', owner: 'Agent Dev', category: 'Engineering' },
  { id: 'm4', title: 'Security Audit & Rate-Limit Hardening', status: 'pending', date: 'Sept 18, 2026', owner: 'Agent QA', category: 'Security' },
  { id: 'm5', title: 'Final Client Portal Go-Live & Handover', status: 'pending', date: 'Sept 25, 2026', owner: 'Agent PM', category: 'Release' },
]

export default function App() {
  const [milestones, setMilestones] = useState<Milestone[]>(INITIAL_MILESTONES)
  const [activeTab, setActiveTab] = useState<'overview' | 'milestones' | 'requests'>('overview')
  const [requests, setRequests] = useState<Array<{ id: string; text: string; date: string; priority: string }>>([
    { id: 'r1', text: 'Enable custom CNAME domain verification for partner portal', date: 'Today, 2:15 PM', priority: 'High' },
    { id: 'r2', text: 'Add ActivePieces webhook trigger on form submission', date: 'Yesterday', priority: 'Medium' },
  ])
  const [newRequestText, setNewRequestText] = useState('')
  const [newPriority, setNewPriority] = useState('Medium')
  const [filter, setFilter] = useState<'all' | 'completed' | 'in-progress' | 'pending'>('all')

  const toggleMilestone = (id: string) => {
    setMilestones((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m
        const nextStatus: Record<string, Milestone['status']> = {
          pending: 'in-progress',
          'in-progress': 'completed',
          completed: 'pending',
        }
        return { ...m, status: nextStatus[m.status] }
      })
    )
  }

  const handleAddRequest = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRequestText.trim()) return
    setRequests([
      {
        id: `r-${Date.now()}`,
        text: newRequestText.trim(),
        date: 'Just now',
        priority: newPriority,
      },
      ...requests,
    ])
    setNewRequestText('')
  }

  const completedCount = milestones.filter((m) => m.status === 'completed').length
  const progressPercent = Math.round((completedCount / milestones.length) * 100)

  const filteredMilestones = filter === 'all' ? milestones : milestones.filter((m) => m.status === filter)

  return (
    <div className="hub-container">
      {/* Top Header */}
      <header className="hub-header">
        <div className="hub-brand">
          <div className="hub-logo">FB</div>
          <div>
            <h1 className="hub-title">FuseBase Client Hub & Portal Dashboard</h1>
            <p className="hub-subtitle">Real-time Project Execution & Client Delivery Portal</p>
          </div>
        </div>
        <div className="hub-actions">
          <span className="live-indicator">
            <span className="pulse-dot"></span> Live Sync Active
          </span>
          <button id="export-summary-btn" className="btn btn-secondary" onClick={() => alert('Project Summary Exported!')}>
            Export Summary
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="hub-nav">
        <button
          id="nav-overview-tab"
          className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview & Metrics
        </button>
        <button
          id="nav-milestones-tab"
          className={`nav-tab ${activeTab === 'milestones' ? 'active' : ''}`}
          onClick={() => setActiveTab('milestones')}
        >
          Delivery Milestones ({milestones.length})
        </button>
        <button
          id="nav-requests-tab"
          className={`nav-tab ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          Client Requests ({requests.length})
        </button>
      </nav>

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Delivery Velocity</div>
          <div className="metric-value">{progressPercent}%</div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <span className="metric-subtext">{completedCount} of {milestones.length} milestones complete</span>
        </div>

        <div className="metric-card">
          <div className="metric-label">Client Portal Status</div>
          <div className="metric-value status-ready">Active</div>
          <div className="metric-pill">Whitelabel Enabled</div>
          <span className="metric-subtext">Domain: test-portal-88229977</span>
        </div>

        <div className="metric-card">
          <div className="metric-label">Active Agents</div>
          <div className="metric-value">10 Profiles</div>
          <div className="metric-pill pill-violet">Swarm Ready</div>
          <span className="metric-subtext">Architect, Dev, QA, PM sync</span>
        </div>

        <div className="metric-card">
          <div className="metric-label">Total MCP Tools</div>
          <div className="metric-value status-cyan">113 Tools</div>
          <div className="metric-pill pill-cyan">Core + Extended</div>
          <span className="metric-subtext">Y.js real-time collaborative state</span>
        </div>
      </div>

      {/* Tab Content: Overview & Milestones */}
      {(activeTab === 'overview' || activeTab === 'milestones') && (
        <section className="hub-section">
          <div className="section-header">
            <div>
              <h2 className="section-title">Milestone Progress & Delivery Timeline</h2>
              <p className="section-desc">Click any milestone card to advance its state (Pending → In Progress → Completed)</p>
            </div>
            <div className="filter-group">
              {(['all', 'completed', 'in-progress', 'pending'] as const).map((f) => (
                <button
                  key={f}
                  id={`filter-${f}-btn`}
                  className={`filter-btn ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="milestones-list">
            {filteredMilestones.map((m) => (
              <div
                key={m.id}
                id={`milestone-${m.id}`}
                className={`milestone-card status-${m.status}`}
                onClick={() => toggleMilestone(m.id)}
              >
                <div className="milestone-status-indicator">
                  {m.status === 'completed' && '✓'}
                  {m.status === 'in-progress' && '⏳'}
                  {m.status === 'pending' && '○'}
                </div>
                <div className="milestone-body">
                  <div className="milestone-title-row">
                    <span className="milestone-title">{m.title}</span>
                    <span className={`badge badge-${m.status}`}>{m.status.toUpperCase()}</span>
                  </div>
                  <div className="milestone-meta">
                    <span>Target: {m.date}</span>
                    <span>Lead: {m.owner}</span>
                    <span className="category-tag">{m.category}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tab Content: Client Requests */}
      {(activeTab === 'overview' || activeTab === 'requests') && (
        <section className="hub-section">
          <div className="section-header">
            <div>
              <h2 className="section-title">Client Requests & Change Log</h2>
              <p className="section-desc">Submit new items or view pending change orders</p>
            </div>
          </div>

          <form id="new-request-form" className="request-form" onSubmit={handleAddRequest}>
            <input
              id="request-input"
              type="text"
              placeholder="Enter new feature request or update description..."
              className="form-input"
              value={newRequestText}
              onChange={(e) => setNewRequestText(e.target.value)}
            />
            <select
              id="request-priority-select"
              className="form-select"
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
            >
              <option value="Low">Low Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="High">High Priority</option>
            </select>
            <button id="submit-request-btn" type="submit" className="btn btn-primary">
              Post Request
            </button>
          </form>

          <div className="requests-list">
            {requests.map((r) => (
              <div key={r.id} className="request-item">
                <div className="request-text">{r.text}</div>
                <div className="request-meta">
                  <span className={`priority-badge priority-${r.priority.toLowerCase()}`}>{r.priority}</span>
                  <span className="request-date">{r.date}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="hub-footer">
        <div>Powered by <strong>FuseBase Cloud Apps</strong> &amp; <strong>Antigravity Engine</strong></div>
        <div className="footer-links">
          <span>Org: Inkabeam (u268r1)</span>
          <span>Workspace: 49b306wxd9oa7hyc</span>
          <span>Protocol: MCP 2024-11-05</span>
        </div>
      </footer>
    </div>
  )
}
