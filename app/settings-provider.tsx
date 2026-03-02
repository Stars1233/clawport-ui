'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Agent } from '@/lib/types'
import {
  type ManorSettings,
  type AgentOverride,
  loadSettings,
  saveSettings,
  hexToAccentFill,
} from '@/lib/settings'

interface AgentDisplay {
  emoji: string
  profileImage?: string
}

interface SettingsContextValue {
  settings: ManorSettings
  setAccentColor: (color: string | null) => void
  setManorName: (name: string | null) => void
  setManorSubtitle: (subtitle: string | null) => void
  setManorEmoji: (emoji: string | null) => void
  setManorIcon: (icon: string | null) => void
  setAgentOverride: (agentId: string, override: AgentOverride) => void
  clearAgentOverride: (agentId: string) => void
  getAgentDisplay: (agent: Agent) => AgentDisplay
  resetAll: () => void
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: { accentColor: null, manorName: null, manorSubtitle: null, manorEmoji: null, manorIcon: null, agentOverrides: {} },
  setAccentColor: () => {},
  setManorName: () => {},
  setManorSubtitle: () => {},
  setManorEmoji: () => {},
  setManorIcon: () => {},
  setAgentOverride: () => {},
  clearAgentOverride: () => {},
  getAgentDisplay: (agent) => ({ emoji: agent.emoji }),
  resetAll: () => {},
})

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ManorSettings>(() => loadSettings())

  // Apply accent color CSS variables when settings change
  useEffect(() => {
    const el = document.documentElement.style
    if (settings.accentColor) {
      el.setProperty('--accent', settings.accentColor)
      el.setProperty('--accent-fill', hexToAccentFill(settings.accentColor))
    } else {
      el.removeProperty('--accent')
      el.removeProperty('--accent-fill')
    }
  }, [settings.accentColor])

  const update = useCallback((next: ManorSettings) => {
    setSettings(next)
    saveSettings(next)
  }, [])

  const setAccentColor = useCallback(
    (color: string | null) => {
      update({ ...settings, accentColor: color })
    },
    [settings, update],
  )

  const setManorName = useCallback(
    (name: string | null) => {
      update({ ...settings, manorName: name || null })
    },
    [settings, update],
  )

  const setManorSubtitle = useCallback(
    (subtitle: string | null) => {
      update({ ...settings, manorSubtitle: subtitle || null })
    },
    [settings, update],
  )

  const setManorEmoji = useCallback(
    (emoji: string | null) => {
      update({ ...settings, manorEmoji: emoji || null })
    },
    [settings, update],
  )

  const setManorIcon = useCallback(
    (icon: string | null) => {
      update({ ...settings, manorIcon: icon })
    },
    [settings, update],
  )

  const setAgentOverride = useCallback(
    (agentId: string, override: AgentOverride) => {
      const existing = settings.agentOverrides[agentId] || {}
      update({
        ...settings,
        agentOverrides: {
          ...settings.agentOverrides,
          [agentId]: { ...existing, ...override },
        },
      })
    },
    [settings, update],
  )

  const clearAgentOverride = useCallback(
    (agentId: string) => {
      const { [agentId]: _, ...rest } = settings.agentOverrides
      update({ ...settings, agentOverrides: rest })
    },
    [settings, update],
  )

  const getAgentDisplay = useCallback(
    (agent: Agent): AgentDisplay => {
      const override = settings.agentOverrides[agent.id]
      return {
        emoji: override?.emoji || agent.emoji,
        profileImage: override?.profileImage,
      }
    },
    [settings.agentOverrides],
  )

  const resetAll = useCallback(() => {
    const defaults: ManorSettings = {
      accentColor: null,
      manorName: null,
      manorSubtitle: null,
      manorEmoji: null,
      manorIcon: null,
      agentOverrides: {},
    }
    update(defaults)
  }, [update])

  return (
    <SettingsContext.Provider
      value={{
        settings,
        setAccentColor,
        setManorName,
        setManorSubtitle,
        setManorEmoji,
        setManorIcon,
        setAgentOverride,
        clearAgentOverride,
        getAgentDisplay,
        resetAll,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
