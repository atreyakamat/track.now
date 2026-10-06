import { Compass } from 'lucide-react'
import { ButtonLink, EmptyState, PageHeader } from '@/components/ui'

export function NotFoundPage() {
  return (
    <div>
      <PageHeader title="404" description="Page not found" />
      <EmptyState
        icon={<Compass size={24} />}
        title="Destination does not exist"
        description="The route or workspace you requested is not available in Track.now."
        action={
          <ButtonLink to="/dashboard" variant="primary">
            Return to Dashboard
          </ButtonLink>
        }
      />
    </div>
  )
}
