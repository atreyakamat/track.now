import { CheckCircle2 } from 'lucide-react'
import { ComingSoon, PageHeader } from '@/components/ui'

export function ReviewsPage() {
  return (
    <div>
      <PageHeader
        title="Reviews"
        description="Reflective operating cycles across weekly and monthly horizons."
      />

      <ComingSoon
        icon={<CheckCircle2 size={24} />}
        title="Review & Reflection System"
        description="The Reviews module will host weekly tactical reviews and monthly strategic audits across all your active Tracks. You will be able to assess what worked, where friction appeared, and reset priorities for the upcoming cycle."
        todo="REVIEWS: Weekly cadence checklists, retro reflections, auto-summarization across track completions"
      />
    </div>
  )
}
