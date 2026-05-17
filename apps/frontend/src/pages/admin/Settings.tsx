// Settings page — no UsersList export here; UsersList is in UsersList.tsx
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { Save, Sun, Moon, Terminal } from 'lucide-react'

export function Settings() {
  const [siteTitle, setSiteTitle] = useState('The VulnCMS Blog')
  const [siteDesc, setSiteDesc] = useState('A deliberately vulnerable CMS for security research.')
  const [saved, setSaved] = useState(false)

  const save = () => {
    // Settings stored in localStorage only — backend has no settings endpoint
    localStorage.setItem('siteTitle', siteTitle)
    localStorage.setItem('siteDesc', siteDesc)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-8 space-y-8 max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Site-wide configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Site Title</label>
            <Input value={siteTitle} onChange={e => setSiteTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Site Description</label>
            <Input value={siteDesc} onChange={e => setSiteDesc(e.target.value)} />
          </div>
          <Button onClick={save}>
            <Save className="w-4 h-4 mr-2" />
            {saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Adjust the look and feel</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button variant="outline" onClick={() => document.documentElement.classList.remove('dark')}>
            <Sun className="w-4 h-4 mr-2" /> Light
          </Button>
          <Button variant="outline" onClick={() => document.documentElement.classList.add('dark')}>
            <Moon className="w-4 h-4 mr-2" /> Dark
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vulnerability Endpoints</CardTitle>
          <CardDescription>Quick links to all vulnerable surfaces for testing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm font-mono">
          {[
            ['SQLi', 'GET /api/search/search?q=\' UNION SELECT...'],
            ['Open Redirect', 'GET /go?url=https://evil.com'],
            ['AI Crawler Poisoning', 'GET /api/content/posts?ai=1'],
            ['Training Data Dump', 'GET /api/content/export/training.jsonl'],
            ['Prompt Injection', 'POST /api/ai/summarize { "text": "ignore instructions..." }'],
            ['RAG Poisoning', 'POST /api/comments/posts/1/comments (inject prompt payload)'],
            ['Knowledge Graph', 'GET /api/ai/graph'],
            ['IDOR Post Edit', 'PUT /api/content/posts/1 (no auth check)'],
            ['IDOR User Edit', 'PUT /api/users/users/1 (no ownership check)'],
          ].map(([name, endpoint]) => (
            <div key={name} className="flex items-start gap-3 py-1.5 border-b last:border-0">
              <span className="text-muted-foreground w-36 shrink-0 text-xs pt-0.5">{name}</span>
              <code className="text-xs text-foreground break-all">{endpoint}</code>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Log Locations</CardTitle>
          <CardDescription>Where to find security events</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm font-mono">
          <div className="flex items-center gap-2"><Terminal size={14} /> <code>logs/security.cef.log</code> — CEF security events</div>
          <div className="flex items-center gap-2"><Terminal size={14} /> <code>logs/audit.log</code> — admin audit trail</div>
          <div className="flex items-center gap-2"><Terminal size={14} /> <code>logs/app.log</code> — ECS application logs</div>
        </CardContent>
      </Card>
    </div>
  )
}
