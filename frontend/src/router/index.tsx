import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/Spinner'

// Lazy-loaded pages
const LoginPage          = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage       = lazy(() => import('@/pages/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const ResetPasswordPage  = lazy(() => import('@/pages/auth/ResetPasswordPage'))

const UserLayout         = lazy(() => import('@/components/layout/UserLayout'))
const FeedPage           = lazy(() => import('@/pages/feed/FeedPage'))
const ProfilePage        = lazy(() => import('@/pages/profile/ProfilePage'))
const FriendsPage        = lazy(() => import('@/pages/friends/FriendsPage'))
const SearchPage         = lazy(() => import('@/pages/search/SearchPage'))
const SavedPostsPage     = lazy(() => import('@/pages/posts/SavedPostsPage'))
const PostDetailPage     = lazy(() => import('@/pages/posts/PostDetailPage'))
const GroupsPage         = lazy(() => import('@/pages/groups/GroupsPage'))
const GroupDetailPage    = lazy(() => import('@/pages/groups/GroupDetailPage'))
const ChatPage           = lazy(() => import('@/pages/chat/ChatPage'))
const NotificationsPage  = lazy(() => import('@/pages/notifications/NotificationsPage'))

const AdminLayout        = lazy(() => import('@/components/layout/AdminLayout'))
const AdminDashboard     = lazy(() => import('@/pages/admin/AdminDashboardPage'))
const AdminUsersPage     = lazy(() => import('@/pages/admin/AdminUsersPage'))
const AdminReportsPage   = lazy(() => import('@/pages/admin/AdminReportsPage'))

// Suspense wrapper
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-app-bg">
      <Spinner size="lg" />
    </div>
  )
}

// Protected route guard
function RequireAuth() {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}

function RequireUser() {
  const { user } = useAuthStore()
  if (user?.role === 'ADMIN') return <Navigate to="/admin" replace />
  return <Outlet />
}

// Admin route guard
function RequireAdmin() {
  const { user } = useAuthStore()
  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />
  return <Outlet />
}

// Guest route (redirect to feed if already logged in)
function GuestOnly() {
  const { isAuthenticated, user } = useAuthStore()
  if (isAuthenticated) return <Navigate to={user?.role === 'ADMIN' ? '/admin' : '/'} replace />
  return <Outlet />
}

const router = createBrowserRouter([
  // Guest routes
  {
    element: <GuestOnly />,
    children: [
      { path: '/login',          element: <LoginPage /> },
      { path: '/register',       element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
    ],
  },
  // Protected user routes
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RequireUser />,
        children: [
          {
            element: <UserLayout />,
            children: [
              { path: '/',                    element: <FeedPage /> },
              { path: '/profile/:id',         element: <ProfilePage /> },
              { path: '/friends',             element: <FriendsPage /> },
              { path: '/search',              element: <SearchPage /> },
              { path: '/saved',               element: <SavedPostsPage /> },
              { path: '/posts/:id',           element: <PostDetailPage /> },
              { path: '/groups',              element: <GroupsPage /> },
              { path: '/groups/:id',          element: <GroupDetailPage /> },
              { path: '/chat',                element: <ChatPage /> },
              { path: '/chat/:conversationId', element: <ChatPage /> },
              { path: '/notifications',       element: <NotificationsPage /> },
            ],
          },
        ],
      },
    ],
  },
  // Admin routes
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RequireAdmin />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              { path: '/admin',         element: <AdminDashboard /> },
              { path: '/admin/users',   element: <AdminUsersPage /> },
              { path: '/admin/reports', element: <AdminReportsPage /> },
            ],
          },
        ],
      },
    ],
  },
  // Fallback
  { path: '*', element: <Navigate to="/" replace /> },
])

export function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RouterProvider router={router} />
    </Suspense>
  )
}
