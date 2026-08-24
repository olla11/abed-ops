import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer } from '@tiptap/react'
import ResizableImageView from '@/components/ResizableImageView'

// Étend l'extension Image officielle avec un attribut `width` (persisté en
// style inline, lu/écrit par la poignée de redimensionnement de
// ResizableImageView) et une NodeView React pour l'interaction — sinon
// identique à Image (mêmes règles de parsing HTML, donc toujours compatible
// avec les <img> produits par mammoth lors de l'import Word).
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const w = el.style.width || el.getAttribute('width')
          return w ? parseInt(w, 10) : null
        },
        renderHTML: (attrs: { width?: number | null }) => (attrs.width ? { style: `width: ${attrs.width}px` } : {}),
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView)
  },
})
