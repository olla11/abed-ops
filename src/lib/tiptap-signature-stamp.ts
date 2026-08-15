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
//
// Déplacement : PAS via un repositionnement dans le flux du document (le
// drag HTML5 natif de ProseMirror résout la position de dépôt au caractère
// près — un déplacement horizontal de quelques pixels dans un paragraphe
// par ailleurs vide retombe donc souvent exactement sur la position de
// départ, ce qui donnait l'impression que "rien ne bougeait"). Le tampon
// garde sa position d'ancrage dans le texte, et se décale visuellement à la
// souris via un simple `transform: translate()` (offset ci-dessous) — un
// vrai déplacement libre en pixels, découplé du modèle de document.
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
      width: {
        default: 200,
        parseHTML: (el: HTMLElement) => {
          const w = el.style.width || el.getAttribute('width')
          return w ? parseInt(w, 10) : null
        },
        renderHTML: (attrs: { width?: number | null; offset?: { x: number; y: number } }) => {
          const styles: string[] = []
          if (attrs.width) styles.push(`width: ${attrs.width}px`)
          if (attrs.offset && (attrs.offset.x || attrs.offset.y)) styles.push(`transform: translate(${attrs.offset.x}px, ${attrs.offset.y}px)`)
          return styles.length ? { style: styles.join('; ') } : {}
        },
      },
      // Décalage visuel libre (voir commentaire au-dessus du nœud) — combiné
      // à `width` dans un seul style rendu, deux attributs distincts ne
      // pouvant pas fusionner proprement le même attribut HTML `style`.
      offset: {
        default: { x: 0, y: 0 },
        parseHTML: (el: HTMLElement) => {
          const m = el.style.transform?.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
          return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 }
        },
        renderHTML: () => ({}),
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
