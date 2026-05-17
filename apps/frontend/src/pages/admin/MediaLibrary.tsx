// VULN: Malicious HTML rendering in file descriptions via dangerouslySetInnerHTML
import { useEffect, useRef, useState } from 'react'
import { Card, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { UploadCloud, Link as LinkIcon, Trash2, RefreshCw } from 'lucide-react'
import api from '../../lib/api'

interface Media {
  id: number
  filename: string
  url: string
  description: string | null
  createdAt: string
}

export function MediaLibrary() {
  const [media, setMedia] = useState<Media[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [description, setDescription] = useState('')
  const [uploadMsg, setUploadMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    setLoading(true)
    api.get('/media/files').then(r => setMedia(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleUpload = async (file: File) => {
    setUploading(true)
    setUploadMsg('')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('description', description)  // VULN: raw HTML description stored
    try {
      await api.post('/media/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setUploadMsg('File uploaded.')
      setDescription('')
      load()
    } catch {
      setUploadMsg('Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this file?')) return
    await api.delete(`/media/files/${id}`)
    setMedia(m => m.filter(f => f.id !== id))
  }

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(window.location.origin + url)
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Media Library</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5 mr-2" /> Refresh</Button>
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            <UploadCloud className="w-4 h-4 mr-2" />
            {uploading ? 'Uploading…' : 'Upload File'}
          </Button>
        </div>
      </div>

      {/* Upload form */}
      <div className="border rounded-lg p-4 space-y-3 bg-card">
        <h3 className="text-sm font-semibold">Upload New File</h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1 space-y-1">
            {/* VULN: description accepts raw HTML — rendered via dangerouslySetInnerHTML */}
            <label className="text-xs text-muted-foreground">Description (HTML allowed — Malicious HTML injection target)</label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder='<script>alert("xss")</script> or plain text'
              className="text-sm font-mono"
            />
          </div>
          <Button onClick={() => fileRef.current?.click()} variant="outline" disabled={uploading}>
            Choose File
          </Button>
        </div>
        {uploadMsg && <p className="text-xs text-muted-foreground">{uploadMsg}</p>}
        <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
      </div>

      {/* Drag-and-drop zone */}
      <div
        className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer"
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
      >
        <UploadCloud className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm font-medium">Drop files here or click to upload</p>
        <p className="text-xs mt-1">No file type restrictions (intentional)</p>
      </div>

      {loading ? (
        <div className="text-muted-foreground animate-pulse">Loading media…</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {media.map(item => (
            <Card key={item.id} className="overflow-hidden group">
              <div className="aspect-square relative bg-muted flex items-center justify-center">
                {/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item.filename) ? (
                  <img src={item.url} alt={item.filename} className="object-cover w-full h-full" />
                ) : (
                  <div className="text-3xl font-mono text-muted-foreground">{item.filename.split('.').pop()}</div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="icon" variant="secondary" onClick={() => copyUrl(item.url)} title="Copy URL">
                    <LinkIcon className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="destructive" onClick={() => handleDelete(item.id)} title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-2 space-y-1">
                <p className="text-xs font-medium truncate">{item.filename}</p>
                {/* VULN: Malicious HTML rendering — description rendered as raw HTML */}
                {item.description && (
                  <div
                    className="text-xs text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: item.description }}
                  />
                )}
              </CardContent>
            </Card>
          ))}
          {media.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground py-8">
              No files uploaded yet.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
