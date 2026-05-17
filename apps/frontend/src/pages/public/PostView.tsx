// VULN: Stored XSS — renderedContent injected via dangerouslySetInnerHTML
// VULN: Stored XSS — comment.content injected via dangerouslySetInnerHTML
// VULN: Link injection — guestUrl rendered as raw anchor with no nofollow
// VULN: Malicious metadata injection — seoTitle/seoDescription injected into <title>/<meta>
import { useParams, Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'

interface Comment {
  id: number
  content: string
  guestName: string | null
  guestUrl: string | null
  status: string
  createdAt: string
  author: { id: number; username: string } | null
}

interface Post {
  id: number
  title: string
  renderedContent: string
  excerpt: string | null
  createdAt: string
  seoTitle: string
  seoDescription: string | null
  jsonLd: object
  author: { id: number; username: string; bio: string | null; website: string | null }
  tags: { id: number; name: string }[]
}

export function PostView() {
  const { id } = useParams<{ id: string }>()
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [guestName, setGuestName] = useState('')
  const [guestUrl, setGuestUrl] = useState('')
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState('')

  const [aiAnswer, setAiAnswer] = useState('')
  const [aiQuestion, setAiQuestion] = useState('')
  const [askingAI, setAskingAI] = useState(false)

  const { user } = useAuthStore()
  const jsonLdRef = useRef<HTMLScriptElement | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)

    Promise.all([
      api.get(`/content/posts/${id}`),
      api.get(`/comments/posts/${id}/comments`)
    ]).then(([postRes, commentsRes]) => {
      const p = postRes.data
      setPost(p)
      setComments(commentsRes.data)

      // VULN: Malicious metadata injection — values come directly from post fields
      document.title = p.seoTitle || p.title
      const metaDesc = document.querySelector('meta[name="description"]')
      if (metaDesc) metaDesc.setAttribute('content', p.seoDescription || '')

      const ogTitle = document.querySelector('meta[property="og:title"]')
      if (ogTitle) ogTitle.setAttribute('content', p.seoTitle || p.title)

      const ogDesc = document.querySelector('meta[property="og:description"]')
      if (ogDesc) ogDesc.setAttribute('content', p.seoDescription || '')

      // VULN: JSON-LD injected without escaping — </script> in a field breaks out
      if (p.jsonLd) {
        const script = document.createElement('script')
        script.type = 'application/ld+json'
        script.textContent = JSON.stringify(p.jsonLd)
        document.head.appendChild(script)
        jsonLdRef.current = script
      }
    }).catch(() => setError('Post not found'))
      .finally(() => setLoading(false))

    return () => {
      if (jsonLdRef.current) document.head.removeChild(jsonLdRef.current)
    }
  }, [id])

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitMsg('')
    try {
      const payload: any = { content: commentText }
      if (user) {
        payload.authorId = user.id
      } else {
        payload.guestName = guestName
        payload.guestUrl = guestUrl  // VULN: unfiltered URL stored as raw link
      }
      await api.post(`/comments/posts/${id}/comments`, payload)
      setSubmitMsg('Comment submitted — awaiting moderation.')
      setCommentText('')
      setGuestName('')
      setGuestUrl('')
    } catch {
      setSubmitMsg('Failed to submit comment.')
    } finally {
      setSubmitting(false)
    }
  }

  const askAI = async (e: React.FormEvent) => {
    e.preventDefault()
    setAskingAI(true)
    setAiAnswer('')
    try {
      // VULN: Prompt injection — question goes directly into AI prompt without sanitization
      const res = await api.post('/ai/ask', { question: aiQuestion })
      setAiAnswer(res.data.answer)
    } catch {
      setAiAnswer('AI service unavailable.')
    } finally {
      setAskingAI(false)
    }
  }

  if (loading) return <div className="max-w-3xl mx-auto py-12 text-muted-foreground animate-pulse">Loading…</div>
  if (error || !post) return <div className="max-w-3xl mx-auto py-12 text-destructive">{error || 'Post not found'}</div>

  return (
    <article className="max-w-3xl mx-auto space-y-12 py-12">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link to={`/author/${post.author.id}`} className="hover:underline font-medium">
            {post.author.username}
          </Link>
          <span>&bull;</span>
          <span>{format(new Date(post.createdAt), 'MMMM d, yyyy')}</span>
          {post.tags.map(t => (
            <span key={t.id} className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs">
              {t.name}
            </span>
          ))}
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">{post.title}</h1>

        {/* Author bio — VULN: dangerouslySetInnerHTML (Stored XSS) */}
        {post.author.bio && (
          <div
            className="text-sm text-muted-foreground border-l-2 pl-3"
            dangerouslySetInnerHTML={{ __html: post.author.bio }}
          />
        )}
      </header>

      {/* VULN: Stored XSS — renderedContent is server-rendered Markdown with html:true */}
      <div
        className="prose prose-lg dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: post.renderedContent }}
      />

      <hr className="border-muted" />

      {/* Ask AI section — VULN: Prompt Injection & RAG Poisoning */}
      <section className="space-y-4 p-6 rounded-lg border bg-muted/30">
        <h3 className="text-xl font-bold">Ask AI About This Blog</h3>
        <p className="text-sm text-muted-foreground">
          Uses RAG — answers may be poisoned by malicious comments in the vector store.
        </p>
        <form onSubmit={askAI} className="flex gap-2">
          <Input
            value={aiQuestion}
            onChange={e => setAiQuestion(e.target.value)}
            placeholder="What is this blog about?"
            className="flex-1"
          />
          <Button type="submit" disabled={askingAI || !aiQuestion}>
            {askingAI ? 'Asking…' : 'Ask'}
          </Button>
        </form>
        {aiAnswer && (
          <div className="p-4 rounded bg-background border text-sm whitespace-pre-wrap">
            {aiAnswer}
          </div>
        )}
      </section>

      <hr className="border-muted" />

      {/* Comments section */}
      <section className="space-y-8">
        <h3 className="text-2xl font-bold">Comments ({comments.filter(c => c.status === 'approved').length})</h3>

        <div className="space-y-6">
          {comments.filter(c => c.status === 'approved').map(comment => (
            <div key={comment.id} className="space-y-2 pb-4 border-b last:border-0">
              <div className="flex items-center gap-2 text-sm">
                {/* VULN: guestUrl rendered as raw anchor — link injection / SEO spam */}
                {comment.guestUrl ? (
                  <a
                    href={comment.guestUrl}
                    className="font-semibold hover:underline"
                    // NO rel="nofollow ugc" — intentional
                  >
                    {comment.author?.username || comment.guestName || 'Anonymous'}
                  </a>
                ) : (
                  <span className="font-semibold">
                    {comment.author?.username || comment.guestName || 'Anonymous'}
                  </span>
                )}
                <span className="text-muted-foreground text-xs">
                  {format(new Date(comment.createdAt), 'MMM d, yyyy')}
                </span>
              </div>
              {/* VULN: Stored XSS — comment content rendered with dangerouslySetInnerHTML */}
              <div
                className="text-muted-foreground text-sm"
                dangerouslySetInnerHTML={{ __html: comment.content }}
              />
            </div>
          ))}
          {comments.filter(c => c.status === 'approved').length === 0 && (
            <p className="text-muted-foreground text-sm">No approved comments yet.</p>
          )}
        </div>

        {/* Comment form */}
        <form onSubmit={submitComment} className="space-y-4 pt-4">
          <h4 className="font-semibold">Leave a Comment</h4>
          {!user && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Name</label>
                <Input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Your name" />
              </div>
              <div className="space-y-1">
                {/* VULN: guestUrl accepted without domain filter, stored raw, rendered as <a href> */}
                <label className="text-xs font-medium">Website (optional)</label>
                <Input value={guestUrl} onChange={e => setGuestUrl(e.target.value)} placeholder="https://yoursite.com" />
              </div>
            </div>
          )}
          <textarea
            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="Write your comment here... HTML allowed. Try a <script> tag."
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            required
          />
          {submitMsg && <p className="text-sm text-muted-foreground">{submitMsg}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Post Comment'}
          </Button>
        </form>
      </section>
    </article>
  )
}
