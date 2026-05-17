import { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Button } from '../../components/ui/button'
import { Plus, Edit, Trash2, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import api from '../../lib/api'

interface Post {
  id: number
  title: string
  status: string
  createdAt: string
  author: { username: string }
  tags: { name: string }[]
}

export function PostsList() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all')

  const load = () => {
    setLoading(true)
    const status = filter === 'all' ? '' : filter
    const url = status ? `/content/posts?status=${status}` : '/content/posts?status=published'
    // Fetch both if all
    const fetches = filter === 'all'
      ? Promise.all([api.get('/content/posts?status=published'), api.get('/content/posts?status=draft')])
          .then(([pub, draft]) => [...pub.data, ...draft.data])
      : api.get(url).then(r => r.data)

    Promise.resolve(fetches)
      .then(data => setPosts(data as Post[]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  const deletePost = async (id: number) => {
    if (!confirm('Delete this post?')) return
    await api.delete(`/content/posts/${id}`)
    setPosts(ps => ps.filter(p => p.id !== id))
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Posts</h1>
        <Button asChild>
          <Link to="/admin/editor">
            <Plus className="w-4 h-4 mr-2" />
            New Post
          </Link>
        </Button>
      </div>

      <div className="flex gap-2">
        {(['all', 'published', 'draft'] as const).map(f => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="text-muted-foreground animate-pulse py-4">Loading posts…</div>
      ) : (
        <div className="border rounded-md bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map(post => (
                <TableRow key={post.id}>
                  <TableCell className="font-medium">{post.title}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      post.status === 'published'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {post.status}
                    </span>
                  </TableCell>
                  <TableCell>{post.author?.username}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{post.tags?.map(t => t.name).join(', ')}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{format(new Date(post.createdAt), 'MMM d, yyyy')}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" asChild>
                      <Link to={`/admin/editor/${post.id}`}><Edit className="w-4 h-4" /></Link>
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deletePost(post.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" asChild>
                      <Link to={`/post/${post.id}`} target="_blank"><ExternalLink className="w-4 h-4" /></Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {posts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No posts yet. <Link to="/admin/editor" className="underline">Create one</Link>.
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
