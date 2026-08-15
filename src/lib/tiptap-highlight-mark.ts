import { Mark, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    highlight: {
      setHighlight: (color: string) => ReturnType
      unsetHighlight: () => ReturnType
    }
  }
}

// Surlignage façon stabilo, avec choix de couleur — mark léger sans
// dépendance externe, même pattern que CommentMark. Distinct visuellement du
// surlignage jaune pâle utilisé pour les passages commentés (voir
// .rte-highlight vs [data-comment-id] dans RichTextEditor).
export const HighlightMark = Mark.create({
  name: 'highlight',
  addAttributes() {
    return {
      color: {
        default: '#fde047',
        parseHTML: (el: HTMLElement) => el.style.backgroundColor || el.getAttribute('data-color') || '#fde047',
        renderHTML: (attrs: { color?: string }) => ({ style: `background-color: ${attrs.color ?? '#fde047'}`, 'data-color': attrs.color ?? '#fde047' }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'mark' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['mark', mergeAttributes(HTMLAttributes, { class: 'rte-highlight' }), 0]
  },
  addCommands() {
    return {
      setHighlight: (color: string) => ({ commands }: any) => commands.setMark(this.name, { color }),
      unsetHighlight: () => ({ commands }: any) => commands.unsetMark(this.name),
    } as any
  },
})
