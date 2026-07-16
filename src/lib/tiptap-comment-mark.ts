import { Mark, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    comment: {
      setComment: (commentId: string) => ReturnType
      unsetComment: () => ReturnType
    }
  }
}

// Marque légère qui entoure une sélection commentée (comme Word/Google Docs).
// Le texte du commentaire lui-même est stocké à part (table tdr_commentaires) ;
// cette marque ne fait que relier une portion de texte à un commentId.
export const CommentMark = Mark.create({
  name: 'comment',
  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-comment-id'),
        renderHTML: (attrs: { commentId?: string | null }) =>
          attrs.commentId ? { 'data-comment-id': attrs.commentId } : {},
      },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'tdr-comment-highlight' }), 0]
  },
  addCommands() {
    return {
      setComment: (commentId: string) => ({ commands }: any) => commands.setMark(this.name, { commentId }),
      unsetComment: () => ({ commands }: any) => commands.unsetMark(this.name),
    } as any
  },
})
