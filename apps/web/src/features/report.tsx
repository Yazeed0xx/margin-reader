import { Problem } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'

type Reason = 'spam' | 'harassment' | 'copyright' | 'other'
export function ReportArticle({ articleId }: { articleId: number }) {
  const { t, authenticated } = useSession()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<Reason>('other')
  const [details, setDetails] = useState('')
  const report = useMutation({
    mutationFn: () =>
      api.profile.articleReports.store({
        params: { id: articleId },
        body: { reason, details: details.trim() || null },
      }),
  })
  return (
    <div className="inline-report">
      <Button variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
        {t('Report this essay', 'الإبلاغ عن المقال')}
      </Button>
      {open && (
        <section className="inline-source">
          <header>
            <h2>{t('Report a concern', 'الإبلاغ عن مشكلة')}</h2>
            <p>
              {t(
                'Reports are private and reviewed by the moderation team.',
                'البلاغات خاصة ويراجعها فريق الإشراف.',
              )}
            </p>
          </header>
          <div className="source-body">
            {!authenticated ? (
              <Button nativeButton={false} render={<Link to="/login" />}>
                {t('Sign in to report', 'سجّل الدخول للإبلاغ')}
              </Button>
            ) : report.isSuccess ? (
              <output>
                {t(
                  'Your report has been recorded. Thank you for helping keep this space thoughtful.',
                  'تم تسجيل بلاغك. شكرًا لمساعدتك في الحفاظ على هذه المساحة.',
                )}
              </output>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  report.mutate()
                }}
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="report-reason">{t('Reason', 'السبب')}</FieldLabel>
                    <Select
                      value={reason}
                      onValueChange={(value) => {
                        if (
                          value === 'spam' ||
                          value === 'harassment' ||
                          value === 'copyright' ||
                          value === 'other'
                        ) {
                          setReason(value)
                        }
                      }}
                    >
                      <SelectTrigger id="report-reason">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="spam">{t('Spam', 'محتوى مزعج')}</SelectItem>
                          <SelectItem value="harassment">
                            {t('Harassment or abuse', 'إساءة أو مضايقة')}
                          </SelectItem>
                          <SelectItem value="copyright">
                            {t('Copyright concern', 'مشكلة حقوق نشر')}
                          </SelectItem>
                          <SelectItem value="other">{t('Other concern', 'مشكلة أخرى')}</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="report-details">
                      {t('Details (optional)', 'التفاصيل (اختياري)')}
                    </FieldLabel>
                    <Textarea
                      id="report-details"
                      maxLength={2000}
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      rows={5}
                    />
                  </Field>
                  <Problem error={report.error} />
                  <Button type="submit" disabled={report.isPending}>
                    {report.isPending
                      ? t('Sending…', 'جارٍ الإرسال…')
                      : t('Submit report', 'إرسال البلاغ')}
                  </Button>
                </FieldGroup>
              </form>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
