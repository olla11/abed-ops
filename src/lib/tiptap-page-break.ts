import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { HAUTEUR_CONTENU_PX_DEFAUT } from './docx-page-setup'

// Hauteur de page par défaut (A4, marges 1 pouce) — voir docx-page-setup.ts.
// Une instance peut la remplacer via `.configure({ pageHeightPx })` avec la
// vraie mise en page extraite du .docx importé, pour coller à la pagination
// du document d'origine plutôt qu'à une page générique.
export const PAGE_HEIGHT_PX = HAUTEUR_CONTENU_PX_DEFAUT
// Épaisseur de la bande visible entre deux pages — TOUJOURS cette même
// valeur, quel que soit le report nécessaire (voir plus bas) : c'est ce qui
// rend les séparateurs visuellement identiques d'un saut de page à l'autre.
export const PAGE_GAP_PX = 36
export const PAGE_CYCLE_PX = PAGE_HEIGHT_PX + PAGE_GAP_PX
// Un bloc qu'on pousserait à la page suivante peut laisser un vide énorme en
// bas de la page courante s'il ne restait presque plus de place quand on l'a
// rencontré (ex : un grand tableau qui arrive tôt sur une page presque
// vide) — au lieu d'un petit espace propre entre deux pages, on se retrouve
// avec un bloc géant et vide, ce qui donne des pages de tailles très
// inégales. Passé ce plafond, on renonce à pousser : le bloc démarre sur la
// page courante (qui devient exceptionnellement plus haute que la normale),
// pour garder des sauts de page réguliers plutôt que viser un
// respect strict de la limite d'une page.
const MAX_GAP_PX = PAGE_GAP_PX * 3

const pageBreakKey = new PluginKey<PageBreakPluginState>('pageBreak')

type PageBreakPluginState = { breaks: { pos: number; height: number }[]; total: number }

