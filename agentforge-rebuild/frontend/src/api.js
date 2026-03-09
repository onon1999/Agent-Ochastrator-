const API_BASE = 'http://localhost:8000/api/v1'

async function request(method, endpoint, data = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (data) options.body = JSON.stringify(data)

  const res = await fetch(`${API_BASE}${endpoint}`, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // ── Agents ────────────────────────────────────────────────────────────────
  listAgents: () => request('GET', '/agents/'),
  getAgent: (id) => request('GET', `/agents/${id}`),
  createAgent: (data) => request('POST', '/agents/', data),
  updateAgent: (id, data) => request('PUT', `/agents/${id}`, data),
  deleteAgent: (id) => request('DELETE', `/agents/${id}`),

  // ── Chat ──────────────────────────────────────────────────────────────────
  sendMessage: (agentId, message, conversationId = null) =>
    request('POST', '/chat/', { agent_id: agentId, message, conversation_id: conversationId }),
  chat: (agentId, message, conversationId = null) =>
    request('POST', '/chat/', { agent_id: agentId, message, conversation_id: conversationId }),
  getSessions: (agentId) => request('GET', `/chat/sessions/${agentId}`),
  listSessions: (agentId) => request('GET', `/chat/sessions/${agentId}`),

  // ── Knowledge ─────────────────────────────────────────────────────────────
  uploadDocument: async (agentId, file) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_BASE}/knowledge/${agentId}/upload`, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) throw new Error('Upload failed')
    return res.json()
  },
  listDocuments: (agentId) => request('GET', `/knowledge/${agentId}`),
  deleteDocument: (agentId, docId) => request('DELETE', `/knowledge/${agentId}/${docId}`),

  // ── Tools ─────────────────────────────────────────────────────────────────
  listTools: (enabledOnly = true) => request('GET', `/tools/?enabled_only=${enabledOnly}`),
  getTool: (id) => request('GET', `/tools/${id}`),
  createTool: (data) => request('POST', '/tools/', data),
  updateTool: (id, data) => request('PUT', `/tools/${id}`, data),
  deleteTool: (id) => request('DELETE', `/tools/${id}`),
  testTool: (id, parameters) => request('POST', `/tools/${id}/test`, parameters),
  seedDefaultTools: () => request('POST', '/tools/seed-defaults'),
}
