import { useState, useEffect, useRef, useCallback } from 'react'
import { Upload, FileText, Trash2, RefreshCw, CheckCircle, AlertCircle, Loader2, BookOpen, X } from 'lucide-react'
import { api } from '../api'

const FILE_ICONS = {
  pdf: '📄',
  txt: '📝',
  md: '📋',
  docx: '📘',
}

const STATUS_CONFIG = {
  ready:      { color: '#00DDB3', bg: '#00DDB315', icon: <CheckCircle size={12} />, label: 'Ready' },
  processing: { color: '#FFB547', bg: '#FFB54715', icon: <Loader2 size={12} className="pulse" />, label: 'Processing...' },
  error:      { color: '#FF5577', bg: '#FF557715', icon: <AlertCircle size={12} />, label: 'Error' },
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function DocumentRow({ doc, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  const status = STATUS_CONFIG[doc.status] || STATUS_CONFIG.processing
  const icon = FILE_ICONS[doc.file_type] || '📄'

  const handleDelete = async () => {
    if (!confirm(`Delete "${doc.original_name}"?`)) return
    setDeleting(true)
    await onDelete(doc.id)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      background: 'var(--bg-base)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      opacity: deleting ? 0.5 : 1,
      transition: 'all 0.15s',
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.original_name}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 3 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatBytes(doc.file_size)}</span>
          {doc.chunk_count > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{doc.chunk_count} chunks</span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {new Date(doc.created_at).toLocaleDateString()}
          </span>
        </div>
        {doc.error_message && (
          <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>{doc.error_message}</div>
        )}
      </div>

      {/* Status badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 20,
        background: status.bg, color: status.color,
        fontSize: 11, fontWeight: 600, flexShrink: 0,
      }}>
        {status.icon}
        {status.label}
      </div>

      <button
        onClick={handleDelete}
        disabled={deleting}
        style={{
          background: 'none', border: 'none',
          color: 'var(--danger)', cursor: 'pointer',
          padding: 4, borderRadius: 4,
          opacity: deleting ? 0.4 : 1,
          flexShrink: 0,
        }}
        title="Delete document"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

function DropZone({ onFiles, uploading }) {
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) onFiles(files)
  }, [onFiles])

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = () => setDragging(false)

  return (
    <div
      onClick={() => !uploading && fileRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{
        border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border-light)'}`,
        borderRadius: 12,
        padding: '28px 20px',
        textAlign: 'center',
        cursor: uploading ? 'not-allowed' : 'pointer',
        background: dragging ? 'var(--accent-glow)' : 'var(--bg-base)',
        transition: 'all 0.15s',
        opacity: uploading ? 0.6 : 1,
      }}
    >
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".pdf,.txt,.md,.docx"
        style={{ display: 'none' }}
        onChange={e => onFiles(Array.from(e.target.files || []))}
        disabled={uploading}
      />

      {uploading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <Loader2 size={28} color="var(--accent)" className="pulse" />
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Uploading & processing...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <Upload size={28} color={dragging ? 'var(--accent)' : 'var(--text-muted)'} />
          <div style={{ fontSize: 13, fontWeight: 600, color: dragging ? 'var(--accent)' : 'var(--text-secondary)' }}>
            {dragging ? 'Drop files here' : 'Drop files or click to upload'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            PDF, TXT, DOCX, Markdown · Max 20MB each
          </div>
        </div>
      )}
    </div>
  )
}

export default function KnowledgeBase({ agentId }) {
  const [stats, setStats] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadErrors, setUploadErrors] = useState([])
  const [loading, setLoading] = useState(true)
  const pollRef = useRef(null)

  const load = async () => {
    try {
      const data = await api.getKnowledge(agentId)
      setStats(data)
    } catch (e) {
      console.error('Failed to load knowledge:', e)
    } finally {
      setLoading(false)
    }
  }

  // Poll while any doc is processing
  useEffect(() => {
    load()
  }, [agentId])

  useEffect(() => {
    const hasProcessing = stats?.documents?.some(d => d.status === 'processing')
    if (hasProcessing && !pollRef.current) {
      pollRef.current = setInterval(load, 2500)
    } else if (!hasProcessing && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [stats])

  const handleFiles = async (files) => {
    setUploadErrors([])
    setUploading(true)
    const errors = []

    for (const file of files) {
      try {
        await api.uploadDocument(agentId, file)
      } catch (e) {
        errors.push(`${file.name}: ${e.message}`)
      }
    }

    if (errors.length) setUploadErrors(errors)
    await load()
    setUploading(false)
  }

  const handleDelete = async (docId) => {
    await api.deleteDocument(agentId, docId)
    await load()
  }

  const handleClearAll = async () => {
    if (!confirm('Delete ALL documents from this knowledge base?')) return
    await api.clearKnowledge(agentId)
    await load()
  }

  const readyCount = stats?.documents?.filter(d => d.status === 'ready').length || 0
  const totalChunks = stats?.total_chunks || 0

  return (
    <div>
      {/* Stats bar */}
      {stats && stats.document_count > 0 && (
        <div style={{
          display: 'flex', gap: 16, padding: '10px 14px',
          background: 'var(--bg-base)', border: '1px solid var(--border)',
          borderRadius: 8, marginBottom: 14,
        }}>
          <Stat label="Documents" value={stats.document_count} />
          <Stat label="Ready" value={readyCount} color="var(--success)" />
          <Stat label="Total Chunks" value={totalChunks} />
          <Stat label="Storage" value={formatBytes(stats.total_size_bytes)} />
          {stats.document_count > 0 && (
            <button
              onClick={handleClearAll}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Trash2 size={12} /> Clear All
            </button>
          )}
        </div>
      )}

      {/* Upload zone */}
      <DropZone onFiles={handleFiles} uploading={uploading} />

      {/* Upload errors */}
      {uploadErrors.length > 0 && (
        <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(255,85,119,0.08)', border: '1px solid var(--danger)', borderRadius: 8 }}>
          {uploadErrors.map((e, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--danger)' }}>⚠ {e}</div>
          ))}
        </div>
      )}

      {/* RAG active banner */}
      {readyCount > 0 && (
        <div style={{
          marginTop: 12, padding: '8px 14px',
          background: 'rgba(0,221,179,0.08)', border: '1px solid rgba(0,221,179,0.25)',
          borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <BookOpen size={13} color="var(--success)" />
          <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
            RAG active — agent will answer from {readyCount} document{readyCount !== 1 ? 's' : ''} ({totalChunks} chunks)
          </span>
        </div>
      )}

      {/* Document list */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }} className="pulse">
          Loading knowledge base...
        </div>
      )}

      {!loading && stats?.documents?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          {stats.documents.map(doc => (
            <DocumentRow key={doc.id} doc={doc} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {!loading && (!stats || stats.document_count === 0) && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 12 }}>
          No documents yet. Upload your first file above.
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: color || 'var(--text-secondary)', marginTop: 2 }}>{value}</div>
    </div>
  )
}
