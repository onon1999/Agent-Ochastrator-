import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft, Save, Play, Plus, Trash2, GripVertical,
  Bot, Settings, Workflow, Shield, ChevronDown, ChevronUp, Info, BookOpen, Wrench
} from 'lucide-react'
import { api } from '../api'
import KnowledgeBase from '../components/KnowledgeBase'

const STEP_TYPES = [
  { type: 'instruction', label: 'Instruction', color: '#5B8BFF', desc: 'Tell the agent what to do at this stage' },
  { type: 'transform', label: 'Transform Input', color: '#00DDB3', desc: 'Pre-process user input before LLM call' },
  { type: 'output_format', label: 'Format Output', color: '#FFB547', desc: "Shape the agent's final response" },
  { type: 'condition', label: 'Condition (Phase 3)', color: '#FF6B9D', desc: 'Branch based on user input', disabled: true },
]

// ONLY YOUR MODELS
const GROK_MODELS = ['grok-2-1212', 'grok-2-vision-1212', 'grok-vision-beta']
const OLLAMA_MODELS = ['gemma2:2b', 'gemma-lean:latest', 'mymodel:latest']

const DEFAULT_AGENT = {
  name: '', description: '', persona: '', agent_type: 'custom',
  llm_config: { provider: 'ollama', model: 'gemma2:2b', temperature: 0.7, max_tokens: 1000 },
  workflow_steps: [],
  behavior: {
    fallback_message: "I'm not sure how to help with that. Could you rephrase?",
    escalate_keywords: [], max_turns: 20, greeting_message: '', collect_fields: [],
  },
  enabled_tools: [],
}

function Section({ icon, title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.2px' }}>{title}</span>
        </div>
        {open ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
      </button>
      {open && <div style={{ padding: '4px 18px 18px', borderTop: '1px solid var(--border)' }}>{children}</div>}
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <label style={{ margin: 0 }}>{label}</label>
        {hint && <span title={hint}><Info size={11} color="var(--text-muted)" /></span>}
      </div>
      {children}
    </div>
  )
}

function StepCard({ step, index, onChange, onDelete }) {
  const typeInfo = STEP_TYPES.find(t => t.type === step.step_type) || STEP_TYPES[0]
  return (
    <div style={{ background: 'var(--bg-base)', border: `1px solid ${typeInfo.color}30`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ color: 'var(--text-muted)', cursor: 'grab', flexShrink: 0 }}><GripVertical size={14} /></div>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: typeInfo.color, color: '#000', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{index + 1}</div>
        <select value={step.step_type} onChange={e => onChange({ ...step, step_type: e.target.value })} className="input" style={{ flex: '0 0 auto', width: 'auto', padding: '4px 8px', fontSize: 12 }}>
          {STEP_TYPES.filter(t => !t.disabled).map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
        </select>
        <input className="input" style={{ fontSize: 12, padding: '4px 8px' }} placeholder="Step name..." value={step.name} onChange={e => onChange({ ...step, name: e.target.value })} />
        <button onClick={onDelete} title="Remove step" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 2, flexShrink: 0 }}><Trash2 size={13} /></button>
      </div>
      <input className="input" placeholder={typeInfo.desc} value={step.description || ''} onChange={e => onChange({ ...step, description: e.target.value })} style={{ fontSize: 12, marginBottom: step.step_type !== 'instruction' ? 8 : 0 }} />
      {(step.step_type === 'transform' || step.step_type === 'output_format') && (
        <textarea className="input" placeholder={step.step_type === 'transform' ? 'System prompt for transforming user input...' : 'System prompt for formatting the response...'} value={step.config?.prompt || step.config?.format_prompt || ''} onChange={e => onChange({ ...step, config: step.step_type === 'transform' ? { prompt: e.target.value } : { format_prompt: e.target.value } })} style={{ fontSize: 12, marginTop: 8, minHeight: 60 }} />
      )}
    </div>
  )
}

