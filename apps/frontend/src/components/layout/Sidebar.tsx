import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileText, Image, MessageSquare, Users, Settings, LogOut, Shield, Cpu } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { Button } from '../ui/button'

export function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const links = [
    { to: '/admin/dashboard', label: 'Dashboard',   icon: <LayoutDashboard size={18} /> },
    { to: '/admin/posts',     label: 'Posts',        icon: <FileText size={18} /> },
    { to: '/admin/media',     label: 'Media',        icon: <Image size={18} /> },
    { to: '/admin/comments',  label: 'Comments',     icon: <MessageSquare size={18} /> },
    { to: '/admin/users',     label: 'Users',        icon: <Users size={18} /> },
    { to: '/admin/settings',  label: 'Settings',     icon: <Settings size={18} /> },
  ]

  const handleLogout = () => {
    logout()
    navigate('/admin/login')
  }

  return (
    <aside className="w-64 border-r bg-card flex-col h-full hidden md:flex">
      <div className="h-16 flex items-center px-5 border-b space-x-2">
        <Shield size={18} className="text-destructive" />
        <span className="text-base font-bold tracking-tight">VulnCMS Admin</span>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`
            }
          >
            {link.icon}
            <span>{link.label}</span>
          </NavLink>
        ))}

        {/* AI Tools section */}
        <div className="pt-4 pb-1 px-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI / Vuln Tools</span>
        </div>
        <a
          href="/api/content/export/training.jsonl"
          target="_blank"
          className="flex items-center space-x-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Cpu size={18} />
          <span>Export Training Data</span>
        </a>
        <a
          href="/api/ai/graph"
          target="_blank"
          className="flex items-center space-x-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Cpu size={18} />
          <span>Knowledge Graph</span>
        </a>
      </nav>

      {/* User info + logout */}
      <div className="p-3 border-t space-y-2">
        {user && (
          <div className="px-3 py-2 rounded-md bg-muted text-xs">
            <div className="font-medium truncate">{user.username}</div>
            <div className="text-muted-foreground capitalize">{user.role}</div>
          </div>
        )}
        <NavLink
          to="/"
          className="flex items-center justify-center w-full px-3 py-2 text-sm text-muted-foreground border border-input rounded-md hover:bg-accent hover:text-accent-foreground"
        >
          View Site
        </NavLink>
        <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive" onClick={handleLogout}>
          <LogOut size={16} className="mr-2" /> Logout
        </Button>
      </div>
    </aside>
  )
}
