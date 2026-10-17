import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProjectSnapshot } from '@himcm/shared'
import { api } from '../api.ts'
import { lastPaperDirectory, rememberPaperDirectory } from '../paperDirectories.ts'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict'

const SAVE_DEBOUNCE_MS = 800

export function useProject() {
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  /** 各章节最新 md（含未保存的本地编辑） */
  const mdRef = useRef(new Map<string, string>())
  /** 各章节磁盘基准哈希（乐观并发检测） */
  const hashRef = useRef(new Map<string, string>())
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({})
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  // saveStates 的 ref 镜像（回调中读取最新值）
  const saveStatesRef = useRef(saveStates)
  saveStatesRef.current = saveStates

  const reload = useCallback(async () => {
    try {
      const snap = await api.project()
      rememberPaperDirectory(snap.paperDir)
      for (const s of snap.sections) {
        // 不覆盖有未保存编辑的章节
        const state = saveStatesRef.current[s.id]
        if (state !== 'dirty' && state !== 'saving' && state !== 'conflict') {
          mdRef.current.set(s.id, s.md)
          hashRef.current.set(s.id, s.hash)
        }
      }
      setSnapshot(snap)
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const state = await api.papers()
        const last = lastPaperDirectory()
        // Explicit server --paper takes priority; only restore into an idle server.
        if (!state.current && last && !cancelled) await api.openPaper(last)
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err))
      }
      if (!cancelled) await reload()
    })()
    return () => { cancelled = true }
  }, [reload])

  const setSaveState = useCallback((id: string, state: SaveState) => {
    setSaveStates((prev) => (prev[id] === state ? prev : { ...prev, [id]: state }))
  }, [])

  const flushSection = useCallback(
    async (id: string, force = false) => {
      const timer = timersRef.current.get(id)
      if (timer) {
        clearTimeout(timer)
        timersRef.current.delete(id)
      }
      const md = mdRef.current.get(id)
      if (md === undefined) return
      setSaveState(id, 'saving')
      try {
        const { section } = await api.saveSection(id, md, hashRef.current.get(id), force)
        hashRef.current.set(id, section.hash)
        // 若保存期间又有编辑则保持 dirty
        if (mdRef.current.get(id) === md) {
          setSaveState(id, 'saved')
          setSnapshot((prev) =>
            prev
              ? { ...prev, sections: prev.sections.map((s) => (s.id === id ? { ...section, md: mdRef.current.get(id) ?? section.md } : s)) }
              : prev
          )
        } else {
          setSaveState(id, 'dirty')
        }
      } catch (err) {
        // 409：他人已改动磁盘内容 → 交给 UI 决定加载最新还是强制覆盖
        if (err instanceof Error && err.message.includes('已被他人修改')) setSaveState(id, 'conflict')
        else setSaveState(id, 'error')
      }
    },
    [setSaveState]
  )

  /** 编辑器每次更新调用：记录本地 md 并安排防抖保存 */
  const updateSection = useCallback(
    (id: string, md: string) => {
      if (mdRef.current.get(id) === md) return
      mdRef.current.set(id, md)
      setSaveState(id, 'dirty')
      const prev = timersRef.current.get(id)
      if (prev) clearTimeout(prev)
      timersRef.current.set(
        id,
        setTimeout(() => void flushSection(id), SAVE_DEBOUNCE_MS)
      )
    },
    [flushSection, setSaveState]
  )

  /** 关闭页面前尽力保存未落盘的章节 */
  useEffect(() => {
    const onBeforeUnload = () => {
      for (const [id, timer] of timersRef.current) {
        clearTimeout(timer)
        const md = mdRef.current.get(id)
        if (md === undefined) continue
        void fetch(`/api/sections/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ md }),
          keepalive: true,
        })
      }
      timersRef.current.clear()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const getMd = useCallback((id: string): string => mdRef.current.get(id) ?? '', [])

  /** 全部章节的最新 md（含未保存编辑），供实时编号计算 */
  const getAllMd = useCallback((): Map<string, string> => new Map(mdRef.current), [])

  /** 丢弃某章节的待保存编辑（git 恢复版本前调用，防止 debounce 把旧内容写回） */
  const discardPending = useCallback(
    (id: string) => {
      const timer = timersRef.current.get(id)
      if (timer) {
        clearTimeout(timer)
        timersRef.current.delete(id)
      }
      setSaveState(id, 'saved')
    },
    [setSaveState]
  )

  // 窗口重获焦点时刷新（多人经局域网共用一个 server 时看到队友的更新）
  useEffect(() => {
    const onFocus = () => void reload()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [reload])

  /** 处理保存冲突：加载服务器最新内容（丢弃本地）或强制覆盖 */
  const resolveConflict = useCallback(
    async (id: string, action: 'reload' | 'overwrite') => {
      if (action === 'overwrite') {
        await flushSection(id, true)
        return
      }
      const snap = await api.project()
      const section = snap.sections.find((s) => s.id === id)
      if (section) {
        mdRef.current.set(id, section.md)
        hashRef.current.set(id, section.hash)
      }
      setSaveState(id, 'saved')
      setSnapshot(snap)
    },
    [flushSection, setSaveState]
  )

  return {
    snapshot,
    loadError,
    reload,
    updateSection,
    flushSection,
    discardPending,
    resolveConflict,
    getMd,
    getAllMd,
    saveStates,
  }
}
