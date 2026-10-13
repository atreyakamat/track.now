import { deleteTrack, setTrackArchived } from './tracksService'
import { deletePlan, listPlans, setPlanArchived } from './plansService'
import { cancelRemindersForPlan, cancelRemindersForTrack } from './reminderService'

/**
 * Lifecycle operations that must also clean up device-local reminders, so archived or
 * deleted Tracks/Plans never leave reminders that fire or deep-link into missing pages.
 * The database change happens first; reminders are only cancelled once it succeeded.
 */

async function planIdsOf(trackId: string): Promise<string[]> {
  try {
    return (await listPlans(trackId)).map((p) => p.id)
  } catch {
    return []
  }
}

export async function setTrackArchivedWithCleanup(
  userId: string | undefined,
  trackId: string,
  archived: boolean,
): Promise<void> {
  const planIds = archived && userId ? await planIdsOf(trackId) : []
  await setTrackArchived(trackId, archived)
  if (archived && userId) cancelRemindersForTrack(userId, trackId, planIds)
}

export async function deleteTrackWithCleanup(userId: string | undefined, trackId: string): Promise<void> {
  const planIds = userId ? await planIdsOf(trackId) : []
  await deleteTrack(trackId)
  if (userId) cancelRemindersForTrack(userId, trackId, planIds)
}

export async function setPlanArchivedWithCleanup(
  userId: string | undefined,
  planId: string,
  archived: boolean,
): Promise<void> {
  await setPlanArchived(planId, archived)
  if (archived && userId) cancelRemindersForPlan(userId, planId)
}

export async function deletePlanWithCleanup(userId: string | undefined, planId: string): Promise<void> {
  await deletePlan(planId)
  if (userId) cancelRemindersForPlan(userId, planId)
}
