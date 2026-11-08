import type { PlanFile } from '../domain/planImport'
import type { Plan, Track } from '../types/domain'
import { createTrack, listTracks } from './tracksService'
import { createPlan, listPlans } from './plansService'
import { createExecutionItem } from './executionService'
import { newChecklistEntryId } from '../domain/checklist'

export interface ImportReport {
  tracksCreated: number
  tracksReused: number
  plansCreated: number
  plansSkipped: string[]
  itemsCreated: number
  /** Set when the import stopped part-way; everything listed above was saved. */
  error: string | null
}

const norm = (s: string) => s.trim().toLowerCase()

/**
 * Creates the Tracks, Plans and items of a parsed plan file for the signed-in user.
 * - An existing active Track with the same name is reused (no duplicate life areas).
 * - A Plan whose name already exists in that Track is skipped, so re-running an import never
 *   duplicates work.
 * - Writes go through the normal services (RLS, validation, schema compatibility). If one fails
 *   the import stops and reports exactly what was already created.
 */
export async function importPlanFile(
  userId: string,
  file: PlanFile,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportReport> {
  const report: ImportReport = { tracksCreated: 0, tracksReused: 0, plansCreated: 0, plansSkipped: [], itemsCreated: 0, error: null }
  const total = file.tracks.reduce((a, t) => a + t.plans.reduce((b, p) => b + 1 + p.items.length, 1), 0)
  let done = 0
  const tick = () => onProgress?.(++done, total)
  try {
    const existingTracks: Track[] = await listTracks()
    const existingPlans: Plan[] = await listPlans()
    for (const t of file.tracks) {
      let track = existingTracks.find((x) => x.status === 'active' && norm(x.name) === norm(t.name))
      if (track) report.tracksReused++
      else {
        track = await createTrack(userId, { name: t.name, description: t.description, icon: t.icon, color: t.color, template_type: 'custom' })
        existingTracks.push(track)
        report.tracksCreated++
      }
      tick()
      for (const p of t.plans) {
        if (existingPlans.some((x) => x.track_id === track!.id && norm(x.name) === norm(p.name))) {
          report.plansSkipped.push(`${t.name} › ${p.name}`)
          done += 1 + p.items.length
          onProgress?.(done, total)
          continue
        }
        const plan = await createPlan(userId, {
          track_id: track.id,
          name: p.name,
          description: p.description,
          start_date: p.start_date,
          end_date: p.end_date,
          plan_kind: p.kind,
          outcome: p.outcome,
          success_criteria: p.success_criteria,
          arc_name: p.arc_name,
        })
        existingPlans.push(plan)
        report.plansCreated++
        tick()
        for (const it of p.items) {
          await createExecutionItem(userId, {
            plan_id: plan.id,
            track_id: track.id,
            type: it.type,
            name: it.name,
            description: it.description,
            priority: it.priority,
            due_date: it.due_date,
            start_date: it.start_date,
            target_count: it.target_count,
            current_count: 0,
            unit: it.unit,
            checklist_entries: it.steps.map((label) => ({ id: newChecklistEntryId(), label, done: false })),
            schedule: it.schedule,
          })
          report.itemsCreated++
          tick()
        }
      }
    }
  } catch (err) {
    report.error = err instanceof Error ? err.message : String(err)
  }
  return report
}
