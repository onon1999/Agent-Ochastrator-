import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Send, Trash2, Bot, User, Loader2, Edit2, RefreshCw } from 'lucide-react'
import { api } from '../api'

function Message({ msg }) {
  const isUser = msg.role === 'user'
  const isSystem = msg.role === 'system'

  if (isSystem) return (
    <div style={{ textAlign: 'center', margin: '8px 0' }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '3px 10px', background: 'var(--bg-elevated)', borderRadius: 20 }}>
        {msg.content}
      </span>
    </div>
  )

  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
      gap: 8,
      marginBottom: 14,
      animation: 'fadeIn 0.2s ease',
    }}>
      {/* Avatar */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: isUser ? 'var(--accent-glow)' : 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
        border: isUser ? '1px solid var(--accent)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isUser ? <User size={13} color="var(--accent)" /> : <Bot size={13} color="#fff" />}
      </div>

      {/* Bubble */}
      <div style={{
        maxWidth: '72%',
        padding: '10px 14px',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: isUser ? 'var(--accent)' : 'var(--bg-elevated)',
        border: isUser ? 'none' : '1px solid var(--border)',
        fontSize: 13,
        lineHeight: 1.6,
        color: isUser ? '#fff' : 'var(--text-primary)',
        whiteSpace: 'pre-wrap',
      }}>
        {msg.content}
        {msg.escalated && (
          <div style={{ marginTop: 8, padding: '4px 8px', background: 'rgba(255,181,71,0.15)', borderRadius: 6, fontSize: 11, color: 'var(--warning)' }}>
            ⚡ Escalated to human
          </div>
        )}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 14 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Bot size={13} color="#fff" />
      </div>
      <div style={{
        padding: '10px 14px', background: 'var(--bg-elevated)',
        border: '1px solid var(--border)', borderRadius: '16px 16px 16px 4px',
        display: 'flex', gap: 4, alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)',
            animation: 'pulse 1.2s ease infinite',
            animationDelay: `${i * 0.2}s`,
          }} />
        ))}
      </div>
    </div>
  )
}

export default function ChatTest() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [agent, setAgent] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId] = useState(() => crypto.randomUUID())
  const [sessions, setSessions] = useState([])  // Always array
  const [activeSession, setActiveSession] = useState(sessionId)
  const [error, setError] = useState(null)

  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    api.getAgent(id).then(data => {
      setAgent(data)
      // Show greeting if configured
      const greeting = data.behavior?.greeting_message
      if (greeting) {
        setMessages([{ role: 'assistant', content: greeting, id: 'greeting' }])
      }
    }).catch(e => setError(e.message))
    api.listSessions(id).then(data => setSessions(data || [])).catch(() => setSessions([]))
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg = { role: 'user', content: text, id: crypto.randomUUID() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const res = await api.sendMessage(id, text, activeSession)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.message,
        escalated: res.escalated,
        id: crypto.randomUUID(),
      }])
      // Refresh sessions
      api.listSessions(id).then(data => setSessions(data || [])).catch(() => setSessions([]))
    } catch (e) {
      setError(e.message)
      setMessages(prev => [...prev, {
        role: 'system',
        content: `⚠ Error: ${e.message}`,
        id: crypto.randomUUID(),
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const clearChat = () => {
    setMessages(agent?.behavior?.greeting_message
      ? [{ role: 'assistant', content: agent.behavior.greeting_message, id: 'greeting' }]
      : []
    )
    setError(null)
    // Create new session
    setActiveSession(crypto.randomUUID())
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  if (!agent) return (
    <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 13 }} className="pulse">
      Loading agent...
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sessions sidebar */}
      <div style={{
        width: 220, borderRight: '1px solid var(--border)',
        background: 'var(--bg-surface)', padding: '14px 10px',
        overflow: 'auto', flexShrink: 0,
      }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10, padding: '0 6px' }}>
          Sessions
        </div>
        {(sessions || []).length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 6px' }}>No sessions yet</div>
        )}
        {(sessions || []).map(s => (
          <div
            key={s.id || s.session_id}
            style={{
              padding: '8px 10px', borderRadius: 8, marginBottom: 4, cursor: 'pointer',
              background: (s.id || s.session_id) === activeSession ? 'var(--accent-glow)' : 'transparent',
              border: `1px solid ${(s.id || s.session_id) === activeSession ? 'rgba(91,139,255,0.3)' : 'transparent'}`,
              transition: 'all 0.15s',
            }}
            onClick={() => setActiveSession(s.id || s.session_id)}
          >
            <div style={{ fontSize: 11, color: (s.id || s.session_id) === activeSession ? 'var(--accent)' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {(s.id || s.session_id || '').toString().slice(0, 8)}...
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
              {s.message_count || 0} msgs
            </div>
            {s.last_message && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.last_message}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Main chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button className="btn-ghost" onClick={() => navigate('/')} style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <ChevronLeft size={13} /> Back
          </button>

          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bot size={16} color="#fff" />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{agent.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {agent.llm_config?.model} · {(agent.workflow_steps || []).length} workflow steps
            </div>
          </div>

          <button
            onClick={() => navigate(`/agents/${id}/edit`)}
            className="btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
          >
            <Edit2 size={12} /> Edit Agent
          </button>
          <button
            onClick={clearChat}
            className="btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            title="Clear conversation"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--text-muted)' }}>
              <Bot size={36} color="var(--border)" style={{ marginBottom: 16 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Start a conversation
              </div>
              <div style={{ fontSize: 12 }}>
                Send a message to test your agent
              </div>
              <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {['Hello!', 'What can you help me with?', 'Tell me about yourself'].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => { setInput(suggestion); inputRef.current?.focus() }}
                    style={{
                      padding: '6px 14px', background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)', borderRadius: 20,
                      fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => <Message key={msg.id} msg={msg} />)}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid var(--border)',
          background: 'var(--bg-surface)',
        }}>
          {error && (
            <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8, padding: '6px 10px', background: 'rgba(255,85,119,0.08)', borderRadius: 6 }}>
              ⚠ {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              className="input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
              style={{ flex: 1, minHeight: 44, maxHeight: 140, resize: 'none' }}
              disabled={loading}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              style={{
                width: 44, height: 44, borderRadius: 10, border: 'none',
                background: input.trim() && !loading ? 'var(--accent)' : 'var(--bg-elevated)',
                color: input.trim() && !loading ? '#fff' : 'var(--text-muted)',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s', flexShrink: 0,
              }}
            >
              {loading ? <Loader2 size={16} className="pulse" /> : <Send size={16} />}
            </button>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>
            Session: <span style={{ fontFamily: 'var(--font-mono)' }}>{activeSession.slice(0, 8)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
