import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card'
import { useAuthStore } from '../../store/auth'
import api from '../../lib/api'
import { ShieldAlert } from 'lucide-react'

export function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore(s => s.login)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { username, password })
      login(res.data.user, res.data.token)
      navigate('/admin/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2">
            <ShieldAlert className="w-8 h-8 text-destructive" />
            <span className="text-2xl font-bold tracking-tight">VulnCMS</span>
          </div>
          <p className="text-muted-foreground text-sm">Security Research Lab — Admin Access</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Default credentials: <code className="text-xs bg-muted px-1 rounded">admin / admin123</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive/20">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Username</label>
                <Input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">← Back to blog</Link>
        </p>

        {/* VULN: DOM XSS — hash written to innerHTML */}
        {/* Test: /admin/login#<img src=x onerror=alert(1)> */}
        <div
          id="login-notice"
          className="text-center text-xs text-muted-foreground empty:hidden"
          ref={el => {
            if (el && window.location.hash) {
              // VULN: DOM-based XSS sink
              el.innerHTML = decodeURIComponent(window.location.hash.slice(1))
            }
          }}
        />
      </div>
    </div>
  )
}
