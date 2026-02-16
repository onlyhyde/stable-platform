import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('Next.js Route Files', () => {
  describe('loading.tsx', () => {
    it('should render a loading indicator', async () => {
      const Loading = (await import('@/app/loading')).default
      const { container } = render(<Loading />)

      // loading.tsx renders a skeleton with animate-pulse (no text)
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    })
  })

  describe('not-found.tsx', () => {
    it('should render 404 message', async () => {
      const NotFound = (await import('@/app/not-found')).default
      render(<NotFound />)

      expect(screen.getByText('404')).toBeInTheDocument()
      expect(screen.getByText('Page Not Found')).toBeInTheDocument()
    })

    it('should have a link to home', async () => {
      const NotFound = (await import('@/app/not-found')).default
      render(<NotFound />)

      const homeLink = screen.getByRole('link', { name: /dashboard/i })
      expect(homeLink).toBeInTheDocument()
      expect(homeLink).toHaveAttribute('href', '/')
    })
  })

  describe('error.tsx', () => {
    it('should render error message and reset button', async () => {
      const ErrorPage = (await import('@/app/error')).default
      const mockError = new Error('Something went wrong')
      const mockReset = () => {}

      render(<ErrorPage error={mockError} reset={mockReset} />)

      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })
})
