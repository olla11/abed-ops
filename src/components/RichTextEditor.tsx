'use client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import {
  Bold, Italic, Underline as UnderlineIcon, Link2, List, ListOrdered,
  Table as TableIcon, Rows3, Columns3, Trash2,
} from 'lucide-react'

const extensions = [
  StarterKit,
  Underline,
  Link.configure({ openOnClick: false, autolink: true }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
]

function ToolbarButton({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={title}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
        background: active ? '#dcfce7' : 'transparent', color: active ? '#16a34a' : '#374151',
      }}>
      {children}
    </button>
  )
}

export default function RichTextEditor({ value, onChange, readOnly }: { value: string; onChange?: (html: string) => void; readOnly: boolean }) {
  const editor = useEditor({
    extensions,
    content: value || '<p></p>',
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    editorProps: {
      attributes: { class: 'rte-content' },
    },
  })

  if (!editor) return null

  function ajouterLien() {
    const url = window.prompt('URL du lien :', editor!.getAttributes('link').href ?? 'https://')
    if (url === null) return
    if (url === '') { editor!.chain().focus().unsetLink().run(); return }
    editor!.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div style={{ border: '1px solid var(--abed-border)', borderRadius: 8, overflow: 'hidden' }}>
      {!readOnly && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '5px 6px', borderBottom: '1px solid var(--abed-border)', background: '#f9fafb', flexWrap: 'wrap' }}>
          <ToolbarButton title="Gras" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={14} /></ToolbarButton>
          <ToolbarButton title="Italique" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={14} /></ToolbarButton>
          <ToolbarButton title="Souligné" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={14} /></ToolbarButton>
          <ToolbarButton title="Lien" active={editor.isActive('link')} onClick={ajouterLien}><Link2 size={14} /></ToolbarButton>
          <span style={{ width: 1, height: 18, background: '#e5e7eb', margin: '0 4px' }} />
          <ToolbarButton title="Liste à puces" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={14} /></ToolbarButton>
          <ToolbarButton title="Liste numérotée" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={14} /></ToolbarButton>
          <span style={{ width: 1, height: 18, background: '#e5e7eb', margin: '0 4px' }} />
          <ToolbarButton title="Insérer un tableau" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon size={14} /></ToolbarButton>
          {editor.isActive('table') && (
            <>
              <ToolbarButton title="Ajouter une ligne" onClick={() => editor.chain().focus().addRowAfter().run()}><Rows3 size={14} /></ToolbarButton>
              <ToolbarButton title="Ajouter une colonne" onClick={() => editor.chain().focus().addColumnAfter().run()}><Columns3 size={14} /></ToolbarButton>
              <ToolbarButton title="Supprimer le tableau" onClick={() => editor.chain().focus().deleteTable().run()}><Trash2 size={14} /></ToolbarButton>
            </>
          )}
        </div>
      )}
      <EditorContent editor={editor} />
      <style jsx global>{`
        .rte-content { padding: 12px 14px; min-height: 180px; font-size: 14px; line-height: 1.6; outline: none; }
        .rte-content p { margin: 0 0 10px; }
        .rte-content a { color: #2563eb; text-decoration: underline; }
        .rte-content table { border-collapse: collapse; width: 100%; margin: 10px 0; }
        .rte-content table td, .rte-content table th { border: 1px solid #d1d5db; padding: 6px 8px; }
        .rte-content table th { background: #f0fdf4; font-weight: 700; }
        .rte-content ul, .rte-content ol { padding-left: 22px; margin: 0 0 10px; }
      `}</style>
    </div>
  )
}
