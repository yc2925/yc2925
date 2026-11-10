/**
 * Junction strategy for decorative moldings (Step 13D).
 *
 * Observed (REF-011, REF-009): moldings mitre continuously through arch→mullion
 * transitions; cusps stay sharp.
 *
 * Computational approach in this stage:
 * 1. Prefer single continuous closed loops (outer / each void) so junctions
 *    along a loop share frames — no gap between adjacent segments of one path.
 * 2. At intentional cusps (foil lobes): sharp dual-frame corners (no blend).
 * 3. Where separate loops meet in plan (e.g. mullion vs lancet visually),
 *    moldings remain independent meshes — no boolean union.
 * 4. Fallback when robust mitering across intersecting paths is unsafe:
 *    BUTT_JOINT — end profiles flush at shared 2D endpoints without trimming.
 *
 * Combined STRUCTURAL + DECORATIVE is NOT claimed as one watertight solid.
 */

export const JUNCTION_MODES = Object.freeze({
  CONTINUOUS_LOOP: 'continuous_loop',
  SHARP_CUSP: 'sharp_cusp',
  BUTT_JOINT: 'butt_joint',
})

/**
 * Classify a path for junction handling.
 */
export function classifyPathJunctions(path, frames) {
  const cuspCount = frames.filter((f) => f.sharp).length
  return {
    mode: cuspCount ? JUNCTION_MODES.SHARP_CUSP : JUNCTION_MODES.CONTINUOUS_LOOP,
    cuspCount,
    pathClosed: true,
    notes: cuspCount
      ? 'Sharp dual-frame cusps — no fillet smoothing.'
      : 'Single continuous closed sweep — segment junctions share path vertices.',
  }
}

/**
 * Documented fallback when cross-path mitering is not implemented.
 */
export function junctionFallback(reason) {
  return {
    mode: JUNCTION_MODES.BUTT_JOINT,
    reason:
      reason ??
      'Cross-path mitering/trimming not implemented; decorative sweeps stay on separate closed loops.',
    safe: true,
  }
}

/**
 * Build a human-readable junction report for the assembly.
 */
export function buildJunctionReport(sweeps) {
  const paths = (sweeps ?? []).map((s, i) => ({
    index: i,
    role: s.meta?.role ?? s.role ?? `path-${i}`,
    ...classifyPathJunctions(s.path ?? [], s.frames ?? []),
  }))
  return {
    strategy: 'per-loop continuous sweep + sharp cusps; no boolean union',
    crossPathFallback: junctionFallback(),
    paths,
  }
}
