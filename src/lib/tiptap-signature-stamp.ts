import { Node, mergeAttributes } from '@tiptap/core'

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
export const SignatureStampNode = Node.create({
  name: 'signatureStamp',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
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
    }
  },
  parseHTML() {
    return [{ tag: 'img[data-signature-stamp]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes, { class: 'doc-signature-stamp', 'data-signature-stamp': 'true' })]
  },
  addCommands() {
    return {
      insertSignatureStamp: (attrs: { src: string; signerName: string; signedAt: string }) => ({ commands }: any) =>
        commands.insertContent({ type: this.name, attrs }),
    } as any
  },
})
