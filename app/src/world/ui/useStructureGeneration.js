/**
 * Derived geometry per structure (Step 47).
 *
 * - Skeleton: recomputed synchronously, cached by skeleton signature
 *   (live preview on every edit — cheap).
 * - Lithic: debounced preview job in a Web Worker; explicit "Refine" posts a
 *   final-quality job. Results are keyed by lithic signature, so only
 *   structures whose curve/params/seed changed regenerate. The last valid
 *   mesh is kept while a new one is generating or if a job fails.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { resolveStructureParams } from '../model/project.js'
import { lithicSignature, skeletonSignature } from '../model/signature.js'
import { buildSpineSkeleton } from '../skeleton/spine.js'

const DEBOUNCE_MS = 400

export function useStructureGeneration(project) {
  const skeletonCache = useRef(new Map())

  const structures = useMemo(() => {
    const out = []
    const used = new Set()
    for (const curveId of project.order) {
      const curve = project.curves[curveId]
      if (!curve) continue
      const structureId = curve.generatedStructureIds[0]
      const params = resolveStructureParams(project, curveId)
      const skelSig = skeletonSignature(curve, params.skeleton, params.seed)
      let skeleton = skeletonCache.current.get(skelSig)
      if (!skeleton) {
        const t0 = performance.now()
        skeleton = buildSpineSkeleton(curve, params.skeleton)
        skeleton.buildMs = performance.now() - t0
        skeletonCache.current.set(skelSig, skeleton)
      }
      used.add(skelSig)
      out.push({
        structureId,
        curveId,
        curve,
        params,
        skelSig,
        skeleton,
        previewSig: lithicSignature(skelSig, params.lithic, params.seed, 'preview'),
        finalSig: lithicSignature(skelSig, params.lithic, params.seed, 'final'),
      })
    }
    for (const key of skeletonCache.current.keys()) if (!used.has(key)) skeletonCache.current.delete(key)
    return out
  }, [project])

  // ---- lithic worker
  const workerRef = useRef(null)
  const jobSeq = useRef(0)
  const pending = useRef(new Map()) // structureId → { jobId, sig, quality }
  const [lithic, setLithic] = useState({}) // structureId → { sig, quality, mesh, stats, status, error }

  useEffect(() => {
    const worker = new Worker(new URL('../lithic/lithic.worker.js', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.onmessage = (event) => {
      const msg = event.data
      const job = pending.current.get(msg.structureId)
      if (!job || job.jobId !== msg.jobId) return // superseded
      pending.current.delete(msg.structureId)
      setLithic((prev) => {
        const old = prev[msg.structureId] ?? {}
        if (!msg.ok) {
          if (msg.cancelled) return prev
          return { ...prev, [msg.structureId]: { ...old, status: 'error', error: msg.error } }
        }
        return {
          ...prev,
          [msg.structureId]: {
            sig: job.sig,
            quality: msg.quality,
            mesh: { positions: msg.positions, normals: msg.normals, indices: msg.indices },
            stats: msg.stats,
            status: 'ready',
            error: null,
          },
        }
      })
    }
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const post = useCallback((s, quality) => {
    const worker = workerRef.current
    if (!worker || s.skeleton.members.length === 0) return
    const jobId = ++jobSeq.current
    const sig = quality === 'final' ? s.finalSig : s.previewSig
    pending.current.set(s.structureId, { jobId, sig, quality })
    setLithic((prev) => ({ ...prev, [s.structureId]: { ...(prev[s.structureId] ?? {}), status: 'generating', error: null } }))
    worker.postMessage({
      jobId,
      structureId: s.structureId,
      skeleton: {
        members: s.skeleton.members,
        protected: s.skeleton.protected,
        bounds: s.skeleton.bounds,
        sourcePolyline: s.skeleton.sourcePolyline,
      },
      params: s.params.lithic,
      seed: s.params.seed,
      quality,
    })
  }, [])

  // Debounced preview regeneration for structures whose signature changed.
  useEffect(() => {
    const ids = new Set(structures.map((s) => s.structureId))
    setLithic((prev) => {
      const next = {}
      let changed = false
      for (const [id, v] of Object.entries(prev)) {
        if (ids.has(id)) next[id] = v
        else changed = true
      }
      return changed ? next : prev
    })
    const stale = structures.filter((s) => {
      const cur = lithic[s.structureId]
      const job = pending.current.get(s.structureId)
      const upToDate = cur && (cur.sig === s.previewSig || cur.sig === s.finalSig)
      const queued = job && (job.sig === s.previewSig || job.sig === s.finalSig)
      return !upToDate && !queued && s.skeleton.members.length > 0
    })
    if (!stale.length) return undefined
    const t = window.setTimeout(() => stale.forEach((s) => post(s, 'preview')), DEBOUNCE_MS)
    return () => window.clearTimeout(t)
    // `lithic` intentionally read without being a dependency: results arriving
    // must not retrigger scheduling of the same signature.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structures, post])

  const refine = useCallback(
    (structureId) => {
      const s = structures.find((x) => x.structureId === structureId)
      if (s) post(s, 'final')
    },
    [structures, post],
  )
  const regenerate = useCallback(
    (structureId) => {
      const s = structures.find((x) => x.structureId === structureId)
      if (s) post(s, 'preview')
    },
    [structures, post],
  )

  const statusOf = useCallback(
    (s) => {
      const cur = lithic[s.structureId]
      if (!s.skeleton.members.length) return 'empty'
      if (cur?.status === 'error') return 'error'
      if (pending.current.has(s.structureId)) return 'generating'
      if (!cur?.mesh) return 'queued'
      if (cur.sig === s.finalSig) return 'final'
      if (cur.sig === s.previewSig) return 'preview'
      return 'stale'
    },
    [lithic],
  )

  return { structures, lithic, refine, regenerate, statusOf }
}
