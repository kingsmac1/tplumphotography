import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/client-gallery/$galleryId')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/client-gallery/$galleryId"!</div>
}