function CollectFieldsEditor({ fields, onChange }) {
  const addField = () => onChange([...fields, { name: '', label: '', description: '', required: true }])
  const updateField = (i, f) => { const arr = [...fields]; arr[i] = f; onChange(arr) }
  const removeField = (i) => onChange(fields.filter((_, idx) => idx !== i))
  return (
    <div>
      {fields.map((f, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <input className="input" placeholder="Field name (id)" value={f.name} onChange={e => updateField(i, { ...f, name: e.target.value })} style={{ fontSize: 12 }} />
          <input className="input" placeholder="Display label" value={f.label} onChange={e => updateField(i, { ...f, label: e.target.value })} style={{ fontSize: 12 }} />
          <input className="input" placeholder="Description" value={f.description} onChange={e => updateField(i, { ...f, description: e.target.value })} style={{ fontSize: 12 }} />
          <button onClick={() => removeField(i)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={13} /></button>
        </div>
      ))}
      <button className="btn-ghost" onClick={addField} style={{ fontSize: 12, padding: '6px 12px', marginTop: 4 }}><Plus size={12} style={{ marginRight: 4 }} /> Add Field</button>
    </div>
  )
}

function Tab({ label, icon, active, onClick, badge }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: active ? 'var(--accent-glow)' : 'transparent', border: `1px solid ${active ? 'rgba(91,139,255,0.35)' : 'var(--border)'}`, borderRadius: 8, color: active ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
      {icon}{label}
      {badge != null && badge > 0 && (
        <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, marginLeft: 2 }}>{badge}</span>
      )}
    </button>
  )
}

