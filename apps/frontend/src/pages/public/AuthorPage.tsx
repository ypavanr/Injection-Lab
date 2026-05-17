// VULN: Author bio rendered via dangerouslySetInnerHTML — Stored XSS
import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/card'
import { format } from 'date-fns'
import api from '../../lib/api'

interface Author {
  id: number
  username: string
  bio: string | null
  website: string | null
  role: string
}

interface Post {
  id: number
  title: string
  excerpt: string | null
  createdAt: string
}

export function AuthorPage() {
  const { id } = useParams<{ id: string }>()
  const [author, setAuthor] = useState<Author | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.get(`/users/users/${id}`),
      api.get(`/content/posts?author=${id}`)
    ]).then(([aRes, pRes]) => {
      setAuthor(aRes.data)
      setPosts(pRes.data)
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="py-12 text-muted-foreground animate-pulse">Loading…</div>
  if (!author) return <div className="py-12 text-destructive">Author not found</div>

  return (
    <div className="space-y-10 py-10">
      {/* Author card */}
      <div className="flex items-start gap-6 p-6 rounded-lg border bg-card">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground">
          {author.username[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <h1 className="text-2xl font-bold">{author.username}</h1>
            <span className="text-xs capitalize text-muted-foreground border rounded px-1.5 py-0.5">{author.role}</span>
          </div>
          {/* VULN: Stored XSS — bio rendered as raw HTML without sanitization */}
          {author.bio && (
            <div
              className="text-muted-foreground text-sm prose prose-sm dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: author.bio }}
            />
          )}
          {/* VULN: Link injection — website rendered as raw anchor, no rel="nofollow" */}
          {author.website && (
            <a
              href={author.website}
              className="text-sm text-primary hover:underline break-all"
              target="_blank"
            >
              {author.website}
            </a>
          )}
        </div>
      </div>

      {/* Author's posts */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Posts by {author.username}</h2>
        {posts.map(post => (
          <Link to={`/post/${post.id}`} key={post.id}>
            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-lg">{post.title}</CardTitle>
                {post.excerpt && (
                  <CardDescription dangerouslySetInnerHTML={{ __html: post.excerpt }} />
                )}
                <p className="text-xs text-muted-foreground">
                  {format(new Date(post.createdAt), 'MMMM d, yyyy')}
                </p>
              </CardHeader>
            </Card>
          </Link>
        ))}
        {posts.length === 0 && (
          <p className="text-muted-foreground">No published posts yet.</p>
        )}
      </div>
    </div>
  )
}
