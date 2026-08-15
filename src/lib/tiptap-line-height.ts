import { Extension } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lineHeight: {
      setLineHeight: (value: string) => ReturnType
      unsetLineHeight: () => ReturnType
    }
  }
}

// Interligne par paragraphe — attribut global (pas de nouveau nœud), même
// esprit que TextAlign (déjà limité aux paragraphes dans ce même fichier
// d'extensions).
export const LineHeight = Extension.create({
  name: 'lineHeight',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.lineHeight || null,
            renderHTML: (attrs: { lineHeight?: string | null }) => (attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {}),
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setLineHeight: (value: string) => ({ commands }: any) => commands.updateAttributes('paragraph', { lineHeight: value }),
      unsetLineHeight: () => ({ commands }: any) => commands.resetAttributes('paragraph', 'lineHeight'),
    } as any
  },
})
