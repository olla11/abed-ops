'use client'
import * as Y from 'yjs'
import { getSchema } from '@tiptap/core'
import { DOMParser as PMDOMParser } from '@tiptap/pm/model'
import { prosemirrorToYXmlFragment } from 'y-prosemirror'
import { baseTdrExtensions } from './tdr-editor-extensions'

// Amorce un Y.XmlFragment vide à partir du HTML déjà enregistré en base —
// nécessaire la première fois qu'un TDR passe en édition collaborative,
// pour ne pas perdre le contenu existant. N'a d'effet que si le fragment
// est encore vide (ne doit être appelé qu'une seule fois par salon).
export function amorcerFragmentDepuisHtml(doc: Y.Doc, fragmentName: string, html: string) {
  const fragment = doc.getXmlFragment(fragmentName)
  if (fragment.length > 0) return // déjà du contenu (amorcé par quelqu'un d'autre, ou déjà édité)
  if (!html || html === '<p></p>') return

  const schema = getSchema(baseTdrExtensions(false))
  const el = document.createElement('div')
  el.innerHTML = html
  const pmNode = PMDOMParser.fromSchema(schema).parse(el)
  prosemirrorToYXmlFragment(pmNode, fragment)
}
