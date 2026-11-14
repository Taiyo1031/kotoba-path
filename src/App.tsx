import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { PageTransition } from './components/PageTransition'
import { WelcomePage } from './pages/WelcomePage'
import { HomePage } from './pages/HomePage'
import { UnitPage } from './pages/UnitPage'
import { LessonPage } from './pages/LessonPage'
import { ReviewPage } from './pages/ReviewPage'
import { DataPage } from './pages/DataPage'
import { SettingsPage } from './pages/SettingsPage'
import { DebugPage } from './pages/DebugPage'
import { ROUTES } from './routes'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route
          element={
            <Layout>
              <PageTransition>
                <Outlet />
              </PageTransition>
            </Layout>
          }
        >
          <Route path={ROUTES.home} element={<HomePage />} />
          <Route path={ROUTES.unit} element={<UnitPage />} />
          <Route path={ROUTES.review} element={<ReviewPage />} />
          <Route path={ROUTES.data} element={<DataPage />} />
          <Route path={ROUTES.settings} element={<SettingsPage />} />
          <Route path={ROUTES.debug} element={<DebugPage />} />
        </Route>
        <Route
          element={
            <Layout showNavigation={false}>
              <PageTransition>
                <Outlet />
              </PageTransition>
            </Layout>
          }
        >
          <Route path={ROUTES.welcome} element={<WelcomePage />} />
          <Route path={ROUTES.lesson} element={<LessonPage />} />
        </Route>
        <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
      </Routes>
    </HashRouter>
  )
}
