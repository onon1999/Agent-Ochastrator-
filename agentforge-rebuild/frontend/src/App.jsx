import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import AgentBuilder from './pages/AgentBuilder'
import ChatTest from './pages/ChatTest'
import ToolsPage from './pages/ToolsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/agents/new" element={<AgentBuilder />} />
        <Route path="/agents/:id/edit" element={<AgentBuilder />} />
        <Route path="/agents/:id/chat" element={<ChatTest />} />
        <Route path="/tools" element={<ToolsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
