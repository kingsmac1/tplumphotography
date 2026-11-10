import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/contract/$token')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/contract/$token"!</div>
}
