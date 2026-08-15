import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import SignatureStampView from '@/components/SignatureStampView'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    signatureStamp: {
      insertSignatureStamp: (attrs: { src: string; signerName: string; signedAt: string }) => ReturnType
    }
  }
}

// Tampon de signature inséré directement dans le texte, au point d'insertion
// choisi par le signataire — pas de verrouillage ni de circuit séparé : le
// tampon fait partie du contenu du document comme n'importe quel autre
// élément (image), sauvegardé via le PATCH habituel de contenu_html.
// draggable: true (+ data-drag-handle côté vue) permet de le déplacer à la
// souris n'importe où dans le document ; la vue React (SignatureStampView)
// ajoute une poignée de redimensionnement au coin quand il est sélectionné.
export const SignatureStampNode = Node.create({
  name: 'signatureStamp',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  // Le déplacement se fait "à la main" (mousedown/mousemove/mouseup dans
  // SignatureStampView), pas via le drag HTML5 natif de ProseMirror : ce
  // dernier s'est avéré peu fiable une fois combiné à la synchronisation
  // Yjs (rien ne se passait au drop).
  draggable: false,
  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('src'),
        renderHTML: (attrs: { src?: string | null }) => (attrs.src ? { src: attrs.src } : {}),
      },
      signerName: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-signer-name'),
        renderHTML: (attrs: { signerName?: string | null }) => (attrs.signerName ? { 'data-signer-name': attrs.signerName } : {}),
      },
      signedAt: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-signed-at'),
        renderHTML: (attrs: { signedAt?: string | null }) => (attrs.signedAt ? { 'data-signed-at': attrs.signedAt } : {}),
      },
      width: {
        default: 200,
        parseHTML: (el: HTMLElement) => {
          const w = el.style.width || el.getAttribute('width')
          return w ? parseInt(w, 10) : null
        },
        renderHTML: (attrs: { width?: number | null }) => (attrs.width ? { style: `width: ${attrs.width}px` } : {}),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'img[data-signature-stamp]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes, { class: 'doc-signature-stamp', 'data-signature-stamp': 'true' })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(SignatureStampView)
  },
  addCommands() {
    return {
      insertSignatureStamp: (attrs: { src: string; signerName: string; signedAt: string }) => ({ commands }: any) =>
        commands.insertContent({ type: this.name, attrs }),
    } as any
  },
})
