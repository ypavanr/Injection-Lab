import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/card'
import { format } from 'date-fns'
import api from '../../lib/api'

interface Post {
  id: number
  title: string
  slug: string
  excerpt: string | null
  createdAt: string
  author: { id: number; username: string }
  tags: { id: number; name: string }[]
}

export function Home() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/content/posts')
      .then(r => setPosts(r.data))
      .catch(() => setError('Failed to load posts'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-12">
      <section className="text-center space-y-4 py-12">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">The VulnCMS Blog</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          A deliberately vulnerable CMS for security research.
        </p>
        {/* Quick links to RSS and sitemap */}
        <div className="flex justify-center gap-4 text-sm text-muted-foreground">
          <a href="/api/content/rss.xml" className="hover:underline">RSS Feed</a>
          <span>·</span>
          <a href="/api/content/sitemap.xml" className="hover:underline">Sitemap</a>
          <span>·</span>
          <Link to="/search" className="hover:underline">Search</Link>
        </div>
      </section>

      {loading && (
        <div className="grid md:grid-cols-2 gap-8">
          {[1,2,3,4].map(i => (
            <Card key={i} className="h-48 animate-pulse bg-muted" />
          ))}
        </div>
      )}

      {error && (
        <div className="text-center text-destructive py-12">
          <p>{error}</p>
          <p className="text-sm text-muted-foreground mt-2">Is the backend running? Try <code>make up</code></p>
        </div>
      )}

      {!loading && !error && (
        <section className="grid md:grid-cols-2 gap-8">
          {posts.map(post => (
            <Link to={`/post/${post.id}`} key={post.id} className="group">
              <Card className="h-full transition-all hover:shadow-md hover:border-primary/50">
                <CardHeader>
                  <div className="text-xs text-muted-foreground mb-2 flex items-center space-x-2 flex-wrap gap-y-1">
                    <Link
                      to={`/author/${post.author.id}`}
                      className="hover:underline"
                      onClick={e => e.stopPropagation()}
                    >
                      {post.author.username}
                    </Link>
                    <span>&bull;</span>
                    <span>{format(new Date(post.createdAt), 'MMMM d, yyyy')}</span>
                    {post.tags.map(t => (
                      <span key={t.id} className="ml-1 px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground text-xs">
                        {t.name}
                      </span>
                    ))}
                  </div>
                  <CardTitle className="group-hover:text-primary transition-colors line-clamp-2">
                    {post.title}
                  </CardTitle>
                  {/* VULN: excerpt rendered as raw HTML — malicious HTML injection surface */}
                  {post.excerpt && (
                    <CardDescription
                      className="text-base mt-2 line-clamp-3"
                      dangerouslySetInnerHTML={{ __html: post.excerpt }}
                    />
                  )}
                </CardHeader>
              </Card>
            </Link>
          ))}

          {posts.length === 0 && (
            <div className="col-span-2 text-center text-muted-foreground py-12">
              No posts yet. <Link to="/admin/editor" className="underline">Create one</Link>.
            </div>
          )}
        </section>
      )}
    </div>
  )
}
