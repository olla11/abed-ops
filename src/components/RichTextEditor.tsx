'use client'
import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import { baseTdrExtensions } from '@/lib/tdr-editor-extensions'
import { PageBreak } from '@/lib/tiptap-page-break'
import type * as Y from 'yjs'
import type { SupabaseYjsProvider } from '@/lib/yjs-supabase-provider'
import {
  Bold, Italic, Underline as UnderlineIcon, Link2, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Table as TableIcon, Rows3, Columns3, TableRowsSplit, TableColumnsSplit, Trash2, MessageSquarePlus,
  Undo2, Redo2, CornerDownLeft, Merge, Split, Highlighter, PenLine,
  Baseline, Type, AlignVerticalSpaceAround, Save, Download, FileText, Eraser,
  Heading, Heading1, Heading2, Heading3, Pilcrow,
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
        opacity: disabled ? 0.4 : 1, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
      }}>
      {children}
      {label && <span>{label}</span>}
    </button>
  )
}

// Bouton qui déroule un petit panneau (couleurs, police, interligne, menu
// fichier...) — se ferme au clic en dehors.
function DropdownButton({ icon, title, label, active, children }: {
  icon: React.ReactNode; title: string; label?: string; active?: boolean
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <ToolbarButton title={title} label={label} active={active || open} onClick={() => setOpen(o => !o)}>{icon}</ToolbarButton>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'white',
          border: '1px solid var(--abed-border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.14)',
          zIndex: 60, padding: 10,
        }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

function ColorGrid({ colors, onPick, onClear }: { colors: string[]; onPick: (c: string) => void; onClear: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 132 }}>
      {colors.map(c => (
        <button key={c} type="button" onClick={() => onPick(c)} title={c}
          style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: '1px solid rgba(0,0,0,.15)', cursor: 'pointer', padding: 0 }} />
      ))}
      <button type="button" onClick={onClear} title="Aucune couleur"
        style={{ width: 22, height: 22, borderRadius: '50%', background: 'white', border: '1px solid #d1d5db', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
        <Eraser size={11} color="#9ca3af" />
      </button>
    </div>
  )
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, border: 'none',
  background: 'transparent', cursor: 'pointer', fontSize: 12.5, color: '#374151', width: '100%', textAlign: 'left', whiteSpace: 'nowrap',
}

const HIGHLIGHT_COLORS = ['#fde047', '#86efac', '#93c5fd', '#fca5a5', '#d8b4fe', '#fdba74']
const TEXT_COLORS = ['#111827', '#dc2626', '#2563eb', '#16a34a', '#ca8a04', '#7c3aed', '#db2777']
const FONTS = [
  { label: 'Police par défaut', value: '' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'Comic Sans MS', value: '"Comic Sans MS", cursive' },
]
const LINE_HEIGHTS = [
  { label: 'Interligne par défaut', value: '' },
  { label: 'Simple', value: '1' },
  { label: '1,15', value: '1.15' },
  { label: '1,5', value: '1.5' },
  { label: 'Double', value: '2' },
]
const TITLE_LEVELS: { label: string; level: 0 | 1 | 2 | 3; icon: React.ReactNode }[] = [
  { label: 'Texte normal', level: 0, icon: <Pilcrow size={13} /> },
  { label: 'Titre 1', level: 1, icon: <Heading1 size={13} /> },
  { label: 'Titre 2', level: 2, icon: <Heading2 size={13} /> },
  { label: 'Titre 3', level: 3, icon: <Heading3 size={13} /> },
]

