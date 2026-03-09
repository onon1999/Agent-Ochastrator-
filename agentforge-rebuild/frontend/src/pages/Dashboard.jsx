import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, MessageSquare, Copy, Trash2, Edit2, Plus, Zap, Clock } from 'lucide-react'
import { api } from '../api'

const AGENT_TYPE_COLORS = {
  custom: { bg: '#5B8BFF20', color: '#5B8BFF', label: 'Custom' },
  support: { bg: '#00DDB320', color: '#00DDB3', label: 'Support' },
  knowledge: { bg: '#FFB54720', color: '#FFB547', label: 'Knowledge' },
  lead_gen: { bg: '#FF6B9D20', color: '#FF6B9D', label: 'Lead Gen' },
}

function AgentCard({ agent, onDelete, onDuplicate }) {
  const navigate = useNavigate()
  const typeStyle = AGENT_TYPE_COLORS[agent.agent_type] || AGENT_TYPE_COLORS.custom
  const stepCount = (agent.workflow_steps || []).length

  return (
    <div
      className="card fade-in"
      style={{ padding: 20, transition: 'border-color 0.15s', cursor: 'default' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: typeStyle.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bot size={18} color={typeStyle.color} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{agent.name}</div>
            <span className="tag" style={{ background: typeStyle.bg, color: typeStyle.color, marginTop: 2 }}>
              {typeStyle.label}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 4 }}>
          <IconBtn icon={<Edit2 size={13} />} title="Edit" onClick={() => navigate(`/agents/${agent.id}/edit`)} />
          <IconBtn icon={<MessageSquare size={13} />} title="Test chat" onClick={() => navigate(`/agents/${agent.id}/chat`)} accent />
          <IconBtn icon={<Copy size={13} />} title="Duplicate" onClick={() => onDuplicate(agent.id)} />
          <IconBtn icon={<Trash2 size={13} />} title="Delete" onClick={() => onDelete(agent.id)} danger />
        </div>
      </div>

      {/* Description */}
      {agent.description && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
          {agent.description}
        </p>
      )}

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <Stat label="Steps" value={stepCount} />
        <Stat label="Model" value={agent.llm_config?.model || 'gpt-4o'} mono />
        <Stat label="Temp" value={agent.llm_config?.temperature ?? 0.7} />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} color="var(--text-muted)" />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {new Date(agent.updated_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Test button */}
      <button
        onClick={() => navigate(`/agents/${agent.id}/chat`)}
        style={{
          width: '100%', marginTop: 14, padding: '8px',
          background: 'var(--accent-glow)', color: 'var(--accent)',
          border: '1px solid rgba(91,139,255,0.25)', borderRadius: 8,
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(91,139,255,0.2)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-glow)' }}
      >
        <MessageSquare size={13} />
        Test Agent
      </button>
    </div>
  )
}

function Stat({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: mono ? 'var(--font-mono)' : undefined, marginTop: 2 }}>
        {value}
      </div>
    </div>
  )
}

function IconBtn({ icon, title, onClick, accent, danger }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 28, height: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: '1px solid var(--border)',
        borderRadius: 6, color: danger ? 'var(--danger)' : accent ? 'var(--accent)' : 'var(--text-muted)',
        cursor: 'pointer', transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent' }}
    >
      {icon}
    </button>
  )
}

export default function Dashboard() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.listAgents()
      setAgents(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!confirm('Delete this agent?')) return
    await api.deleteAgent(id)
    setAgents(a => a.filter(ag => ag.id !== id))
  }

  const handleDuplicate = async (id) => {
    const copy = await api.duplicateAgent(id)
    setAgents(a => [copy, ...a])
  }

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>Your Agents</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {agents.length} agent{agents.length !== 1 ? 's' : ''} · Custom workflow automation
          </p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/agents/new')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} />
          New Agent
        </button>
      </div>

      {/* States */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div className="pulse" style={{ fontSize: 13 }}>Loading agents...</div>
        </div>
      )}

      {error && (
        <div style={{ padding: 16, background: 'rgba(255,85,119,0.1)', border: '1px solid var(--danger)', borderRadius: 10, color: 'var(--danger)', fontSize: 13 }}>
          ⚠ {error} — Is the backend running? <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>uvicorn backend.main:app</code>
        </div>
      )}

      {!loading && !error && agents.length === 0 && (
        <div style={{
          padding: 60, textAlign: 'center',
          border: '1px dashed var(--border)', borderRadius: 16,
          color: 'var(--text-muted)',
        }}>
          <Zap size={36} color="var(--border)" style={{ marginBottom: 16 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>No agents yet</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Build your first workflow automation agent</div>
          <button className="btn-primary" onClick={() => navigate('/agents/new')}>
            Create First Agent
          </button>
        </div>
      )}

      {/* Grid */}
      {agents.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 16,
        }}>
          {agents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
