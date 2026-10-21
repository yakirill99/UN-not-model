import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// globals: false, so RTL does not auto-cleanup between tests — do it here.
afterEach(cleanup)