// Pourquoi une extension ProseMirror plutôt qu'un simple style appliqué
// depuis un useEffect React (première tentative, abandonnée) : ProseMirror
// possède son propre MutationObserver interne (DOMObserver) qui surveille en
// permanence le DOM qu'il gère, et annule/écrase toute modification qui n'est
// pas passée par son propre système de transactions — dont un `style.marginTop`
// posé de l'extérieur. Résultat observé : le style était bien appliqué un
// instant, puis systématiquement effacé quelques millisecondes plus tard,
// sans jamais déclencher le moindre re-rendu détectable côté React. Une
// décoration ProseMirror (Decoration.widget), elle, fait partie du rendu que
// ProseMirror produit lui-même — elle survit donc à ses propres cycles de
// réconciliation.
export const PageBreak = Extension.create<{ onPageInfo?: (info: { total: number }) => void; pageHeightPx?: number }>({
  name: 'pageBreak',
  addOptions() {
    return { onPageInfo: undefined, pageHeightPx: undefined }
  },
  addProseMirrorPlugins() {
    const options = this.options
    const pageHeightPx = options.pageHeightPx ?? PAGE_HEIGHT_PX
    return [
      new Plugin<PageBreakPluginState>({
        key: pageBreakKey,
        state: {
          init: () => ({ breaks: [], total: 1 }),
          apply(tr, value) {
            const meta = tr.getMeta(pageBreakKey) as PageBreakPluginState | undefined
            if (meta) return meta
            if (!tr.docChanged) return value
            // Remappe les positions à travers la transaction (comme le ferait
            // un DecorationSet.map) plutôt que de tout vider : les sauts de
            // page restent affichés, à la bonne position, pendant que la
            // mesure suivante (déclenchée par la vue juste après) vérifie si
            // les hauteurs ont réellement besoin de changer. Les vider à
            // chaque frappe faisait disparaître puis réapparaître chaque
            // séparateur à chaque caractère tapé — d'où l'effet de
            // "vibration" pendant la saisie.
            return { total: value.total, breaks: value.breaks.map(b => ({ ...b, pos: tr.mapping.map(b.pos) })) }
          },
        },
        props: {
          decorations(state) {
            const { breaks } = pageBreakKey.getState(state) as PageBreakPluginState
            if (!breaks.length) return null
            const decos = breaks.map(({ pos, height }) =>
              Decoration.widget(
                pos,
                () => {
                  // Deux zones dans le même report : un remplissage invisible
                  // (la place restante sur la page qui se termine, variable)
                  // + une bande visible de taille FIXE (PAGE_GAP_PX) tout en
                  // bas. Résultat : la bande qu'on voit est toujours la même
                  // taille d'un saut de page à l'autre, même quand le report
                  // total varie selon le contenu.
                  const bandeHauteur = Math.min(height, PAGE_GAP_PX)
                  const remplissageHauteur = Math.max(0, height - PAGE_GAP_PX)
                  const outer = document.createElement('div')
                  outer.className = 'rte-page-break-spacer'
                  outer.style.height = `${height}px`
                  outer.contentEditable = 'false'
                  if (remplissageHauteur > 0) {
                    const remplissage = document.createElement('div')
                    remplissage.style.height = `${remplissageHauteur}px`
                    outer.appendChild(remplissage)
                  }
                  const bande = document.createElement('div')
                  bande.className = 'rte-page-break-band'
                  bande.style.height = `${bandeHauteur}px`
                  outer.appendChild(bande)
                  return outer
                },
                { side: -1, key: `pb-${pos}` }
              )
            )
            return DecorationSet.create(state.doc, decos)
          },
        },
        view(editorView) {
          let frame = 0

          function mesurer() {
            const dom = editorView.dom as HTMLElement
            if (!dom.isConnected) return
            const domRect = dom.getBoundingClientRect()
            const doc = editorView.state.doc

            let pageStart = 0
            let prevBottomEdge = 0
            let total = 1
            let first = true
            const breaks: { pos: number; height: number }[] = []

            doc.forEach((node, offset) => {
              const nodeDom = editorView.nodeDOM(offset)
              if (!(nodeDom instanceof HTMLElement)) { first = false; return }
              const r = nodeDom.getBoundingClientRect()
              let top = r.top - domRect.top
              const h = nodeDom.offsetHeight
              if (!first && top + h - pageStart > pageHeightPx) {
                const cible = pageStart + pageHeightPx + PAGE_GAP_PX
                // +2px de marge de sécurité : deux éléments DOM voisins peuvent
                // arrondir leurs rectangles à des sous-pixels légèrement
                // différents malgré un contact visuel parfait — sans cette
                // marge, un test au pixel près peut détecter un chevauchement
                // theoretical de quelques centièmes de pixel, invisible à
                // l'œil mais qu'autant éviter.
                const height = Math.max(1, Math.round(cible - prevBottomEdge) + 2)
                if (height <= MAX_GAP_PX) {
                  breaks.push({ pos: offset, height })
                  top = prevBottomEdge + height
                  pageStart = cible
                  total += 1
                } else {
                  // On renonce au report (voir le commentaire sur MAX_GAP_PX) :
                  // le bloc reste sur la page courante, qui devient
                  // exceptionnellement plus haute que pageHeightPx cette
                  // fois. `pageStart` doit être réancré à la fin de CE bloc,
                  // sinon les prochains blocs continuent de se mesurer contre
                  // l'ancien repère (déjà dépassé) et déclenchent des sauts
                  // de hauteur absurde (négative, arrondie à 1px).
                  pageStart = top + h
                }
              }
              prevBottomEdge = top + h
              first = false
            })

            const current = pageBreakKey.getState(editorView.state) as PageBreakPluginState
            const changed =
              current.total !== total ||
              current.breaks.length !== breaks.length ||
              current.breaks.some((b, i) => b.pos !== breaks[i]?.pos || b.height !== breaks[i]?.height)
            if (changed) {
              editorView.dispatch(editorView.state.tr.setMeta(pageBreakKey, { breaks, total }))
            }
            options.onPageInfo?.({ total })
          }

          function planifier() {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(mesurer)
          }

          planifier()
          const ro = new ResizeObserver(planifier)
          ro.observe(editorView.dom)
          window.addEventListener('resize', planifier)

          return {
            update: planifier,
            destroy() {
              cancelAnimationFrame(frame)
              ro.disconnect()
              window.removeEventListener('resize', planifier)
            },
          }
        },
      }),
    ]
  },
})
