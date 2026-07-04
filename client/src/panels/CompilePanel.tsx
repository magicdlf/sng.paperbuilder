import { useCallback, useEffect, useState } from 'react'
import type { CompileResult, PaperManifest, ProjectSnapshot } from '@himcm/shared'
import { api } from '../api.ts'

interface CompilePanelProps {
  snapshot: ProjectSnapshot
  /** 递增即触发一次编译（页首「编译」按钮） */
  compileRequestId: number
  onManifestChanged: () => void
  onJumpToSection: (id: string) => void
}

export function CompilePanel({ snapshot, compileRequestId, onManifestChanged, onJumpToSection }: CompilePanelProps) {
  const m = snapshot.manifest
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<CompileResult | null>(null)
  const [texInfo, setTexInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pdfStamp, setPdfStamp] = useState(0)

  const patch = useCallback(
    async (fields: Record<string, unknown>) => {
      try {
        setError(null)
        await api.patchProject(fields)
        onManifestChanged()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [onManifestChanged]
  )

  const compile = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    setTexInfo(null)
    try {
      const res = await api.compile()
      setResult(res)
      if (res.pdfAvailable) setPdfStamp(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [busy])

  const exportTex = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.exportTex()
      setTexInfo(res.texPath)
      setResult(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [busy])

  useEffect(() => {
    if (compileRequestId > 0) void compile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compileRequestId])

  const sectionTitle = (id: string | null): string => {
    if (!id) return '（导言/模板）'
    return snapshot.sections.find((s) => s.id === id)?.title ?? id
  }

  return (
    <div className="compile-panel">
      <MetaForm manifest={m} onPatch={patch} />

      <div className="compile-actions">
        <button type="button" className="btn primary" disabled={busy} onClick={() => void compile()}>
          {busy ? '编译中…' : '编译 PDF'}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => void exportTex()}>
          导出 .tex
        </button>
      </div>

      {error && <div className="compile-error-box">{error}</div>}
      {texInfo && (
        <div className="compile-note">
          已导出：<code>{texInfo}</code>
          <br />
          build/ 目录自包含（含图片），可直接压缩上传 Overleaf。
        </div>
      )}

      {result && (
        <div className="compile-result">
          <div className={`compile-status ${result.ok ? 'ok' : 'fail'}`}>
            {result.ok ? '✓ 编译成功' : '✗ 编译失败'}
            <span className="dim"> · {(result.durationMs / 1000).toFixed(1)}s</span>
          </div>

          {result.pagesCounted !== null && (
            <div
              className={`page-badge ${
                result.pagesCounted > 25 ? 'over' : result.pagesCounted >= 24 ? 'near' : ''
              }`}
            >
              计入页数 {result.pagesCounted} / 25
              {result.pagesTotal !== null && result.pagesTotal !== result.pagesCounted && (
                <span className="dim">（PDF 共 {result.pagesTotal} 页，AI 报告不计）</span>
              )}
              {!result.pagesVerified && <span className="dim">（未经 pdfinfo 交叉验证）</span>}
            </div>
          )}

          {result.errors.length > 0 && (
            <ul className="issue-list errors">
              {result.errors.map((e, i) => (
                <li key={i}>
                  {e.sectionId ? (
                    <button type="button" className="link-btn" onClick={() => onJumpToSection(e.sectionId!)}>
                      {sectionTitle(e.sectionId)}
                    </button>
                  ) : (
                    <span>{sectionTitle(e.sectionId)}</span>
                  )}
                  ：{e.message}
                </li>
              ))}
            </ul>
          )}

          {result.warnings.length > 0 && (
            <ul className="issue-list warnings">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}

          {result.pdfAvailable && (
            <iframe className="pdf-frame" title="PDF 预览" src={`/pdf#${pdfStamp}`} />
          )}
        </div>
      )}
    </div>
  )
}

function MetaForm({
  manifest,
  onPatch,
}: {
  manifest: PaperManifest
  onPatch: (fields: Record<string, unknown>) => Promise<void>
}) {
  const [team, setTeam] = useState(manifest.teamControlNumber)
  const [problem, setProblem] = useState(manifest.problem)
  const [year, setYear] = useState(String(manifest.year))

  useEffect(() => {
    setTeam(manifest.teamControlNumber)
    setProblem(manifest.problem)
    setYear(String(manifest.year))
  }, [manifest])

  return (
    <div className="meta-form">
      <label>
        <span>队伍控制码</span>
        <input
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          onBlur={() => team !== manifest.teamControlNumber && void onPatch({ teamControlNumber: team })}
        />
      </label>
      <div className="meta-row">
        <label>
          <span>题目</span>
          <input
            value={problem}
            maxLength={1}
            onChange={(e) => setProblem(e.target.value.toUpperCase())}
            onBlur={() => problem !== manifest.problem && void onPatch({ problem })}
          />
        </label>
        <label>
          <span>年份</span>
          <input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            onBlur={() => year !== String(manifest.year) && void onPatch({ year: Number(year) })}
          />
        </label>
      </div>
      <div className="meta-row checkboxes">
        <label className="inline">
          <input
            type="checkbox"
            checked={manifest.export.toc}
            onChange={(e) => void onPatch({ export: { toc: e.target.checked } })}
          />
          <span>生成目录</span>
        </label>
        <label className="inline">
          <input
            type="checkbox"
            checked={manifest.export.draftComments}
            onChange={(e) => void onPatch({ export: { draftComments: e.target.checked } })}
          />
          <span>批注边注（草稿）</span>
        </label>
      </div>
      <label className="inline">
        <span>引擎</span>
        <select
          value={manifest.export.engine}
          onChange={(e) => void onPatch({ export: { engine: e.target.value } })}
        >
          <option value="pdflatex">pdflatex（推荐）</option>
          <option value="xelatex">xelatex</option>
        </select>
      </label>
    </div>
  )
}
