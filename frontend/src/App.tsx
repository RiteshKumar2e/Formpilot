import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { WorkspaceProvider } from './product/workspace'
import { SiteLayout } from './components/layout/SiteLayout'
import { AuthLayout } from './components/layout/AuthLayout'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'

// Marketing pages
const AboutPage = lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })))
const TeamPage = lazy(() => import('./pages/TeamPage').then((m) => ({ default: m.TeamPage })))
const ContactPage = lazy(() => import('./pages/ContactPage').then((m) => ({ default: m.ContactPage })))
const MarketingPage = lazy(() => import('./pages/MarketingPages').then((m) => ({ default: m.MarketingPage })))
const PrivacyPage = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.PrivacyPage })))
const TermsPage = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.TermsPage })))
const SignUpPage = lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.GetStartedPage })))
const SignInPage = lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.SignInPage })))
const ForgotPasswordPage = lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.ResetPasswordPage })))

// Product (loaded only when someone enters the app)
const AppLayout = lazy(() => import('./product/AppLayout').then((m) => ({ default: m.AppLayout })))
const DashboardPage = lazy(() => import('./product/pages/Dashboard').then((m) => ({ default: m.DashboardPage })))
const ProfilePage = lazy(() => import('./product/pages/Profile').then((m) => ({ default: m.ProfilePage })))
const DocumentsPage = lazy(() => import('./product/pages/Documents').then((m) => ({ default: m.DocumentsPage })))
const ApplicationsPage = lazy(() => import('./product/pages/Applications').then((m) => ({ default: m.ApplicationsPage })))
const NewApplicationPage = lazy(() => import('./product/pages/NewApplication').then((m) => ({ default: m.NewApplicationPage })))
const ApplicationWorkspacePage = lazy(() => import('./product/pages/ApplicationWorkspace').then((m) => ({ default: m.ApplicationWorkspacePage })))
const ReviewPage = lazy(() => import('./product/pages/Review').then((m) => ({ default: m.ReviewPage })))
const FieldMappingPage = lazy(() => import('./product/pages/FieldMapping').then((m) => ({ default: m.FieldMappingPage })))
const ValidationPage = lazy(() => import('./product/pages/Validation').then((m) => ({ default: m.ValidationPage })))
const ActivityPage = lazy(() => import('./product/pages/Activity').then((m) => ({ default: m.ActivityPage })))
const SettingsPage = lazy(() => import('./product/pages/Settings').then((m) => ({ default: m.SettingsPage })))
const VaultPage = lazy(() => import('./product/pages/Vault').then((m) => ({ default: m.VaultPage })))
const AnywherePage = lazy(() => import('./product/pages/Anywhere').then((m) => ({ default: m.AnywherePage })))
const ExtensionPage = lazy(() => import('./product/pages/ExtensionPage').then((m) => ({ default: m.ExtensionPage })))

const appFallback = <div className="min-h-dvh bg-canvas" aria-busy="true" />
const page = (node: ReactNode) => <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>{node}</Suspense>

const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <SignInPage /> },
      { path: '/signup', element: <SignUpPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
    ],
  },
  // Opened from the reset email: a standalone page without the site or sign-in layout.
  { path: '/reset-password', element: page(<ResetPasswordPage />) },
  {
    element: (
      <Suspense fallback={appFallback}>
        <AppLayout />
      </Suspense>
    ),
    children: [
      { path: '/dashboard', element: page(<DashboardPage />) },
      { path: '/vault', element: page(<VaultPage />) },
      { path: '/anywhere', element: page(<AnywherePage />) },
      { path: '/extension', element: page(<ExtensionPage />) },
      { path: '/profile', element: page(<ProfilePage />) },
      { path: '/documents', element: page(<DocumentsPage />) },
      { path: '/applications', element: page(<ApplicationsPage />) },
      { path: '/applications/new', element: page(<NewApplicationPage />) },
      { path: '/applications/:id', element: page(<ApplicationWorkspacePage />) },
      { path: '/applications/:id/review', element: page(<ReviewPage />) },
      { path: '/mapping', element: page(<FieldMappingPage />) },
      { path: '/validation', element: page(<ValidationPage />) },
      { path: '/activity', element: page(<ActivityPage />) },
      { path: '/settings', element: page(<SettingsPage />) },
    ],
  },
  {
    element: <SiteLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/how-it-works', element: <MarketingPage page="how-it-works" /> },
      { path: '/features', element: <MarketingPage page="features" /> },
      { path: '/security', element: <MarketingPage page="security" /> },
      { path: '/about', element: <AboutPage /> },
      { path: '/team', element: <TeamPage /> },
      { path: '/contact', element: <ContactPage /> },
      { path: '/privacy', element: <PrivacyPage /> },
      { path: '/terms', element: <TermsPage /> },
      // Old paths
      { path: '/signin', element: <Navigate to="/login" replace /> },
      { path: '/get-started', element: <Navigate to="/signup" replace /> },
      { path: '/app', element: <Navigate to="/dashboard" replace /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <RouterProvider router={router} />
      </WorkspaceProvider>
    </AuthProvider>
  )
}
