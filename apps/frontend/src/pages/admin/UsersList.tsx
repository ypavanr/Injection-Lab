// VULN: IDOR — any user can call PUT /api/users/users/:id to change any user's bio/role
// VULN: Stored XSS — user bios rendered via dangerouslySetInnerHTML
import { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { RefreshCw, Edit2, Check, X } from 'lucide-react'
import api from '../../lib/api'

interface User {
  id: number
  username: string
  email: string
  role: string
  bio: string | null
  website: string | null
}

const ROLE_BADGE: Record<string, string> = {
  admin:      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  editor:     'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  author:     'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  subscriber: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
}

export function UsersList() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<number | null>(null)
  const [editBio, setEditBio] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editWebsite, setEditWebsite] = useState('')

  const load = () => {
    setLoading(true)
    api.get('/users/users').then(r => setUsers(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const startEdit = (u: User) => {
    setEditId(u.id)
    setEditBio(u.bio || '')
    setEditRole(u.role)
    setEditWebsite(u.website || '')
  }

  // VULN: IDOR — sends request to /users/:id with no ownership verification
  const saveEdit = async (id: number) => {
    await api.put(`/users/users/${id}`, { bio: editBio, role: editRole, website: editWebsite })
    setEditId(null)
    load()
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5 mr-2" /> Refresh</Button>
      </div>

      <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded p-3">
        <strong>IDOR:</strong> PUT /api/users/users/:id has no ownership check — any authenticated user can edit any other user's profile or escalate their own role.
      </div>

      {loading ? (
        <div className="text-muted-foreground animate-pulse py-4">Loading users…</div>
      ) : (
        <div className="border rounded-md bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-[30%]">Bio (raw HTML — XSS)</TableHead>
                <TableHead>Website</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.username}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    {editId === u.id ? (
                      <select
                        className="text-xs border rounded px-1 py-0.5 bg-background"
                        value={editRole}
                        onChange={e => setEditRole(e.target.value)}
                      >
                        {['admin','editor','author','subscriber'].map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[u.role] || ''}`}>
                        {u.role}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editId === u.id ? (
                      <Input value={editBio} onChange={e => setEditBio(e.target.value)} className="text-xs h-7" placeholder="<script>alert(1)</script>" />
                    ) : (
                      /* VULN: Stored XSS — bio rendered as raw HTML */
                      <div
                        className="text-xs text-muted-foreground max-w-[200px] truncate"
                        dangerouslySetInnerHTML={{ __html: u.bio || '' }}
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {editId === u.id ? (
                      <Input value={editWebsite} onChange={e => setEditWebsite(e.target.value)} className="text-xs h-7" />
                    ) : (
                      u.website ? <a href={u.website} className="hover:underline" target="_blank">{u.website.slice(0,25)}</a> : '—'
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {editId === u.id ? (
                      <>
                        <Button size="icon" variant="ghost" className="text-green-600" onClick={() => saveEdit(u.id)}><Check className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditId(null)}><X className="w-3.5 h-3.5" /></Button>
                      </>
                    ) : (
                      <Button size="icon" variant="ghost" onClick={() => startEdit(u)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
