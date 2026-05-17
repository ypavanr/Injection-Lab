import { Outlet, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuthStore } from '../../store/auth'

export function AdminLayout() {
  const user = useAuthStore(s => s.user)

  // Redirect to login if not authenticated
  // NOTE: This is a client-side check only — the backend has no auth on most endpoints (IDOR vuln)
  if (!user) {
    return <Navigate to="/admin/login" replace />
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
