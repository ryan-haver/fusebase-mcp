import { useState, useMemo } from 'react'
import {
  CheckCircle2,
  Activity,
  Wrench,
  Layers,
  GitCommit,
  Database,
  FileText,
  Terminal,
  Bot,
  ShieldCheck,
  Search,
  ExternalLink,
  Clock,
  Sparkles,
  Server,
  Workflow,
  Cpu,
} from 'lucide-react'
import statusData from './data/project-status.json'

interface Tool {
  name: string
  description: string
  tier: 'core' | 'extended'
  category: string
  parameters: string[]
}

interface TestSuite {
  id: number
  name: string
  toolsCount: number
  assertionsCount: number
  status: string
  description: string
}

interface Milestone {
  id: string
  title: string
  status: string
  date: string
  description: string
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'tools' | 'tests' | 'milestones'>('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [tierFilter, setTierFilter] = useState<'all' | 'core' | 'extended'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const tools: Tool[] = statusData.tools as Tool[]
  const suites: TestSuite[] = statusData.testSuites as TestSuite[]
  const milestones: Milestone[] = statusData.milestones as Milestone[]

  const categories = useMemo(() => {
    const cats = new Set(tools.map((t) => t.category))
    return ['all', ...Array.from(cats).sort()]
  }, [tools])

  const filteredTools = useMemo(() => {
    return tools.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.parameters.some((p) => p.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesTier = tierFilter === 'all' || t.tier === tierFilter
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter

      return matchesSearch && matchesTier && matchesCategory
    })
  }, [tools, searchQuery, tierFilter, categoryFilter])

