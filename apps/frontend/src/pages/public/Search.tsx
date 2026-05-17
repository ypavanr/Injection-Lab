// VULN: SQL Injection — search query sent directly to vulnerable search-service endpoint
import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/card'
import { format } from 'date-fns'
import api from '../../lib/api'

interface Result {
  id: number
  title: string
  excerpt: string | null
  createdAt: string
}

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dbError, setDbError] = useState('')

  const doSearch = async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    setError('')
    setDbError('')
    try {
      const res = await api.get(`/search/search?q=${encodeURIComponent(q)}`)
      setResults(res.data)
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Search failed'
      setError(msg)
      // VULN: Raw database error returned to UI — reveals schema info during SQLi
      if (err.response?.data?.query) {
        setDbError(`DB Error for query: ${err.response.data.query}`)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const q = searchParams.get('q') || ''
    setQuery(q)
    if (q) doSearch(q)
  }, [searchParams])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchParams(query ? { q: query } : {})
  }

  return (
    <div className="space-y-8 py-8">
      <h1 className="text-3xl font-bold">Search</h1>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search posts… (try SQL injection: ' UNION SELECT...)"
          className="flex-1"
        />
        <Button type="submit" disabled={loading}>Search</Button>
      </form>

      {/* VULN hint visible for research purposes */}
      <div className="text-xs text-muted-foreground p-3 rounded bg-muted font-mono">
        SQLi test: <code>{"' UNION SELECT username,password,email,NULL,NULL FROM \"User\"--"}</code>
      </div>

      {loading && <div className="text-muted-foreground animate-pulse">Searching…</div>}

      {error && (
        <div className="p-4 rounded border border-destructive/30 bg-destructive/5 space-y-2">
          <p className="text-destructive text-sm font-medium">{error}</p>
          {/* VULN: DB error message revealed to user — useful for SQLi enumeration */}
          {dbError && <p className="text-xs text-muted-foreground font-mono">{dbError}</p>}
        </div>
      )}

      <div className="space-y-4">
        {results.map(post => (
          <Link to={`/post/${post.id}`} key={post.id}>
            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-lg">{post.title}</CardTitle>
                {post.excerpt && (
                  // VULN: excerpt rendered as raw HTML
                  <CardDescription dangerouslySetInnerHTML={{ __html: post.excerpt }} />
                )}
                <p className="text-xs text-muted-foreground">
                  {post.createdAt ? format(new Date(post.createdAt), 'MMM d, yyyy') : ''}
                </p>
              </CardHeader>
            </Card>
          </Link>
        ))}
        {!loading && !error && results.length === 0 && searchParams.get('q') && (
          <p className="text-muted-foreground">No results for "{searchParams.get('q')}"</p>
        )}
      </div>
    </div>
  )
}
