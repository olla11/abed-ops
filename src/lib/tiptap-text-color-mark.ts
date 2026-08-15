import { Mark, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textColor: {
      setTextColor: (color: string) => ReturnType
      unsetTextColor: () => ReturnType
    }
  }
}

// Couleur du texte — mark léger sans dépendance externe (pas de
// @tiptap/extension-color ni extension-text-style), même pattern que les
// autres marks maison de ce fichier.
export const TextColorMark = Mark.create({
  name: 'textColor',
  addAttributes() {
    return {
      color: {
        default: '#111827',
        parseHTML: (el: HTMLElement) => el.style.color || '#111827',
        renderHTML: (attrs: { color?: string }) => ({ style: `color: ${attrs.color ?? '#111827'}` }),
      },
    }
  },
  parseHTML() {
    return [{ style: 'color' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0]
  },
  addCommands() {
    return {
      setTextColor: (color: string) => ({ commands }: any) => commands.setMark(this.name, { color }),
      unsetTextColor: () => ({ commands }: any) => commands.unsetMark(this.name),
    } as any
  },
})
