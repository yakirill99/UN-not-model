import { useLocation } from 'react-router'

/** Catch-all route for tests: prints the current path so a redirect is assertable. */
export default function WhereAmI() {
  return <p data-testid="location">{useLocation().pathname}</p>
}
