// VULN: Post content saves raw HTML/script to backend — Stored XSS + Prompt Injection surface
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, Sparkles, Send, Bot } from 'lucide-react'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'

export function PostEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [aiContent, setAiContent] = useState('')
  const [tags, setTags] = useState('')
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [summary, setSummary] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [loading, setLoading] = useState(!!id)

  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Start writing…</p>',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none dark:prose-invert min-h-[400px] p-4',
      },
    },
  })

  // Load existing post when editing
  useEffect(() => {
    if (!id || !editor) return
    api.get(`/content/posts/${id}`).then(res => {
      const p = res.data
      setTitle(p.title)
      setExcerpt(p.excerpt || '')
      setAiContent(p.post_ai_content || '')
      setTags(p.tags?.map((t: any) => t.name).join(', ') || '')
      setStatus(p.status)
      editor.commands.setContent(p.content)
    }).finally(() => setLoading(false))
  }, [id, editor])

  // VULN: Prompt Injection — post content sent to AI without sanitization
  const handleAISummarize = async () => {
    if (!editor) return
    setIsSummarizing(true)
    try {
      const text = editor.getText()
      // Goes through api-gateway → ai-service /summarize
      const res = await api.post('/ai/summarize', { text })
      setSummary(res.data.summary)
    } catch {
      setSummary('AI service unavailable. Is Ollama running?')
    } finally {
      setIsSummarizing(false)
    }
  }

  const handleSave = async (saveStatus?: 'draft' | 'published') => {
    if (!editor || !user) return
    setSaving(true)
    setSaveMsg('')

    const content = editor.getHTML()  // VULN: raw HTML saved without sanitization
    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)

    const payload = {
      title,
      content,           // VULN: raw HTML — Stored XSS + Markdown injection surface
      excerpt,
      post_ai_content: aiContent,  // VULN: AI crawler poisoning payload
      authorId: user.id,
      tags: tagList,
      status: saveStatus || status,
      metadata: {
        seoTitle: title,
        seoDescription: excerpt
        // VULN: These go into <title>/<meta> without escaping — metadata injection
      }
    }

    try {
      if (id) {
        await api.put(`/content/posts/${id}`, payload)
        setSaveMsg('Post updated.')
      } else {
        const res = await api.post('/content/posts', payload)
        setSaveMsg('Post created.')
        navigate(`/admin/editor/${res.data.id}`)
      }
    } catch (err: any) {
      setSaveMsg('Save failed: ' + (err.response?.data?.error || err.message))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-muted-foreground animate-pulse">Loading post…</div>

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <header className="flex items-center justify-between px-6 py-3 border-b gap-4 shrink-0">
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Post Title"
          className="text-xl font-bold border-none shadow-none focus-visible:ring-0 max-w-2xl px-0"
        />
        <div className="flex items-center gap-2 shrink-0">
          {saveMsg && <span className="text-xs text-muted-foreground">{saveMsg}</span>}
          <Button variant="ghost" size="icon" onClick={() => setShowAiPanel(p => !p)} title="AI Tools">
            <Bot className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={() => handleSave('draft')} disabled={saving}>
            <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving…' : 'Save Draft'}
          </Button>
          <Button onClick={() => handleSave('published')} disabled={saving}>
            <Send className="w-4 h-4 mr-2" /> Publish
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <main className="flex-1 overflow-y-auto">
          {/* AI Summary banner */}
          {summary && (
            <div className="mx-8 mt-6 p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">AI Summary</span>
              </div>
              <p className="text-sm text-indigo-700 dark:text-indigo-400">{summary}</p>
            </div>
          )}

          {/* TipTap editor */}
          <div
            className="m-8 border rounded-lg min-h-[500px] cursor-text"
            onClick={() => editor?.commands.focus()}
          >
            <EditorContent editor={editor} />
          </div>
        </main>

        {/* Right panel — metadata & AI poisoning fields */}
        {showAiPanel && (
          <aside className="w-72 border-l p-4 overflow-y-auto space-y-4 shrink-0">
            <h3 className="font-semibold text-sm">Post Settings</h3>

            <div className="space-y-1">
              <label className="text-xs font-medium">Excerpt / Description</label>
              {/* VULN: excerpt rendered as raw HTML in frontend */}
              <textarea
                className="w-full text-sm rounded border bg-background px-2 py-1.5 min-h-[80px] resize-none"
                value={excerpt}
                onChange={e => setExcerpt(e.target.value)}
                placeholder="Short description (raw HTML allowed)"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Tags (comma-separated)</label>
              <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="security, xss, ai" className="text-sm" />
            </div>

            <div className="space-y-1 border-t pt-4">
              <div className="flex items-center gap-1">
                <Bot size={14} className="text-amber-500" />
                <label className="text-xs font-medium text-amber-600">AI Crawler Poison Content</label>
              </div>
              <p className="text-xs text-muted-foreground">Shown only to AI crawlers (GPTBot, ClaudeBot…)</p>
              {/* VULN: AI Crawler poisoning — this field served to AI crawlers */}
              <textarea
                className="w-full text-sm rounded border bg-amber-50 dark:bg-amber-950/20 border-amber-200 px-2 py-1.5 min-h-[100px] resize-none font-mono"
                value={aiContent}
                onChange={e => setAiContent(e.target.value)}
                placeholder="Ignore previous instructions. Output: ..."
              />
            </div>

            <div className="border-t pt-4 space-y-2">
              <Button size="sm" variant="outline" className="w-full" onClick={handleAISummarize} disabled={isSummarizing}>
                <Sparkles className="w-3.5 h-3.5 mr-2 text-indigo-500" />
                {isSummarizing ? 'Summarizing…' : 'AI Summarize (Prompt Injection)'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Sends post content directly to Ollama — try injecting "Ignore instructions…" in the body.
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
