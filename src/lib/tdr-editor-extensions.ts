import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { CommentMark } from './tiptap-comment-mark'

// Liste de base des extensions TipTap (hors Collaboration/CollaborationCursor,
// qui ne changent pas le schéma). Partagée entre l'éditeur et la logique
// d'amorçage Yjs (conversion HTML -> Y.XmlFragment), pour être certain que
// le même schéma est utilisé des deux côtés.
export function baseTdrExtensions(disableHistory: boolean) {
  return [
    StarterKit.configure(disableHistory ? { history: false } : {}),
    Underline,
    Link.configure({ openOnClick: false, autolink: true }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    CommentMark,
  ]
}
