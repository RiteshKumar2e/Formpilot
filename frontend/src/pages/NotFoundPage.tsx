import { useLocation } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'
import { Button } from '../components/ui/Button'
import { Container } from '../components/ui/primitives'

export function NotFoundPage() {
  const { pathname } = useLocation()
  usePageMeta({ title: 'Page not found', path: pathname })

  return (
    <Container className="py-24 sm:py-32 lg:py-40">
      <div className="max-w-[640px]">
        <p className="font-mono text-[13px] text-subtle">404 · {pathname}</p>
        <h1 className="display mt-4 text-[40px] text-ink sm:text-[56px]">Looks like this page took the wrong turn.</h1>
        <p className="mt-5 text-[18px] text-muted">The link may be out of date, or the page may have moved.</p>
        <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-7">
          <Button to="/">Back to home</Button>
          <Button to="/contact" variant="quiet">
            Report a broken link
          </Button>
        </div>
      </div>
    </Container>
  )
}
