import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock fetch globally
global.fetch = vi.fn()

// Mock window.localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })
