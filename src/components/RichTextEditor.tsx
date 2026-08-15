'use client'
import { useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import { baseTdrExtensions } from '@/lib/tdr-editor-extensions'
import type * as Y from 'yjs'
import type { SupabaseYjsProvider } from '@/lib/yjs-supabase-provider'
import {
  Bold, Italic, Underline as UnderlineIcon, Link2, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Table as TableIcon, Rows3, Columns3, TableRowsSplit, TableColumnsSplit, Trash2, MessageSquarePlus,
  Undo2, Redo2, CornerDownLeft, Merge, Split, Highlighter, PenLine,
} from 'lucide-react'

export type CollabConfig = {
  doc: Y.Doc
  fragment: string
  provider: SupabaseYjsProvider
  user: { name: string; color: string }
}

export type RichTextEditorHandle = {
  // Retire toutes les marques "comment" portant ce commentId, dans tout le
  // document — utilisé quand un commentaire est supprimé, pour que le
  // surlignage associé disparaisse avec lui.
  removeCommentMark: (commentId: string) => void
  // Insère un tampon de signature à la position actuelle du curseur.
  insertSignatureStamp: (src: string, signerName: string) => void
  // Lecture synchrone du HTML courant — utile juste après un appel
  // impératif (insertSignatureStamp, removeCommentMark) : onChange étant
  // asynchrone via le state React du parent, ce getter évite de sauvegarder
  // une version obsolète du contenu.
  getHTML: () => string
}

function ToolbarButton({ onClick, active, title, children, disabled, label }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode; disabled?: boolean; label?: string }) {
  return (
    <button type="button" onClick={onClick} title={title} disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        padding: label ? '0 10px' : 0, width: label ? 'auto' : 30, height: 28, borderRadius: 6, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: active ? '#dcfce7' : 'transparent', color: active ? '#16a34a' : '#374151',
        opacity: disabled ? 0.4 : 1, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
      }}>
      {children}
      {label && <span>{label}</span>}
    </button>
  )
}

