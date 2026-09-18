import { Feather, Languages } from 'lucide-react'
import { useEffect } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigationType } from 'react-router-dom'

import { Blank, RequireAccount } from './components/shared'
import { Button } from './components/ui/button'
import { Login, Settings } from './features/account'
import { Discovery, Drafts, Following, Writer } from './features/discovery'
import { Editor } from './features/editor'
import { Reader } from './features/reader'
import { useSession } from './lib/session'

function ScrollPosition() {
  const { pathname, key, state } = useLocation()
  const action = useNavigationType()
  useEffect(() => {
    const old = history.scrollRestoration
    history.scrollRestoration = 'manual'
    const position = action === 'POP' ? Number(sessionStorage.getItem(`scroll:${key}`) ?? 0) : 0
    const frame = requestAnimationFrame(() => {
      if (!state?.preserveScroll) {
        window.scrollTo(0, position)
      }
    })
    const save = () => sessionStorage.setItem(`scroll:${key}`, String(window.scrollY))
    window.addEventListener('scroll', save, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', save)
      history.scrollRestoration = old
    }
  }, [pathname, key, action, state])
  return null
}
export default function App() {
  const { t, authenticated, language, setLanguage } = useSession()
  return (
    <>
      <ScrollPosition />
      <a href="#main" className="skip-link">
        {t('Skip to content', 'انتقل للمحتوى')}
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to="/" aria-label={t('Margin home', 'هامش الرئيسية')}>
            <span className="brand-symbol">م</span>
            {t('margin', 'هامش')}
            <span className="brand-dot">.</span>
          </Link>
          <nav aria-label={t('Main navigation', 'التنقل الرئيسي')}>
            <NavLink to="/" end>
              {t('Explore', 'استكشف')}
            </NavLink>
            <NavLink to="/feed">{t('Following', 'المتابَعون')}</NavLink>
            <NavLink to="/saved">{t('Saved', 'المحفوظات')}</NavLink>
            {authenticated && <NavLink to="/drafts">{t('Drafts', 'المسودات')}</NavLink>}
          </nav>
          <div className="header-actions">
            <Button
              size="icon"
              variant="ghost"
              aria-label={language === 'en' ? 'Switch to Arabic' : 'التبديل للإنجليزية'}
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            >
              <Languages />
            </Button>
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link to={authenticated ? '/settings' : '/login'} />}
            >
              {authenticated ? t('Account', 'الحساب') : t('Sign in', 'دخول')}
            </Button>
            <Button nativeButton={false} render={<Link to="/write" />}>
              <Feather data-icon="inline-start" />
              <span>{t('Write', 'اكتب')}</span>
            </Button>
          </div>
        </div>
      </header>
      <main id="main" className="site-main">
        <Routes>
          <Route path="/" element={<Discovery />} />
          <Route path="/login" element={<Login />} />
          <Route path="/articles/:id" element={<Reader />} />
          <Route path="/writers/:id" element={<Writer />} />
          <Route
            path="/feed"
            element={
              <RequireAccount>
                <div className="feed-links">
                  <Link to="/following">
                    {t('Manage writers you follow', 'إدارة الكتّاب المتابَعين')}
                  </Link>
                </div>
                <Discovery mode="feed" />
              </RequireAccount>
            }
          />
          <Route
            path="/following"
            element={
              <RequireAccount>
                <Following />
              </RequireAccount>
            }
          />
          <Route
            path="/saved"
            element={
              <RequireAccount>
                <Discovery mode="saved" />
              </RequireAccount>
            }
          />
          <Route
            path="/drafts"
            element={
              <RequireAccount>
                <Drafts />
              </RequireAccount>
            }
          />
          <Route
            path="/write"
            element={
              <RequireAccount>
                <Editor />
              </RequireAccount>
            }
          />
          <Route
            path="/write/:id"
            element={
              <RequireAccount>
                <Editor />
              </RequireAccount>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAccount>
                <Settings />
              </RequireAccount>
            }
          />
          <Route
            path="*"
            element={
              <Blank
                title={t('Page not found', 'الصفحة غير موجودة')}
                description={t('Let’s find another idea.', 'لنكتشف فكرة أخرى.')}
              >
                <Link to="/">{t('Back to explore', 'العودة للاستكشاف')}</Link>
              </Blank>
            }
          />
        </Routes>
      </main>
      <footer className="site-footer">
        <Link className="brand" to="/">
          {t('margin.', 'هامش.')}
        </Link>
        <p>{t('Make space for a good idea.', 'امنح الفكرة الجيدة مساحة.')}</p>
        <span>{t('Read. Reflect. Return.', 'اقرأ. تأمّل. عُد.')}</span>
      </footer>
    </>
  )
}