export default function AgentBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = !!id

  const [agent, setAgent] = useState(DEFAULT_AGENT)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState('identity')
  const [knowledgeCount, setKnowledgeCount] = useState(0)
  const [availableTools, setAvailableTools] = useState([])
  const [loadingTools, setLoadingTools] = useState(false)



  const loadTools = async () => {
    setLoadingTools(true)
    try {
      const tools = await api.listTools(true) // Only enabled tools
      setAvailableTools(tools)
    } catch (e) {
      console.error('Failed to load tools:', e)
    } finally {
      setLoadingTools(false)
    }
  }

  useEffect(() => {
    // Load tools on mount
    loadTools()
    
    if (!isEdit) return
    
    api.getAgent(id).then(data => {
      const loadedAgent = {
        ...DEFAULT_AGENT,
        ...data,
        llm_config: { ...DEFAULT_AGENT.llm_config, ...data.llm_config },
        behavior: { ...DEFAULT_AGENT.behavior, ...data.behavior },
        workflow_steps: data.workflow_steps || [],
        enabled_tools: data.enabled_tools || []
      }
      setAgent(loadedAgent)
      setLoading(false)
    }).catch(e => { setError(e.message); setLoading(false) })
    
    api.listDocuments(id).then(docs => setKnowledgeCount(docs.length || 0)).catch(() => {})
  }, [id, isEdit])

  const set = (path, value) => {
    setAgent(prev => {
      const keys = path.split('.')
      if (keys.length === 1) return { ...prev, [path]: value }
      return { ...prev, [keys[0]]: { ...prev[keys[0]], [keys[1]]: value } }
    })
  }

  const addStep = () => {
    const newStep = { id: crypto.randomUUID(), step_type: 'instruction', name: 'New Step', description: '', config: {}, order: agent.workflow_steps.length }
    setAgent(prev => ({ ...prev, workflow_steps: [...prev.workflow_steps, newStep] }))
  }

  const updateStep = (i, step) => { const steps = [...agent.workflow_steps]; steps[i] = { ...step, order: i }; setAgent(prev => ({ ...prev, workflow_steps: steps })) }
  const removeStep = (i) => { setAgent(prev => ({ ...prev, workflow_steps: prev.workflow_steps.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx })) })) }

  const handleSave = async () => {
    if (!agent.name.trim()) { setError('Agent name is required'); return }
    if (!agent.persona.trim()) { setError('Agent persona is required'); return }
    setError(null); setSaving(true)
    try {
      const payload = { ...agent, behavior: { ...agent.behavior, escalate_keywords: typeof agent.behavior.escalate_keywords === 'string' ? agent.behavior.escalate_keywords.split(',').map(s => s.trim()).filter(Boolean) : agent.behavior.escalate_keywords } }
      const result = isEdit ? await api.updateAgent(id, payload) : await api.createAgent(payload)
      setSaved(true); setTimeout(() => setSaved(false), 2000)
      if (!isEdit) navigate(`/agents/${result.id}/edit`, { replace: true })
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 13 }} className="pulse">Loading agent...</div>

  const escalateStr = Array.isArray(agent.behavior.escalate_keywords) ? agent.behavior.escalate_keywords.join(', ') : agent.behavior.escalate_keywords

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', height: '100vh', overflow: 'hidden' }}>
      <div style={{ overflow: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button className="btn-ghost" onClick={() => navigate('/')} style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}><ChevronLeft size={13} /> Back</button>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.4px', flex: 1 }}>{isEdit ? `Edit: ${agent.name || 'Agent'}` : 'New Agent'}</h1>
          {error && <div style={{ fontSize: 12, color: 'var(--danger)', background: 'rgba(255,85,119,0.1)', padding: '6px 12px', borderRadius: 6 }}>{error}</div>}
          <button className="btn-ghost" onClick={() => navigate(`/agents/${id}/chat`)} disabled={!isEdit} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, opacity: isEdit ? 1 : 0.4 }}><Play size={12} /> Test</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}><Save size={13} />{saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Agent'}</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <Tab label="Identity" icon={<Bot size={13} />} active={activeTab === 'identity'} onClick={() => setActiveTab('identity')} />
          <Tab label="Workflow" icon={<Workflow size={13} />} active={activeTab === 'workflow'} onClick={() => setActiveTab('workflow')} badge={agent.workflow_steps.length} />
          <Tab label="Knowledge Base" icon={<BookOpen size={13} />} active={activeTab === 'knowledge'} onClick={() => setActiveTab('knowledge')} badge={knowledgeCount} />
          <Tab label="Behavior" icon={<Shield size={13} />} active={activeTab === 'behavior'} onClick={() => setActiveTab('behavior')} />
          <Tab label="LLM Config" icon={<Settings size={13} />} active={activeTab === 'llm'} onClick={() => setActiveTab('llm')} />
          <Tab label="Tools" icon={<Wrench size={13} />} active={activeTab === 'tools'} onClick={() => setActiveTab('tools')} badge={(agent.enabled_tools || []).length} />
        </div>

        {activeTab === 'identity' && (
          <div className="fade-in">
            <Section icon={<Bot size={15} />} title="Agent Identity">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                <Field label="Agent Name">
                  <input className="input" placeholder="e.g. Support Bot" value={agent.name} onChange={e => set('name', e.target.value)} />
                </Field>
                <Field label="Agent Type">
                  <select className="input" value={agent.agent_type} onChange={e => set('agent_type', e.target.value)}>
                    <option value="custom">Custom Workflow</option>
                    <option value="support">Customer Support</option>
                    <option value="knowledge">Knowledge Assistant</option>
                    <option value="lead_gen">Lead Gen / Form</option>
                  </select>
                </Field>
              </div>
              <Field label="Description">
                <input className="input" placeholder="What does this agent do?" value={agent.description || ''} onChange={e => set('description', e.target.value)} />
              </Field>
              <Field label="System Persona">
                <textarea className="input" placeholder="You are a helpful assistant..." value={agent.persona} onChange={e => set('persona', e.target.value)} style={{ minHeight: 160 }} />
              </Field>
            </Section>
          </div>
        )}

        {activeTab === 'workflow' && (
          <div className="fade-in">
            <Section icon={<Workflow size={15} />} title={`Workflow Steps (${agent.workflow_steps.length})`}>
              <div style={{ marginTop: 14 }}>
                {agent.workflow_steps.length === 0 && (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No steps yet.</div>
                )}
                {agent.workflow_steps.map((step, i) => (
                  <StepCard key={step.id} step={step} index={i} onChange={(s) => updateStep(i, s)} onDelete={() => removeStep(i)} />
                ))}
                <button onClick={addStep} style={{ width: '100%', padding: '10px', marginTop: 4, background: 'transparent', border: '1px dashed var(--border-light)', borderRadius: 10, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                  <Plus size={13} /> Add Step
                </button>
              </div>
            </Section>
          </div>
        )}

        {activeTab === 'knowledge' && (
          <div className="fade-in">
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Knowledge Base</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Upload documents for RAG.</p>
            </div>
            {isEdit ? (
              <KnowledgeBase agentId={id} onCountChange={setKnowledgeCount} />
            ) : (
              <div style={{ padding: 20, background: 'var(--bg-surface)', border: '1px dashed var(--border)', borderRadius: 10, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Save the agent first.
              </div>
            )}
          </div>
        )}

        {activeTab === 'behavior' && (
          <div className="fade-in">
            <Section icon={<Shield size={15} />} title="Behavior">
              <div style={{ marginTop: 14 }}>
                {agent.agent_type === 'lead_gen' && (
                  <div style={{ marginBottom: 20 }}>
                    <CollectFieldsEditor fields={agent.behavior.collect_fields || []} onChange={f => set('behavior.collect_fields', f)} />
                  </div>
                )}
                <Field label="Greeting">
                  <input className="input" placeholder="Hello! How can I help?" value={agent.behavior.greeting_message || ''} onChange={e => set('behavior.greeting_message', e.target.value)} />
                </Field>
                <Field label="Fallback">
                  <input className="input" value={agent.behavior.fallback_message} onChange={e => set('behavior.fallback_message', e.target.value)} />
                </Field>
                <Field label="Escalation Keywords">
                  <input className="input" placeholder="lawsuit, refund" value={escalateStr} onChange={e => set('behavior.escalate_keywords', e.target.value)} />
                </Field>
              </div>
            </Section>
          </div>
        )}

        {activeTab === 'llm' && (
          <div className="fade-in">
            <Section icon={<Settings size={15} />} title="LLM Config">
              <div style={{ marginTop: 14 }}>
                <Field label="Provider & Model">
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8 }}>
                    <select className="input" value={agent.llm_config.provider} onChange={e => set('llm_config.provider', e.target.value)}>
                      <option value="ollama">Ollama (Local) 💻</option>
                      <option value="grok">Grok (Online) ⚡</option>
                    </select>
                    <select className="input" value={agent.llm_config.model} onChange={e => set('llm_config.model', e.target.value)}>
                      {(agent.llm_config.provider === 'grok' ? GROK_MODELS : OLLAMA_MODELS).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </Field>
                <Field label="Max Tokens">
                  <input className="input" type="number" min={50} max={4096} value={agent.llm_config.max_tokens} onChange={e => set('llm_config.max_tokens', parseInt(e.target.value))} />
                </Field>
                <Field label={`Temperature: ${agent.llm_config.temperature}`}>
                  <input type="range" min={0} max={2} step={0.1} value={agent.llm_config.temperature} onChange={e => set('llm_config.temperature', parseFloat(e.target.value))} style={{ width: '100%' }} />
                </Field>
              </div>
            </Section>
          </div>
        )}
      </div>


        {activeTab === 'tools' && (
          <div className="fade-in">
            <Section icon={<Wrench size={15} />} title="Tools & Actions">
              <div style={{ marginTop: 14 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  Enable tools your agent can use to perform actions beyond conversation.
                </p>
                {loadingTools ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading tools...</div>
                ) : availableTools.length === 0 ? (
                  <div style={{ padding: 20, background: 'var(--bg-surface)', border: '1px dashed var(--border)', borderRadius: 10, textAlign: 'center' }}>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>No tools available yet.</p>
                    <button className="btn-ghost" onClick={() => window.open('/tools', '_blank')} style={{ fontSize: 12 }}>
                      Go to Tools →
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {availableTools.map(tool => {
                      const isEnabled = (agent.enabled_tools || []).includes(tool.id)
                      return (
                        <div key={tool.id} style={{ display: 'flex', alignItems: 'start', gap: 10, padding: 10, background: 'var(--bg-surface)', borderRadius: 8, border: `1px solid ${isEnabled ? 'var(--accent)' : 'var(--border)'}` }}>
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={e => {
                              const current = agent.enabled_tools || []
                              if (e.target.checked) {
                                set('enabled_tools', [...current, tool.id])
                              } else {
                                set('enabled_tools', current.filter(id => id !== tool.id))
                              }
                            }}
                            style={{ marginTop: 2, width: 16, height: 16, cursor: 'pointer' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{tool.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{tool.description}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                              Type: {tool.tool_type}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </Section>
          </div>
        )}


      <div style={{ borderLeft: '1px solid var(--border)', background: 'var(--bg-surface)', overflow: 'auto', padding: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 14 }}>Preview</div>
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 16, marginBottom: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{agent.name || 'Untitled'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{agent.description || 'No description'}</div>
        </div>
        {isEdit && (
          <button className="btn-primary" onClick={() => navigate(`/agents/${id}/chat`)} style={{ width: '100%' }}>
            <Play size={13} /> Test
          </button>
        )}
      </div>
    </div>
  )
}
