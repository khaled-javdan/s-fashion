"use client"

import { Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { Button } from "@workspace/ui/components/button"

/**
 * Shopify-style contextual save bar for the admin.
 *
 * Each editable form calls {@link useSaveBar} with its live `dirty`/`saving`
 * state plus `save`/`discard` callbacks. While any registered form is dirty the
 * {@link AdminSaveBar} overlays the (sticky) admin topbar with Discard / Save
 * buttons, so changes are committed from a single, always-visible spot.
 */

type Registration = {
  dirty: boolean
  saving: boolean
  save: () => void
  discard: () => void
}

type Mutators = {
  set: (id: string, reg: Registration) => void
  remove: (id: string) => void
}

const MutatorsContext = createContext<Mutators | null>(null)
const StateContext = createContext<Record<string, Registration>>({})

export function SaveBarProvider({ children }: { children: React.ReactNode }) {
  const [regs, setRegs] = useState<Record<string, Registration>>({})

  const set = useCallback((id: string, reg: Registration) => {
    setRegs((prev) => {
      const ex = prev[id]
      if (
        ex &&
        ex.dirty === reg.dirty &&
        ex.saving === reg.saving &&
        ex.save === reg.save &&
        ex.discard === reg.discard
      ) {
        return prev
      }
      return { ...prev, [id]: reg }
    })
  }, [])

  const remove = useCallback((id: string) => {
    setRegs((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const mutators = useMemo(() => ({ set, remove }), [set, remove])

  return (
    <MutatorsContext.Provider value={mutators}>
      <StateContext.Provider value={regs}>{children}</StateContext.Provider>
    </MutatorsContext.Provider>
  )
}

/**
 * Register a form with the contextual save bar. `save`/`discard` may close over
 * fresh state on every render — the latest are always invoked, so they don't
 * need to be memoised by the caller.
 */
export function useSaveBar(
  id: string,
  reg: {
    dirty: boolean
    saving: boolean
    save: () => void
    discard: () => void
  },
) {
  const mutators = useContext(MutatorsContext)

  // Keep the newest callbacks in refs so the bar always runs current closures
  // while the registered identities stay stable across renders.
  const saveRef = useRef(reg.save)
  const discardRef = useRef(reg.discard)
  useEffect(() => {
    saveRef.current = reg.save
    discardRef.current = reg.discard
  })

  const save = useCallback(() => saveRef.current(), [])
  const discard = useCallback(() => discardRef.current(), [])

  useEffect(() => {
    mutators?.set(id, { dirty: reg.dirty, saving: reg.saving, save, discard })
  }, [mutators, id, reg.dirty, reg.saving, save, discard])

  useEffect(() => {
    return () => mutators?.remove(id)
  }, [mutators, id])
}

/** Aggregated status of every registered form, for the topbar to consume. */
export function useSaveBarState() {
  const regs = useContext(StateContext)
  const list = Object.values(regs)
  return {
    dirty: list.some((r) => r.dirty),
    saving: list.some((r) => r.saving),
    saveAll: () => list.forEach((r) => r.dirty && r.save()),
    discardAll: () => list.forEach((r) => r.dirty && r.discard()),
  }
}

/**
 * Inline save-bar content. Rendered by the topbar (which hides its normal nav
 * and switches to a dark bar) whenever there are unsaved changes.
 */
export function AdminSaveBar() {
  const { saving, saveAll, discardAll } = useSaveBarState()
  const t = useTranslations("admin.common")

  return (
    <>
      <span className="text-sm font-medium">{t("save_bar.unsaved")}</span>
      <div className="ms-auto flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={discardAll}
          disabled={saving}
          className="text-background hover:bg-background/15 hover:text-background"
        >
          {t("save_bar.discard")}
        </Button>
        <Button type="button" size="sm" onClick={saveAll} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("save_bar.save")}
        </Button>
      </div>
    </>
  )
}