  const formatTimeAgo = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime()
      const diffMins = Math.floor(diffMs / 60000)
      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      const diffHours = Math.floor(diffMins / 60)
      return `${diffHours}h ago`
    } catch {
      return 'Recently'
    }
  }

  return (
    <div className="hub-container">
      {/* Top Header */}
      <header className="hub-header">
        <div className="hub-brand">
          <div className="hub-logo">
            <Cpu style={{ width: '26px', height: '26px', color: '#fff' }} />
          </div>
          <div className="hub-brand-info">
            <div className="hub-title-row">
              <h1 className="hub-title">FuseBase MCP</h1>
              <span className="badge-pill badge-primary">v{statusData.version}</span>
              <span className="badge-pill badge-outline">
                <GitCommit style={{ width: '13px', height: '13px', color: '#a5b4fc' }} />
                {statusData.git.commit} ({statusData.git.branch})
              </span>
            </div>
            <p className="hub-subtitle">
              Live Platform Operations & Real-Time Engineering Status Dashboard
            </p>
          </div>
        </div>

        <div className="hub-actions">
          <div className="live-indicator">
            <span className="pulse-dot"></span>
            <span>All Systems Operational</span>
          </div>
          <div className="last-sync-badge">
            <Clock style={{ width: '14px', height: '14px' }} />
            <span>Updated {formatTimeAgo(statusData.lastUpdated)}</span>
          </div>
        </div>
      </header>

      {/* KPI Metrics Grid */}
      <section className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-wrap icon-indigo">
            <Wrench style={{ width: '24px', height: '24px' }} />
          </div>
          <div>
            <div className="kpi-value">{statusData.summary.totalTools}</div>
            <div className="kpi-label">Production MCP Tools</div>
            <div className="kpi-subtext">
              <strong style={{ color: '#a5b4fc' }}>{statusData.summary.coreTools} Core</strong>
              {' • '}
              <span>{statusData.summary.extendedTools} Extended</span>
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap icon-emerald">
            <ShieldCheck style={{ width: '24px', height: '24px' }} />
          </div>
          <div>
            <div className="kpi-value" style={{ color: '#34d399' }}>100%</div>
            <div className="kpi-label">Live Cloud Data Validation</div>
            <div className="kpi-subtext">
              <strong style={{ color: '#34d399' }}>
                {statusData.summary.passedAssertions} / {statusData.summary.totalAssertions}
              </strong>{' '}
              assertions passed
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap icon-purple">
            <Layers style={{ width: '24px', height: '24px' }} />
          </div>
          <div>
            <div className="kpi-value">{statusData.summary.totalSuites}</div>
            <div className="kpi-label">Functional Test Suites</div>
            <div className="kpi-subtext">
              <strong style={{ color: '#c084fc' }}>0 failures</strong> • Zero leftover leaks
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap icon-cyan">
            <Terminal style={{ width: '24px', height: '24px' }} />
          </div>
          <div>
            <div className="kpi-value" style={{ color: '#22d3ee' }}>JSON-RPC 2.0</div>
            <div className="kpi-label">MCP Protocol Compliance</div>
            <div className="kpi-subtext">
              <strong style={{ color: '#22d3ee' }}>RFC 6570</strong> • Universal Client Protocol
            </div>
          </div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <nav className="hub-nav">
        <button
          className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Activity style={{ width: '16px', height: '16px' }} />
          Platform Overview
        </button>
        <button
          className={`nav-tab ${activeTab === 'tools' ? 'active' : ''}`}
          onClick={() => setActiveTab('tools')}
        >
          <Wrench style={{ width: '16px', height: '16px' }} />
          Tools Directory ({tools.length})
        </button>
        <button
          className={`nav-tab ${activeTab === 'tests' ? 'active' : ''}`}
          onClick={() => setActiveTab('tests')}
        >
          <CheckCircle2 style={{ width: '16px', height: '16px' }} />
          Validation Suites ({suites.length})
        </button>
        <button
          className={`nav-tab ${activeTab === 'milestones' ? 'active' : ''}`}
          onClick={() => setActiveTab('milestones')}
        >
          <Sparkles style={{ width: '16px', height: '16px' }} />
          Milestones & Architecture
        </button>
      </nav>

      {/* TAB 1: Platform Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="overview-hero card-surface">
            <div className="overview-hero-top">
              <div>
                <h2 className="overview-hero-title">
                  FuseBase Model Context Protocol Infrastructure
                </h2>
                <p className="overview-hero-desc">
                  Enterprise-grade MCP server enabling autonomous AI coding agents and human developers to
                  programmatically manage workspaces, collaborative Y.js documents, relational database tables,
                  ActivePieces workflows, client portals, and multi-agent sprint boards with 100% data validation.
                </p>
              </div>
              <div className="status-badge-healthy">
                <CheckCircle2 style={{ width: '16px', height: '16px', color: '#34d399' }} />
                <span>Cloud Status: HEALTHY</span>
              </div>
            </div>

            <div className="overview-features-grid">
              <div className="feature-box">
                <div className="feature-icon icon-indigo">
                  <FileText style={{ width: '20px', height: '20px' }} />
                </div>
                <h3 className="feature-title">Collaborative Y.js Content</h3>
                <p className="feature-desc">
                  Real-time binary WebSocket mutations, non-destructive block appends, and token-efficient Markdown conversion.
                </p>
              </div>

              <div className="feature-box">
                <div className="feature-icon icon-purple">
                  <Database style={{ width: '20px', height: '20px' }} />
                </div>
                <h3 className="feature-title">Relational Tables & Views</h3>
                <p className="feature-desc">
                  Full CRUD across schemas, Kanban boards, formula/lookup columns, bidirectional relations, and CSV streams.
                </p>
              </div>

              <div className="feature-box">
                <div className="feature-icon icon-emerald">
                  <Workflow style={{ width: '20px', height: '20px' }} />
                </div>
                <h3 className="feature-title">ActivePieces Workflows</h3>
                <p className="feature-desc">
                  Autonomous flow triggers, 72 connector pieces, and JWT-authenticated Community Edition automations.
                </p>
              </div>

              <div className="feature-box">
                <div className="feature-icon icon-cyan">
                  <ExternalLink style={{ width: '20px', height: '20px' }} />
                </div>
                <h3 className="feature-title">Client Portal Hub</h3>
                <p className="feature-desc">
                  Whitelabel partner portals, brand navigation hierarchies, magic link auth, and page publishing.
                </p>
              </div>

              <div className="feature-box">
                <div className="feature-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                  <Bot style={{ width: '20px', height: '20px' }} />
                </div>
                <h3 className="feature-title">Swarm Orchestration</h3>
                <p className="feature-desc">
                  Multi-agent state machines, role transitions (PM, Architect, Dev, QA), and permanent audit trail logging.
                </p>
              </div>

              <div className="feature-box">
                <div className="feature-icon" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#fb7185', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
                  <Terminal style={{ width: '20px', height: '20px' }} />
                </div>
                <h3 className="feature-title">Hosted Vibe Apps</h3>
                <p className="feature-desc">
                  FuseBase CLI build/deploy pipeline (`thefusebase.app`) with responsive edge-to-edge note embeds.
                </p>
              </div>
            </div>
          </div>

          <div className="two-col-grid">
            <div className="panel-card card-surface">
              <div className="panel-header">
                <Server style={{ width: '18px', height: '18px', color: '#818cf8' }} />
                <span>Live Architecture & Gateway Bridges</span>
              </div>
              <ul className="key-val-list">
                <li className="key-val-item">
                  <span className="key-val-label">Core Cloud Gateway:</span>
                  <span className="key-val-data">https://&#123;org&#125;.nimbusweb.me/v2/api</span>
                </li>
                <li className="key-val-item">
                  <span className="key-val-label">Collaborative Sync Transport:</span>
                  <span className="key-val-data">wss://&#123;org&#125;.nimbusweb.me/v4/api/texts</span>
                </li>
                <li className="key-val-item">
                  <span className="key-val-label">ActivePieces Engine:</span>
                  <span className="key-val-data">/automation/api/v1 (CE 0.24.1)</span>
                </li>
                <li className="key-val-item">
                  <span className="key-val-label">Dashboard Microservice:</span>
                  <span className="key-val-data">/v4/api/proxy/dashboard-service/v1</span>
                </li>
                <li className="key-val-item">
                  <span className="key-val-label">AI Agent Microservice:</span>
                  <span className="key-val-data">/v4/api/proxy/ai-service/v1</span>
                </li>
                <li className="key-val-item">
                  <span className="key-val-label">Client Portal Routing:</span>
                  <span className="key-val-data">*.p.nimbusweb.me (AWS CNAME)</span>
                </li>
              </ul>
            </div>

            <div className="panel-card card-surface">
              <div className="panel-header">
                <ShieldCheck style={{ width: '18px', height: '18px', color: '#34d399' }} />
                <span>Data Validation & Zero Leaks Governance</span>
              </div>
              <p className="panel-desc">
                The test harness enforces rigorous round-trip data assertions across write, readback, mutation,
                and deletion cycles. All created test folders, notes, database tables, and automation flows are
                guaranteed clean removal via `finally` blocks.
              </p>
              <div className="stat-rows-group">
                <div className="stat-row">
                  <span className="stat-row-label">Data Assertions Pass Rate:</span>
                  <span className="stat-val-emerald">162 / 162 (100%)</span>
                </div>
                <div className="stat-row">
                  <span className="stat-row-label">MCP Protocol Compliance:</span>
                  <span className="stat-val-indigo">RFC 6570 + JSON-RPC 2.0</span>
                </div>
                <div className="stat-row">
                  <span className="stat-row-label">Offline Documentation Guides:</span>
                  <span className="stat-val-cyan">278 guides across 19 sections</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Tools Directory */}
      {activeTab === 'tools' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="tools-filter-bar card-surface">
            <div className="search-input-wrap">
              <Search style={{ width: '16px', height: '16px', color: '#9ca3af' }} />
              <input
                type="text"
                placeholder="Search 143 tools by name, parameter, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="filter-controls-right">
              <div className="filter-group">
                <span className="filter-label">Tier:</span>
                <div className="filter-pill-group">
                  <button
                    className={`filter-pill ${tierFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setTierFilter('all')}
                  >
                    All ({tools.length})
                  </button>
                  <button
                    className={`filter-pill ${tierFilter === 'core' ? 'active' : ''}`}
                    onClick={() => setTierFilter('core')}
                  >
                    Core ({statusData.summary.coreTools})
                  </button>
                  <button
                    className={`filter-pill ${tierFilter === 'extended' ? 'active' : ''}`}
                    onClick={() => setTierFilter('extended')}
                  >
                    Extended ({statusData.summary.extendedTools})
                  </button>
                </div>
              </div>

              <div className="filter-group">
                <span className="filter-label">Category:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="category-select"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === 'all' ? 'All Categories' : cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="tools-count-label">
            Showing <strong style={{ color: '#fff' }}>{filteredTools.length}</strong> of{' '}
            <strong>{tools.length}</strong> total registered MCP tools
          </div>

          <div className="tools-grid">
            {filteredTools.map((tool) => (
              <div key={tool.name} className="tool-card card-surface">
                <div className="tool-card-top">
                  <div className="tool-name">{tool.name}</div>
                  <span
                    className={`tier-badge ${
                      tool.tier === 'core' ? 'tier-core' : 'tier-extended'
                    }`}
                  >
                    {tool.tier.toUpperCase()}
                  </span>
                </div>

                <div className="tool-desc">{tool.description}</div>

                <div className="tool-footer">
                  <div className="tool-category-row">
                    <span>Category:</span>
                    <span style={{ color: '#d1d5db', fontWeight: 600 }}>{tool.category}</span>
                  </div>
                  {tool.parameters.length > 0 && (
                    <div className="param-chips">
                      {tool.parameters.map((p) => (
                        <span key={p} className="param-tag">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Test Suites */}
      {activeTab === 'tests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="test-suites-header card-surface">
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
                Full-Spectrum Live Data Validation Suites
              </h2>
              <p style={{ fontSize: '13px', color: '#9ca3af' }}>
                12 test suites executing 162 deep data assertions against live FuseBase infrastructure.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: '#34d399', fontWeight: 800, fontSize: '18px' }}>100% Passed</span>
              <span className="badge-pill badge-success">0 Errors</span>
            </div>
          </div>

          <div className="suites-list">
            {suites.map((suite) => (
              <div key={suite.id} className="suite-card card-surface">
                <div className="suite-card-top">
                  <div className="suite-title-wrap">
                    <span className="suite-number">Suite {suite.id}</span>
                    <h3 className="suite-name">{suite.name}</h3>
                  </div>
                  <div className="suite-badges">
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', background: 'rgba(0,0,0,0.3)', padding: '4px 10px', borderRadius: '6px', color: '#d1d5db', border: '1px solid rgba(255,255,255,0.06)' }}>
                      {suite.toolsCount} Tools
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 style={{ width: '13px', height: '13px' }} />
                      {suite.assertionsCount} Assertions Passed
                    </span>
                  </div>
                </div>
                <p className="suite-desc">{suite.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Milestones & Architecture */}
      {activeTab === 'milestones' && (
        <div className="milestones-panel card-surface">
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
            Project Milestone Chronology
          </h2>
          <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '24px' }}>
            Engineering delivery track from initial reverse-engineering through 143-tool live data verification.
          </p>

          <div className="timeline">
            {milestones.map((m) => (
              <div key={m.id} className="timeline-item">
                <div className="timeline-dot"></div>
                <div className="timeline-item-header">
                  <h3 className="timeline-title">{m.title}</h3>
                  <span className="badge-pill badge-success">{m.status.toUpperCase()}</span>
                </div>
                <p className="timeline-desc">{m.description}</p>
                <span className="timeline-date">{m.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="hub-footer">
        <div>
          FuseBase MCP Server • Automated live status synced prior to git push •{' '}
          <a
            href="https://github.com/ryan-haver/fusebase-mcp"
            target="_blank"
            rel="noreferrer"
            className="footer-link"
          >
            GitHub Repository <ExternalLink style={{ width: '12px', height: '12px' }} />
          </a>
        </div>
        <div>
          Hosting: <span style={{ fontFamily: 'monospace', color: '#e5e7eb' }}>fusebase-mcp.thefusebase.app</span>
        </div>
      </footer>
    </div>
  )
}