const RichTextEditor = forwardRef<RichTextEditorHandle, {
  value: string
  onChange?: (html: string) => void
  readOnly: boolean
  collab?: CollabConfig
  onComment?: (commentId: string, texteSelectionne: string) => void
  onClickComment?: (commentId: string) => void
  onSign?: () => void
}>(function RichTextEditor({
  value, onChange, readOnly, collab, onComment, onClickComment, onSign,
}, ref) {
  const [, setTick] = useState(0)

  const extensions = [
    ...baseTdrExtensions(!!collab),
    ...(collab ? [
      Collaboration.configure({ document: collab.doc, field: collab.fragment }),
      CollaborationCursor.configure({ provider: collab.provider as any, user: collab.user }),
    ] : []),
  ]

  const editor = useEditor({
    extensions,
    content: collab ? undefined : (value || '<p></p>'),
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    onSelectionUpdate: () => setTick(t => t + 1),
    editorProps: {
      attributes: { class: 'rte-content' },
      // Clic sur un passage commenté (surligné) : ouvre/pointe le commentaire
      // correspondant dans le panneau, que l'éditeur soit modifiable ou non.
      handleClick: (_view, _pos, event) => {
        if (!onClickComment) return false
        const target = (event.target as HTMLElement)?.closest?.('[data-comment-id]')
        const commentId = target?.getAttribute('data-comment-id')
        if (commentId) { onClickComment(commentId); return true }
        return false
      },
    },
  }, [collab?.fragment])

  // En mode non-collaboratif, si la valeur change depuis l'extérieur (ex: changement
  // de chapitre), on resynchronise le contenu de l'éditeur.
  useEffect(() => {
    if (!editor || collab) return
    if (editor.getHTML() !== (value || '<p></p>')) {
      editor.commands.setContent(value || '<p></p>', { emitUpdate: false } as any)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor, collab])

  useImperativeHandle(ref, () => ({
    removeCommentMark(commentId: string) {
      if (!editor) return
      const { state, view } = editor
      let tr = state.tr
      let changed = false
      state.doc.descendants((node, pos) => {
        node.marks.forEach(mark => {
          if (mark.type.name === 'comment' && (mark.attrs as { commentId?: string }).commentId === commentId) {
            tr = tr.removeMark(pos, pos + node.nodeSize, mark.type)
            changed = true
          }
        })
      })
      if (changed) view.dispatch(tr)
    },
    insertSignatureStamp(src: string, signerName: string) {
      if (!editor) return
      editor.chain().focus().insertSignatureStamp({
        src, signerName, signedAt: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      }).run()
    },
    getHTML() {
      return editor?.getHTML() ?? ''
    },
  }), [editor])

  if (!editor) return null

  function ajouterLien() {
    const url = window.prompt('URL du lien :', editor!.getAttributes('link').href ?? 'https://')
    if (url === null) return
    if (url === '') { editor!.chain().focus().unsetLink().run(); return }
    editor!.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  function definirAlignement(valeur: 'left' | 'center' | 'right' | 'justify') {
    if (editor!.isActive({ textAlign: valeur })) {
      editor!.chain().focus().unsetTextAlign().run()
    } else {
      editor!.chain().focus().setTextAlign(valeur).run()
    }
  }

  function supprimerTableau() {
    if (window.confirm('Supprimer tout le tableau ? Cette action est irréversible.')) {
      editor!.chain().focus().deleteTable().run()
    }
  }

  function ajouterCommentaire() {
    const { from, to, empty } = editor!.state.selection
    if (empty) { window.alert('Sélectionnez d\'abord le texte à commenter.'); return }
    const texte = editor!.state.doc.textBetween(from, to, ' ')
    const commentId = crypto.randomUUID()
    editor!.chain().focus().setComment(commentId).run()
    onComment?.(commentId, texte)
  }

  const selectionVide = editor.state.selection.empty

  return (
    <div style={{ border: '1px solid var(--abed-border)', borderRadius: 8, overflow: 'hidden' }}>
      {!readOnly && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '5px 6px', borderBottom: '1px solid var(--abed-border)', background: '#f9fafb', flexWrap: 'wrap' }}>
          <ToolbarButton title="Annuler (Ctrl+Z)" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={14} /></ToolbarButton>
          <ToolbarButton title="Rétablir (Ctrl+Y)" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={14} /></ToolbarButton>
          <span style={{ width: 1, height: 18, background: '#e5e7eb', margin: '0 4px' }} />
          <ToolbarButton title="Gras" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={14} /></ToolbarButton>
          <ToolbarButton title="Italique" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={14} /></ToolbarButton>
          <ToolbarButton title="Souligné" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={14} /></ToolbarButton>
          <ToolbarButton title="Lien" active={editor.isActive('link')} onClick={ajouterLien}><Link2 size={14} /></ToolbarButton>
          <ToolbarButton title="Surligner la sélection" label="Surligner" active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()}><Highlighter size={14} /></ToolbarButton>
          <span style={{ width: 1, height: 18, background: '#e5e7eb', margin: '0 4px' }} />
          <ToolbarButton title="Liste à puces" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={14} /></ToolbarButton>
          <ToolbarButton title="Liste numérotée" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={14} /></ToolbarButton>
          <span style={{ width: 1, height: 18, background: '#e5e7eb', margin: '0 4px' }} />
          <ToolbarButton title="Aligner à gauche" active={editor.isActive({ textAlign: 'left' })} onClick={() => definirAlignement('left')}><AlignLeft size={14} /></ToolbarButton>
          <ToolbarButton title="Centrer" active={editor.isActive({ textAlign: 'center' })} onClick={() => definirAlignement('center')}><AlignCenter size={14} /></ToolbarButton>
          <ToolbarButton title="Aligner à droite" active={editor.isActive({ textAlign: 'right' })} onClick={() => definirAlignement('right')}><AlignRight size={14} /></ToolbarButton>
          <ToolbarButton title="Justifier" active={editor.isActive({ textAlign: 'justify' })} onClick={() => definirAlignement('justify')}><AlignJustify size={14} /></ToolbarButton>
          <ToolbarButton title="Saut de ligne (Maj+Entrée)" onClick={() => editor.chain().focus().setHardBreak().run()}><CornerDownLeft size={14} /></ToolbarButton>
          <span style={{ width: 1, height: 18, background: '#e5e7eb', margin: '0 4px' }} />
          <ToolbarButton title="Insérer un tableau" onClick={() => editor.chain().focus().insertTable({ rows: 2, cols: 3, withHeaderRow: true }).run()}><TableIcon size={14} /></ToolbarButton>
          {editor.isActive('table') && (
            <>
              <ToolbarButton title="Ajouter une ligne" onClick={() => editor.chain().focus().addRowAfter().run()}><Rows3 size={14} /></ToolbarButton>
              <ToolbarButton title="Ajouter une colonne" onClick={() => editor.chain().focus().addColumnAfter().run()}><Columns3 size={14} /></ToolbarButton>
              <ToolbarButton title="Supprimer la ligne" onClick={() => editor.chain().focus().deleteRow().run()}><TableRowsSplit size={14} /></ToolbarButton>
              <ToolbarButton title="Supprimer la colonne" onClick={() => editor.chain().focus().deleteColumn().run()}><TableColumnsSplit size={14} /></ToolbarButton>
              <ToolbarButton title="Fusionner les cellules sélectionnées" disabled={!editor.can().mergeCells()} onClick={() => editor.chain().focus().mergeCells().run()}><Merge size={14} /></ToolbarButton>
              <ToolbarButton title="Fractionner la cellule" disabled={!editor.can().splitCell()} onClick={() => editor.chain().focus().splitCell().run()}><Split size={14} /></ToolbarButton>
              <span style={{ width: 1, height: 18, background: '#e5e7eb', margin: '0 4px' }} />
              <ToolbarButton title="Supprimer tout le tableau" onClick={supprimerTableau}><Trash2 size={14} /></ToolbarButton>
            </>
          )}
          {onComment && (
            <>
              <span style={{ width: 1, height: 18, background: '#e5e7eb', margin: '0 4px' }} />
              <ToolbarButton title="Commenter la sélection" label="Commenter" disabled={selectionVide} onClick={ajouterCommentaire}><MessageSquarePlus size={14} /></ToolbarButton>
            </>
          )}
          {onSign && (
            <>
              <span style={{ width: 1, height: 18, background: '#e5e7eb', margin: '0 4px' }} />
              <ToolbarButton title="Apposer ma signature ici" label="Signer" onClick={onSign}><PenLine size={14} /></ToolbarButton>
            </>
          )}
        </div>
      )}
      {readOnly && (onComment || onSign) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px', borderBottom: '1px solid var(--abed-border)', background: '#f9fafb', flexWrap: 'wrap' }}>
          {onComment && <ToolbarButton title="Commenter la sélection" label="Commenter" disabled={selectionVide} onClick={ajouterCommentaire}><MessageSquarePlus size={14} /></ToolbarButton>}
          {onSign && <ToolbarButton title="Apposer ma signature ici" label="Signer" onClick={onSign}><PenLine size={14} /></ToolbarButton>}
          {onComment && <span style={{ fontSize: 11, color: 'var(--abed-muted)' }}>Sélectionnez du texte pour le commenter</span>}
        </div>
      )}
      <EditorContent editor={editor} />
      <style jsx global>{`
        .rte-content { padding: 16px 20px; min-height: 480px; font-size: 14px; line-height: 1.6; outline: none; }
        .rte-content p { margin: 0 0 10px; }
        .rte-content a { color: #2563eb; text-decoration: underline; }
        .rte-content table { border-collapse: collapse; width: 100%; margin: 10px 0; }
        .rte-content table td, .rte-content table th {
          border: 1px solid #d1d5db; padding: 6px 8px; position: relative;
          overflow-wrap: break-word; word-break: break-word; white-space: normal; vertical-align: top;
        }
        .rte-content table th { background: #f0fdf4; font-weight: 700; }
        /* Surlignage de la sélection multi-cellules (glisser sur plusieurs
           cellules) — fourni par prosemirror-tables mais jamais importé,
           donc jusqu'ici la sélection était invisible bien que fonctionnelle
           (ce qui rendait fusionner/fractionner impossibles à utiliser). */
        .rte-content .selectedCell:after {
          z-index: 2; position: absolute; content: ''; left: 0; right: 0; top: 0; bottom: 0;
          background: rgba(22, 163, 74, 0.18); pointer-events: none;
        }
        .rte-content ul, .rte-content ol { padding-left: 22px; margin: 0 0 10px; }
        .rte-content [data-comment-id] { background: #fef9c3; border-bottom: 2px solid #eab308; cursor: pointer; }
        .rte-content mark.rte-highlight { background: #fde047; border-radius: 2px; padding: 0 1px; }
        .rte-content .doc-signature-stamp { max-height: 46px; vertical-align: middle; margin: 0 4px; }
        .collaboration-cursor__caret { position: relative; margin-left: -1px; margin-right: -1px; border-left: 1px solid; border-right: 1px solid; word-break: normal; pointer-events: none; }
        .collaboration-cursor__label { position: absolute; top: -1.4em; left: -1px; font-size: 11px; font-weight: 700; line-height: 1; user-select: none; white-space: nowrap; border-radius: 4px 4px 4px 0; padding: 2px 6px; color: white; }
      `}</style>
    </div>
  )
})

export default RichTextEditor
