import { BarChart3 } from 'lucide-react'
import { ComingSoon, PageHeader } from '@/components/ui'

export function AnalyticsPage() {
  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Execution consistency, cross-track balance, and momentum analytics."
      />

      <ComingSoon
        icon={<BarChart3 size={24} />}
        title="Deep Analytics & Insights"
        description="The Analytics module will provide cross-track momentum curves, completion velocity, habit consistency trends, and balanced life distribution across your 5 core domains."
        todo="ANALYTICS: Consistency score, velocity charts, track balance radar, execution heatmaps derived from pure domain metrics"
      />
    </div>
  )
}