const RichTextEditor = forwardRef<RichTextEditorHandle, {
  value: string
  onChange?: (html: string) => void
  readOnly: boolean
  collab?: CollabConfig
  onComment?: (commentId: string, texteSelectionne: string) => void
  onClickComment?: (commentId: string) => void
  onSign?: () => void
  onSave?: () => void
  saving?: boolean
  onDownloadPdf?: () => void
  onDownloadWord?: () => void
  // Hauteur de texte utilisable par page, en pixels — extraite du .docx
  // importé (voir docx-page-setup.ts) pour coller à sa mise en page réelle.
  // Par défaut (document vierge, ou fichier sans mise en page détectable) :
  // page A4 avec marges d'1 pouce, la même valeur que PAGE_HEIGHT_PX.
  pageHeightPx?: number
}>(function RichTextEditor({
  value, onChange, readOnly, collab, onComment, onClickComment, onSign, onSave, saving, onDownloadPdf, onDownloadWord, pageHeightPx,
}, ref) {
  const [, setTick] = useState(0)
  const contentWrapRef = useRef<HTMLDivElement>(null)
  const [pageInfo, setPageInfo] = useState({ current: 1, total: 1 })

  const extensions = [
    ...baseTdrExtensions(!!collab),
    // Pas dans baseTdrExtensions (partagé avec le TdR, dont l'appel sert
    // aussi à extraire un schéma seul côté amorçage Yjs) : un plugin
    // ProseMirror à clé unique ('pageBreak') ne peut exister qu'une fois par
    // éditeur — le construire ici garantit une seule instance, branchée sur
    // le onPageInfo de cette instance précise. current/total sont calculés
    // par l'extension elle-même à partir des vraies frontières de page
    // mesurées (pas d'une simple division par une hauteur de cycle supposée
    // uniforme — voir tiptap-page-break.ts).
    PageBreak.configure({
      pageHeightPx,
      onPageInfo: ({ current, total }) => setPageInfo(pi => (pi.current === current && pi.total === total ? pi : { current, total })),
    }),
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

  function definirTitre(level: 0 | 1 | 2 | 3) {
    if (level === 0) editor!.chain().focus().setParagraph().run()
    else editor!.chain().focus().toggleHeading({ level }).run()
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
  const couleurSurlignageActive = (editor.getAttributes('highlight') as { color?: string })?.color

  const commentSignRow = (onComment || onSign) && (
    <>
      {onComment && <ToolbarButton title="Commenter la sélection" label="Commenter" disabled={selectionVide} onClick={ajouterCommentaire}><MessageSquarePlus size={14} /></ToolbarButton>}
      {onSign && <ToolbarButton title="Apposer ma signature ici" label="Signer" onClick={onSign}><PenLine size={14} /></ToolbarButton>}
    </>
  )

  return (
    <div>
      {(!readOnly || onComment || onSign || onSave || onDownloadPdf || onDownloadWord) && (
        <div className="rte-toolbar" style={{
          position: 'sticky', top: 60, zIndex: 40, display: 'flex', alignItems: 'center', gap: 2,
          padding: '6px 8px', borderRadius: 10, background: 'white', boxShadow: '0 2px 10px rgba(0,0,0,.08)',
          border: '1px solid var(--abed-border)', flexWrap: 'wrap', marginBottom: 14,
        }}>
          {!readOnly && (
            <>
              <ToolbarButton title="Annuler (Ctrl+Z)" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={14} /></ToolbarButton>
              <ToolbarButton title="Rétablir (Ctrl+Y)" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={14} /></ToolbarButton>
              <span style={{ width: 1, height: 18, background: '#e5e7eb', margin: '0 4px' }} />
              <DropdownButton icon={<Heading size={14} />} title="Style de titre"
                active={TITLE_LEVELS.some(t => t.level > 0 && editor.isActive('heading', { level: t.level }))}>
                {close => (
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 150 }}>
                    {TITLE_LEVELS.map(t => (
                      <button key={t.level} type="button" style={menuItemStyle}
                        onClick={() => { definirTitre(t.level); close() }}>
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </DropdownButton>
              <span style={{ width: 1, height: 18, background: '#e5e7eb', margin: '0 4px' }} />
              <ToolbarButton title="Gras" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={14} /></ToolbarButton>
              <ToolbarButton title="Italique" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={14} /></ToolbarButton>
              <ToolbarButton title="Souligné" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={14} /></ToolbarButton>
              <ToolbarButton title="Lien" active={editor.isActive('link')} onClick={ajouterLien}><Link2 size={14} /></ToolbarButton>

              <DropdownButton icon={<Baseline size={14} color={(editor.getAttributes('textColor') as { color?: string })?.color} />} title="Couleur du texte">
                {close => (
                  <ColorGrid colors={TEXT_COLORS}
                    onPick={c => { editor.chain().focus().setTextColor(c).run(); close() }}
                    onClear={() => { editor.chain().focus().unsetTextColor().run(); close() }} />
                )}
              </DropdownButton>
              <DropdownButton icon={<Highlighter size={14} />} title="Surligner la sélection" label="Surligner" active={editor.isActive('highlight')}>
                {close => (
                  <ColorGrid colors={HIGHLIGHT_COLORS}
                    onPick={c => { editor.chain().focus().setHighlight(c).run(); close() }}
                    onClear={() => { editor.chain().focus().unsetHighlight().run(); close() }} />
                )}
              </DropdownButton>
              {couleurSurlignageActive && <span style={{ width: 10, height: 10, borderRadius: '50%', background: couleurSurlignageActive, flexShrink: 0 }} />}

              <span style={{ width: 1, height: 18, background: '#e5e7eb', margin: '0 4px' }} />
              <DropdownButton icon={<Type size={14} />} title="Police">
                {close => (
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 170 }}>
                    {FONTS.map(f => (
                      <button key={f.value} type="button" style={{ ...menuItemStyle, fontFamily: f.value || undefined }}
                        onClick={() => { f.value ? editor.chain().focus().setFontFamily(f.value).run() : editor.chain().focus().unsetFontFamily().run(); close() }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </DropdownButton>
              <DropdownButton icon={<AlignVerticalSpaceAround size={14} />} title="Interligne">
                {close => (
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 150 }}>
                    {LINE_HEIGHTS.map(lh => (
                      <button key={lh.value} type="button" style={menuItemStyle}
                        onClick={() => { lh.value ? editor.chain().focus().setLineHeight(lh.value).run() : editor.chain().focus().unsetLineHeight().run(); close() }}>
                        {lh.label}
                      </button>
                    ))}
                  </div>
                )}
              </DropdownButton>

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
              <ToolbarButton title="Insérer un tableau (1 cellule, à agrandir ensuite)" onClick={() => editor.chain().focus().insertTable({ rows: 1, cols: 1, withHeaderRow: false }).run()}><TableIcon size={14} /></ToolbarButton>
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
              {commentSignRow && <span style={{ width: 1, height: 18, background: '#e5e7eb', margin: '0 4px' }} />}
              {commentSignRow}
            </>
          )}
          {readOnly && commentSignRow}

          {(onSave || onDownloadPdf || onDownloadWord) && (
            <>
              <span style={{ width: 1, height: 18, background: '#e5e7eb', margin: '0 4px' }} />
              {onSave && <ToolbarButton title={saving ? 'Enregistrement…' : 'Enregistrer'} onClick={onSave} disabled={saving}><Save size={14} /></ToolbarButton>}
              <DropdownButton icon={<FileText size={14} />} title="Fichier" label="Fichier">
                {close => (
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 180 }}>
                    {onSave && <button type="button" style={menuItemStyle} onClick={() => { onSave(); close() }}><Save size={13} /> Enregistrer</button>}
                    {onDownloadPdf && <button type="button" style={menuItemStyle} onClick={() => { onDownloadPdf(); close() }}><Download size={13} /> Télécharger en PDF</button>}
                    {onDownloadWord && <button type="button" style={menuItemStyle} onClick={() => { onDownloadWord(); close() }}><Download size={13} /> Télécharger en Word</button>}
                  </div>
                )}
              </DropdownButton>
            </>
          )}

          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--abed-muted)', flexShrink: 0, paddingLeft: 8 }}>
            Page {pageInfo.current} / {pageInfo.total}
          </span>
        </div>
      )}
      <div ref={contentWrapRef} className="rte-page-wrap">
        <EditorContent editor={editor} />
      </div>
      <style jsx global>{`
        .rte-page-wrap { border: 1px solid var(--abed-border); border-radius: 10px; overflow: hidden; background: white; }
        .rte-content {
          padding: 16px 20px; min-height: 480px; font-size: 14px; line-height: 1.6; outline: none;
        }
        /* Vrai espace entre deux pages — inséré comme décoration ProseMirror
           (voir tiptap-page-break.ts), pas comme simple décor : le texte ne
           peut plus s'y écrire, contrairement à une bande peinte en fond.
           Le conteneur (.rte-page-break-spacer) a une hauteur variable (la
           place restante sur la page qui se termine) mais reste invisible ;
           seule .rte-page-break-band, à taille FIXE, est visible — donc
           toujours la même d'un saut de page à l'autre. */
        .rte-content .rte-page-break-spacer {
          box-sizing: border-box; user-select: none; pointer-events: none;
        }
        .rte-content .rte-page-break-band {
          margin: 0 -20px; background: #eef1f5;
          border-top: 2px solid #cbd5e1; border-bottom: 2px solid #cbd5e1;
          box-sizing: border-box;
        }
        .rte-content p { margin: 0 0 10px; }
        .rte-content h1, .rte-content h2, .rte-content h3, .rte-content h4, .rte-content h5, .rte-content h6 {
          margin: 20px 0 10px; font-weight: 700; line-height: 1.3; color: #111827;
        }
        .rte-content h1:first-child, .rte-content h2:first-child, .rte-content h3:first-child { margin-top: 0; }
        .rte-content h1 { font-size: 24px; }
        .rte-content h2 { font-size: 19px; }
        .rte-content h3 { font-size: 16px; }
        .rte-content h4, .rte-content h5, .rte-content h6 { font-size: 14px; }
        .rte-content a { color: #2563eb; text-decoration: underline; }
        .rte-content table { border-collapse: collapse; margin: 10px 0; }
        .rte-content .tableWrapper { overflow-x: auto; }
        .rte-content table td, .rte-content table th {
          border: 1px solid #d1d5db; padding: 6px 8px; position: relative; min-width: 60px;
          overflow-wrap: break-word; word-break: break-word; white-space: normal; vertical-align: top;
        }
        .rte-content table th { background: #f0fdf4; font-weight: 700; }
        /* Poignée de redimensionnement des colonnes (prosemirror-tables,
           resizable: true) — invisible sans ce style explicite. */
        .rte-content .column-resize-handle {
          position: absolute; right: -2px; top: 0; bottom: -2px; width: 4px;
          background-color: #16a34a; pointer-events: none;
        }
        .rte-content.resize-cursor { cursor: col-resize; }
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
        .rte-content mark.rte-highlight { border-radius: 2px; padding: 0 1px; }
        .rte-content .doc-signature-stamp { display: block; height: auto; }
        .collaboration-cursor__caret { position: relative; margin-left: -1px; margin-right: -1px; border-left: 1px solid; border-right: 1px solid; word-break: normal; pointer-events: none; }
        .collaboration-cursor__label { position: absolute; top: -1.4em; left: -1px; font-size: 11px; font-weight: 700; line-height: 1; user-select: none; white-space: nowrap; border-radius: 4px 4px 4px 0; padding: 2px 6px; color: white; }
      `}</style>
    </div>
  )
})

export default RichTextEditor
