import { lazy } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { AuthLayout, SiteLayout } from './components/layout/SiteLayout'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'

// Secondary routes are split out so the landing page loads only what it needs.
const AboutPage = lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })))
const ContactPage = lazy(() => import('./pages/ContactPage').then((m) => ({ default: m.ContactPage })))
const GetStartedPage = lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.GetStartedPage })))
const SignInPage = lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.SignInPage })))
const WorkspacePage = lazy(() => import('./pages/WorkspacePage').then((m) => ({ default: m.WorkspacePage })))
const PrivacyPage = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.PrivacyPage })))
const TermsPage = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.TermsPage })))

const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: '/get-started', element: <GetStartedPage /> },
      { path: '/signin', element: <SignInPage /> },
    ],
  },
  {
    element: <SiteLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/about', element: <AboutPage /> },
      { path: '/contact', element: <ContactPage /> },
      { path: '/app', element: <WorkspacePage /> },
      { path: '/privacy', element: <PrivacyPage /> },
      { path: '/terms', element: <TermsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
