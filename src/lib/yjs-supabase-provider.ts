'use client'
// Fournisseur Yjs "maison" basé sur les canaux Broadcast de Supabase Realtime
// (pas de serveur websocket dédié à héberger — on réutilise l'infra Supabase
// déjà en place). Implémente le protocole de sync standard de Yjs
// (y-protocols/sync + awareness), comme le font y-websocket / y-webrtc en
// interne, mais avec Supabase comme transport.
import * as Y from 'yjs'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as syncProtocol from 'y-protocols/sync'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

const MESSAGE_SYNC = 0
const MESSAGE_AWARENESS = 1

export type CollabUser = { id: string; name: string; color: string }

export class SupabaseYjsProvider {
  doc: Y.Doc
  awareness: awarenessProtocol.Awareness
  channel: RealtimeChannel
  private destroyed = false

  constructor(supabase: SupabaseClient, room: string, doc: Y.Doc, user: CollabUser) {
    this.doc = doc
    this.awareness = new awarenessProtocol.Awareness(doc)
    this.awareness.setLocalStateField('user', user)

    this.channel = supabase.channel(`tdr-collab-${room}`, { config: { broadcast: { self: false } } })

    this.channel.on('broadcast', { event: 'yjs' }, ({ payload }: { payload: { data: number[] } }) => {
      if (this.destroyed) return
      const message = new Uint8Array(payload.data)
      const decoder = decoding.createDecoder(message)
      const messageType = decoding.readVarUint(decoder)

      if (messageType === MESSAGE_SYNC) {
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, MESSAGE_SYNC)
        syncProtocol.readSyncMessage(decoder, encoder, this.doc, this)
        if (encoding.length(encoder) > 1) this.send(encoding.toUint8Array(encoder))
      } else if (messageType === MESSAGE_AWARENESS) {
        awarenessProtocol.applyAwarenessUpdate(this.awareness, decoding.readVarUint8Array(decoder), this)
      }
    })

    doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === this || this.destroyed) return
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, MESSAGE_SYNC)
      syncProtocol.writeUpdate(encoder, update)
      this.send(encoding.toUint8Array(encoder))
    })

    this.awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
      if (this.destroyed) return
      const changed = added.concat(updated).concat(removed)
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS)
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed))
      this.send(encoding.toUint8Array(encoder))
    })

    this.channel.subscribe(status => {
      if (status === 'SUBSCRIBED' && !this.destroyed) {
        // On s'annonce : on envoie notre état pour que les pairs déjà
        // connectés nous renvoient ce qu'on n'a pas encore.
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, MESSAGE_SYNC)
        syncProtocol.writeSyncStep1(encoder, this.doc)
        this.send(encoding.toUint8Array(encoder))
      }
    })
  }

  private send(data: Uint8Array) {
    this.channel.send({ type: 'broadcast', event: 'yjs', payload: { data: Array.from(data) } })
  }

  destroy() {
    this.destroyed = true
    awarenessProtocol.removeAwarenessStates(this.awareness, [this.doc.clientID], 'destroy')
    this.channel.unsubscribe()
  }
}

const PALETTE = ['#dc2626', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#ea580c', '#4f46e5']

export function couleurPourUser(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]
}
