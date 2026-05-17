import { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Button } from '../../components/ui/button'
import { Check, X, ShieldAlert, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import api from '../../lib/api'

interface Comment {
  id: number
  content: string
  guestName: string | null
  guestUrl: string | null
  status: string
  createdAt: string
  author: { id: number; username: string } | null
  post: { id: number; title: string } | null
}

const STATUS_BADGE: Record<string, string> = {
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  pending:  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  spam:     'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  rejected: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
}

export function CommentsModeration() {
  const [comments, setComments] = useState<Comment[]>([])
  const [filter, setFilter] = useState<string>('pending')
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    api.get(`/comments/comments?status=${filter}`)
      .then(r => setComments(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  const moderate = async (id: number, status: string) => {
    await api.post(`/comments/comments/${id}/moderate`, { status })
    setComments(cs => cs.filter(c => c.id !== id))
  }

  const deleteComment = async (id: number) => {
    await api.delete(`/comments/comments/${id}`)
    setComments(cs => cs.filter(c => c.id !== id))
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Comments Moderation</h1>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5 mr-2" /> Refresh
        </Button>
      </div>

      <div className="flex gap-2">
        {['pending', 'approved', 'spam', 'rejected'].map(f => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="text-muted-foreground animate-pulse py-4">Loading…</div>
      ) : (
        <div className="border rounded-md bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Author</TableHead>
                <TableHead className="w-[35%]">Content (raw — may contain XSS)</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Post</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comments.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-sm">
                    {c.author?.username || c.guestName || 'Anonymous'}
                  </TableCell>
                  {/* VULN: dangerouslySetInnerHTML — admin sees XSS executed in moderation panel */}
                  <TableCell>
                    <div
                      className="text-muted-foreground text-sm max-w-xs truncate"
                      dangerouslySetInnerHTML={{ __html: c.content }}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.guestUrl ? (
                      <a href={c.guestUrl} className="hover:underline" target="_blank">{c.guestUrl.slice(0, 30)}</a>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.post ? c.post.title.slice(0, 25) : '—'}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[c.status] || ''}`}>
                      {c.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(c.createdAt), 'MMM d')}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" className="text-green-600" title="Approve" onClick={() => moderate(c.id, 'approved')}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" title="Spam" onClick={() => moderate(c.id, 'spam')}>
                      <ShieldAlert className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Delete" onClick={() => deleteComment(c.id)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {comments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No {filter} comments.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
