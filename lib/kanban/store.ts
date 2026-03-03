'use client'

import type { KanbanTicket, TicketStatus } from './types'

export type KanbanStore = Record<string, KanbanTicket>

const STORAGE_KEY = 'clawport-kanban'

export function loadTickets(): KanbanStore {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const store: KanbanStore = JSON.parse(raw)
    // Backfill work state fields for existing tickets
    for (const id of Object.keys(store)) {
      store[id] = {
        ...store[id],
        workState: store[id].workState ?? 'idle',
        workStartedAt: store[id].workStartedAt ?? null,
        workError: store[id].workError ?? null,
        workResult: store[id].workResult ?? null,
      }
    }
    return store
  } catch {
    return {}
  }
}

export function saveTickets(store: KanbanStore): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {}
}

export function createTicket(
  store: KanbanStore,
  ticket: Omit<KanbanTicket, 'id' | 'createdAt' | 'updatedAt' | 'workState' | 'workStartedAt' | 'workError' | 'workResult'> & {
    workState?: KanbanTicket['workState']
    workStartedAt?: KanbanTicket['workStartedAt']
    workError?: KanbanTicket['workError']
    workResult?: KanbanTicket['workResult']
  },
): KanbanStore {
  const id = crypto.randomUUID()
  const now = Date.now()
  return {
    ...store,
    [id]: {
      ...ticket,
      id,
      workState: ticket.workState ?? 'idle',
      workStartedAt: ticket.workStartedAt ?? null,
      workError: ticket.workError ?? null,
      workResult: ticket.workResult ?? null,
      createdAt: now,
      updatedAt: now,
    },
  }
}

export function updateTicket(
  store: KanbanStore,
  id: string,
  updates: Partial<Omit<KanbanTicket, 'id' | 'createdAt'>>,
): KanbanStore {
  const existing = store[id]
  if (!existing) return store
  return {
    ...store,
    [id]: { ...existing, ...updates, updatedAt: Date.now() },
  }
}

export function moveTicket(
  store: KanbanStore,
  id: string,
  status: TicketStatus,
): KanbanStore {
  return updateTicket(store, id, { status })
}

export function deleteTicket(store: KanbanStore, id: string): KanbanStore {
  const next = { ...store }
  delete next[id]
  return next
}

export function getTicketsByStatus(
  store: KanbanStore,
  status: TicketStatus,
): KanbanTicket[] {
  return Object.values(store)
    .filter((t) => t.status === status)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}
