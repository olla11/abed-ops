import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { ResizableImage } from './tiptap-resizable-image'
import TextAlign from '@tiptap/extension-text-align'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { CommentMark } from './tiptap-comment-mark'
import { HighlightMark } from './tiptap-highlight-mark'
import { SignatureStampNode } from './tiptap-signature-stamp'
import { TextColorMark } from './tiptap-text-color-mark'
import { FontFamilyMark } from './tiptap-font-family-mark'
import { LineHeight } from './tiptap-line-height'

// Liste de base des extensions TipTap (hors Collaboration/CollaborationCursor,
// qui ne changent pas le schéma). Partagée entre l'éditeur et la logique
// d'amorçage Yjs (conversion HTML -> Y.XmlFragment), pour être certain que
// le même schéma est utilisé des deux côtés.
export function baseTdrExtensions(disableHistory: boolean) {
  return [
    StarterKit.configure(disableHistory ? { history: false } : {}),
    Underline,
    Link.configure({ openOnClick: false, autolink: true }),
    // allowBase64 : mammoth (import Word) embarque les images en data URI,
    // sans passer par un upload/stockage séparé.
    ResizableImage.configure({ allowBase64: true }),
    TextAlign.configure({ types: ['paragraph', 'heading'] }),
    // resizable: redimensionnement des colonnes à la souris (poignée sur la
    // bordure) — fourni nativement par prosemirror-tables, juste désactivé
    // avant. Le déplacement de lignes/colonnes par glisser-déposer, lui,
    // n'existe pas côté prosemirror-tables et resterait un chantier à part.
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    CommentMark,
    HighlightMark,
    SignatureStampNode,
    TextColorMark,
    FontFamilyMark,
    LineHeight,
  ]
}
