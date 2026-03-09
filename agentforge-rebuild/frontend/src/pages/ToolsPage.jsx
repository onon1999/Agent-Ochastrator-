import { useState, useEffect } from 'react'
import { Plus, Settings, Trash2, TestTube, Globe, Mail, Calendar, Code, ExternalLink, Check, X } from 'lucide-react'
import { api } from '../api'

const TOOL_TYPES = [
  { value: 'web_search', label: 'Web Search', icon: <Globe size={16} />, color: '#5B8BFF' },
  { value: 'email', label: 'Email', icon: <Mail size={16} />, color: '#FF6B9D' },
  { value: 'calendar', label: 'Calendar', icon: <Calendar size={16} />, color: '#FFB547' },
  { value: 'http_api', label: 'HTTP API', icon: <ExternalLink size={16} />, color: '#00DDB3' },
  { value: 'custom', label: 'Custom Code', icon: <Code size={16} />, color: '#A78BFA' },
]

function ToolCard({ tool, onEdit, onDelete, onTest }) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  
  const typeInfo = TOOL_TYPES.find(t => t.value === tool.tool_type) || TOOL_TYPES[0]
  
  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    
    // Default test parameters based on tool type
    let params = {}
    if (tool.tool_type === 'web_search') {
      params = { query: 'test search', max_results: 3 }
    }
    
    try {
      const result = await api.testTool(tool.id, params)
      setTestResult(result)
    } catch (e) {
      setTestResult({ success: false, error: e.message })
    } finally {
      setTesting(false)
    }
  }
  
  return (
    <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: `${typeInfo.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: typeInfo.color }}>
          {typeInfo.icon}
        </div>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{tool.name}</h3>
            {!tool.is_enabled && (
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'var(--danger)', color: '#fff', fontWeight: 600 }}>DISABLED</span>
            )}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{tool.description}</p>
          
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => onEdit(tool)} className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Settings size={12} /> Configure
            </button>
            <button onClick={handleTest} className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }} disabled={testing || !tool.is_enabled}>
              <TestTube size={12} /> {testing ? 'Testing...' : 'Test'}
            </button>
            <button onClick={() => onDelete(tool)} className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
          
          {testResult && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 6, background: testResult.success ? 'rgba(0,221,179,0.1)' : 'rgba(255,85,119,0.1)', border: `1px solid ${testResult.success ? 'var(--success)' : 'var(--danger)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                {testResult.success ? <Check size={14} color="var(--success)" /> : <X size={14} color="var(--danger)" />}
                <span style={{ fontSize: 12, fontWeight: 600, color: testResult.success ? 'var(--success)' : 'var(--danger)' }}>
                  {testResult.success ? 'Test Passed' : 'Test Failed'}
                </span>
              </div>
              <pre style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ToolEditor({ tool, onSave, onCancel }) {
  const [formData, setFormData] = useState(tool || {
    name: '',
    description: '',
    tool_type: 'web_search',
    config: {},
    input_schema: {},
    is_enabled: true
  })
  
  const [configFields, setConfigFields] = useState(JSON.stringify(formData.config || {}, null, 2))
  
  const typeInfo = TOOL_TYPES.find(t => t.value === formData.tool_type)
  
  const handleSave = async () => {
    try {
      const payload = {
        ...formData,
        config: JSON.parse(configFields)
      }
      await onSave(payload)
    } catch (e) {
      alert('Invalid JSON in configuration: ' + e.message)
    }
  }
  
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, maxWidth: 600 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>{tool ? 'Edit Tool' : 'Create New Tool'}</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>Tool Name</label>
          <input
            className="input"
            placeholder="e.g. web_search"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            disabled={!!tool}
          />
        </div>
        
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>Description</label>
          <textarea
            className="input"
            placeholder="What does this tool do?"
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            rows={2}
          />
        </div>
        
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>Tool Type</label>
          <select
            className="input"
            value={formData.tool_type}
            onChange={e => setFormData({ ...formData, tool_type: e.target.value })}
            disabled={!!tool}
          >
            {TOOL_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>Configuration (JSON)</label>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            {formData.tool_type === 'web_search' && 'Example: {"provider": "duckduckgo"} or {"provider": "tavily", "api_key": "your-key"}'}
            {formData.tool_type === 'email' && 'Example: {"smtp_host": "smtp.gmail.com", "smtp_port": 587, "username": "you@gmail.com", "password": "your-password"}'}
            {formData.tool_type === 'http_api' && 'Example: {"method": "GET", "url": "https://api.example.com", "headers": {"Authorization": "Bearer key"}}'}
          </div>
          <textarea
            className="input"
            placeholder='{"key": "value"}'
            value={configFields}
            onChange={e => setConfigFields(e.target.value)}
            rows={6}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
          />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={formData.is_enabled}
            onChange={e => setFormData({ ...formData, is_enabled: e.target.checked })}
            style={{ width: 16, height: 16 }}
          />
          <label style={{ fontSize: 13 }}>Enable this tool</label>
        </div>
        
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn-primary" onClick={handleSave} style={{ flex: 1 }}>
            {tool ? 'Update Tool' : 'Create Tool'}
          </button>
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function ToolsPage() {
  const [tools, setTools] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  
  const loadTools = async () => {
    try {
      const data = await api.listTools(false) // Show all, including disabled
      setTools(data)
    } catch (e) {
      console.error('Failed to load tools:', e)
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    loadTools()
  }, [])
  
  const handleSeedDefaults = async () => {
    try {
      const result = await api.seedDefaultTools()
      alert(`Created ${result.created.length} default tools: ${result.created.join(', ')}`)
      await loadTools()
    } catch (e) {
      alert('Failed to seed tools: ' + e.message)
    }
  }
  
  const handleSave = async (toolData) => {
    try {
      if (editing) {
        await api.updateTool(editing.id, toolData)
      } else {
        await api.createTool(toolData)
      }
      setEditing(null)
      setCreating(false)
      await loadTools()
    } catch (e) {
      alert('Failed to save tool: ' + e.message)
    }
  }
  
  const handleDelete = async (tool) => {
    if (!confirm(`Delete tool "${tool.name}"?`)) return
    try {
      await api.deleteTool(tool.id)
      await loadTools()
    } catch (e) {
      alert('Failed to delete tool: ' + e.message)
    }
  }
  
  if (loading) {
    return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading tools...</div>
  }
  
  if (creating || editing) {
    return (
      <div style={{ padding: 28 }}>
        <ToolEditor
          tool={editing}
          onSave={handleSave}
          onCancel={() => { setCreating(false); setEditing(null) }}
        />
      </div>
    )
  }
  
  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.4px', marginBottom: 4 }}>Tools & Actions</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Configure tools your agents can use to perform actions</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tools.length === 0 && (
            <button className="btn-ghost" onClick={handleSeedDefaults}>
              Seed Defaults
            </button>
          )}
          <button className="btn-primary" onClick={() => setCreating(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> New Tool
          </button>
        </div>
      </div>
      
      {tools.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-surface)', borderRadius: 12, border: '1px dashed var(--border)' }}>
          <Settings size={40} color="var(--text-muted)" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No Tools Yet</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Tools let your agents search the web, send emails, call APIs, and more.
          </p>
          <button className="btn-primary" onClick={handleSeedDefaults}>
            Seed Default Tools
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
          {tools.map(tool => (
            <ToolCard
              key={tool.id}
              tool={tool}
              onEdit={setEditing}
              onDelete={handleDelete}
              onTest={(params) => {}}
            />
          ))}
        </div>
      )}
    </div>
  )
}
