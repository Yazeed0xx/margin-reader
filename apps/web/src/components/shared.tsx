import { useSession } from '@/lib/session'
import { Link } from 'react-router-dom'

import { normalizeApiError } from '@poc/api-client'

import { Alert, AlertTitle, AlertDescription } from './ui/alert'
import { Button } from './ui/button'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from './ui/empty'
import { Skeleton } from './ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'

import type { ReactNode } from 'react'

export function Problem({ error, retry }: { error: unknown; retry?: () => void }) {
  const { t } = useSession()
  if (!error) {
    return null
  }
  const parsed = normalizeApiError(error)
  return (
    <Alert variant="destructive">
      <AlertTitle>{t('Something needs attention', 'حدث خطأ')}</AlertTitle>
      <AlertDescription>
        <p>
          {parsed.status === 429
            ? t(
                'Too many requests. Please wait before trying again.',
                'طلبات كثيرة. يرجى الانتظار قبل المحاولة مجددًا.',
              )
            : parsed.status === 409
              ? t(
                  'This version changed elsewhere. Your edits are still here. Reload the latest version before saving again.',
                  'تم تغيير هذه النسخة في مكان آخر. تعديلاتك محفوظة هنا. حمّل النسخة الأحدث قبل الحفظ مجددًا.',
                )
              : parsed.status === 401
                ? t(
                    'Your session has expired. Please sign in again.',
                    'انتهت الجلسة. يرجى تسجيل الدخول مجددًا.',
                  )
                : parsed.status === 404
                  ? t(
                      'This item is no longer available. It may have been updated or unpublished.',
                      'هذا المحتوى غير متاح. قد يكون تم تحديثه أو إلغاء نشره.',
                    )
                  : parsed.message}
        </p>
        {retry && (
          <Button variant="outline" onClick={retry}>
            {t('Try again', 'حاول مجددًا')}
          </Button>
        )}
        {parsed.status === 401 && <Link to="/login">{t('Sign in', 'تسجيل الدخول')}</Link>}
      </AlertDescription>
    </Alert>
  )
}
export function Loading() {
  const { t } = useSession()
  return (
    <output aria-label={t('Loading', 'جارٍ التحميل')} className="flex flex-col gap-4 py-8">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-12 w-3/4" />
      <Skeleton className="h-24 w-full" />
    </output>
  )
}
export function Blank({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  )
}
export function RequireAccount({ children }: { children: ReactNode }) {
  const { authenticated, loading, profileError, t } = useSession()
  if (loading) {
    return <Loading />
  }
  if (profileError) {
    return <Problem error={profileError} retry={() => window.location.reload()} />
  }
  if (!authenticated) {
    return (
      <Blank
        title={t('A place for your ideas', 'مساحة لأفكارك')}
        description={t(
          'Sign in to write, follow writers, and keep your place.',
          'سجّل الدخول للكتابة ومتابعة الكتّاب وحفظ موضع القراءة.',
        )}
      >
        <Button nativeButton={false} render={<Link to="/login" />}>
          {t('Sign in', 'تسجيل الدخول')}
        </Button>
      </Blank>
    )
  }
  return children
}
export function LanguageChoice({
  value,
  onChange,
  both = false,
}: {
  value: string
  onChange: (value: 'en' | 'ar' | 'both') => void
  both?: boolean
}) {
  const { t } = useSession()
  return (
    <ToggleGroup
      aria-label={t('Language', 'اللغة')}
      value={[value]}
      onValueChange={(values) => {
        const next = values[0]
        if (next === 'en' || next === 'ar' || next === 'both') {
          onChange(next)
        }
      }}
      variant="outline"
    >
      {both && <ToggleGroupItem value="both">{t('All languages', 'كل اللغات')}</ToggleGroupItem>}
      <ToggleGroupItem value="en">English</ToggleGroupItem>
      <ToggleGroupItem value="ar">العربية</ToggleGroupItem>
    </ToggleGroup>
  )
}
export function Pages({
  page,
  lastPage,
  onChange,
}: {
  page: number
  lastPage: number
  onChange: (page: number) => void
}) {
  const { t } = useSession()
  return (
    <nav
      aria-label={t('Pages', 'الصفحات')}
      className="flex items-center justify-between gap-4 py-8"
    >
      <Button variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        {t('Previous', 'السابق')}
      </Button>
      <span className="text-sm text-muted-foreground">
        {page} / {Math.max(1, lastPage)}
      </span>
      <Button variant="outline" disabled={page >= lastPage} onClick={() => onChange(page + 1)}>
        {t('Next', 'التالي')}
      </Button>
    </nav>
  )
}
