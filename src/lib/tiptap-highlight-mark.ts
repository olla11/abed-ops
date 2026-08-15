import { Mark, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    highlight: {
      toggleHighlight: () => ReturnType
    }
  }
}

// Surlignage simple (comme un stabilo) — mark léger sans dépendance externe,
// même pattern que CommentMark. Distinct visuellement du surlignage jaune
// pâle utilisé pour les passages commentés (voir .rte-highlight vs
// [data-comment-id] dans RichTextEditor).
export const HighlightMark = Mark.create({
  name: 'highlight',
  parseHTML() {
    return [{ tag: 'mark' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['mark', mergeAttributes(HTMLAttributes, { class: 'rte-highlight' }), 0]
  },
  addCommands() {
    return {
      toggleHighlight: () => ({ commands }: any) => commands.toggleMark(this.name),
    } as any
  },
})
