import { Mark, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontFamily: {
      setFontFamily: (font: string) => ReturnType
      unsetFontFamily: () => ReturnType
    }
  }
}

// Police de caractères — mark léger sans dépendance externe, même pattern
// que les autres marks maison de ce fichier.
export const FontFamilyMark = Mark.create({
  name: 'fontFamily',
  addAttributes() {
    return {
      font: {
        default: null,
        parseHTML: (el: HTMLElement) => el.style.fontFamily || null,
        renderHTML: (attrs: { font?: string | null }) => (attrs.font ? { style: `font-family: ${attrs.font}` } : {}),
      },
    }
  },
  parseHTML() {
    return [{ style: 'font-family' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0]
  },
  addCommands() {
    return {
      setFontFamily: (font: string) => ({ commands }: any) => commands.setMark(this.name, { font }),
      unsetFontFamily: () => ({ commands }: any) => commands.unsetMark(this.name),
    } as any
  },
})
