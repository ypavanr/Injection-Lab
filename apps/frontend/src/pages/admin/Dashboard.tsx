import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Users, FileText, MessageSquare, AlertTriangle, Activity } from 'lucide-react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'

interface Stats {
  posts: number
  users: number
  pendingComments: number
  totalComments: number
}

interface RecentPost {
  id: number
  title: string
  status: string
  createdAt: string
  author: { username: string }
}

export function Dashboard() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<Stats>({ posts: 0, users: 0, pendingComments: 0, totalComments: 0 })
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/content/posts?status=published'),
      api.get('/users/users'),
      api.get('/comments/comments?status=pending'),
      api.get('/comments/comments'),
      api.get('/content/posts?status=draft'),
    ]).then(([pubPosts, users, pending, allComments, draftPosts]) => {
      setStats({
        posts: pubPosts.data.length + draftPosts.data.length,
        users: users.data.length,
        pendingComments: pending.data.length,
        totalComments: allComments.data.length
      })
      setRecentPosts(
        [...pubPosts.data, ...draftPosts.data]
          .sort((a: RecentPost, b: RecentPost) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5)
      )
    }).finally(() => setLoading(false))
  }, [])

  const statCards = [
    { label: 'Total Posts', value: stats.posts, icon: <FileText className="w-4 h-4 text-muted-foreground" />, href: '/admin/posts', color: '' },
    { label: 'Total Users', value: stats.users, icon: <Users className="w-4 h-4 text-muted-foreground" />, href: '/admin/users', color: '' },
    { label: 'Pending Comments', value: stats.pendingComments, icon: <MessageSquare className="w-4 h-4 text-muted-foreground" />, href: '/admin/comments', color: 'text-amber-600' },
    { label: 'Security Alerts', value: '—', icon: <AlertTriangle className="w-4 h-4 text-destructive" />, href: '/admin/settings', color: 'text-destructive', note: 'Check logs/' },
  ]

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Welcome back, {user?.username}</p>
        </div>
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-green-500" />
          <span className="text-sm text-muted-foreground">System active</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map(s => (
          <Link to={s.href} key={s.label}>
            <Card className={`hover:border-primary/50 transition-colors ${s.label === 'Security Alerts' ? 'border-destructive/30' : ''}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
                {s.icon}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${s.color}`}>
                  {loading ? <span className="animate-pulse">…</span> : s.value}
                </div>
                {s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Recent Posts</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {loading && <div className="text-muted-foreground text-sm animate-pulse">Loading…</div>}
            {recentPosts.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                <div className="min-w-0">
                  <Link to={`/admin/editor/${p.id}`} className="font-medium hover:underline truncate block">{p.title}</Link>
                  <span className="text-xs text-muted-foreground">{p.author?.username} · {format(new Date(p.createdAt), 'MMM d')}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                  p.status === 'published' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                }`}>{p.status}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Vulnerability Surfaces</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ['SQLi', '/search?q=\' UNION SELECT...', 'search'],
              ['Stored XSS', '/post/1 (comment box)', 'comments'],
              ['DOM XSS', '/?#<img src=x onerror=alert(1)>', 'public'],
              ['Open Redirect', '/go?url=https://evil.com', 'gateway'],
              ['RAG Poisoning', '/admin/comments (submit payload)', 'ai'],
              ['Prompt Injection', '/api/ai/summarize (POST)', 'ai'],
              ['AI Crawler', '/api/content/posts?ai=1', 'content'],
              ['Training Data', '/api/content/export/training.jsonl', 'content'],
            ].map(([name, path]) => (
              <div key={name} className="flex items-center justify-between border-b last:border-0 pb-1">
                <span className="font-medium text-xs">{name}</span>
                <code className="text-xs text-muted-foreground truncate max-w-[60%]">{path}</code>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
