import { Problem, LanguageChoice, Loading } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { api, queryClient } from '@/lib/api'
import { useSession } from '@/lib/session'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export function Login() {
  const { login, t } = useSession()
  const navigate = useNavigate()
  const [signup, setSignup] = useState(false)
  const mutation = useMutation({
    mutationFn: async (form: FormData) => {
      const email = String(form.get('email'))
      const password = String(form.get('password'))
      return signup
        ? api.auth.newAccount.store({
            body: {
              email,
              password,
              fullName: String(form.get('fullName')),
              passwordConfirmation: String(form.get('confirmation')),
            },
          })
        : api.auth.accessTokens.store({ body: { email, password } })
    },
    onSuccess: (response) => {
      login(response.data.token)
      navigate('/')
    },
  })
  return (
    <section className="narrow page">
      <p className="eyebrow">{t('Welcome to Margin', 'مرحبًا بك في هامش')}</p>
      <h1>
        {signup
          ? t('Make room for ideas.', 'امنح أفكارك مساحة.')
          : t('Good to have you back.', 'سعداء بعودتك.')}
      </h1>
      <p className="intro">
        {t('Read deeply. Keep your sources close.', 'اقرأ بعمق. واحتفظ بمصادرك بالقرب منك.')}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          mutation.mutate(new FormData(e.currentTarget))
        }}
      >
        <FieldGroup>
          {signup && (
            <Field>
              <FieldLabel htmlFor="fullName">{t('Name', 'الاسم')}</FieldLabel>
              <Input id="fullName" name="fullName" autoComplete="name" maxLength={120} required />
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="email">{t('Email', 'البريد الإلكتروني')}</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">{t('Password', 'كلمة المرور')}</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={signup ? 'new-password' : 'current-password'}
              required
              minLength={signup ? 8 : undefined}
              maxLength={128}
            />
          </Field>
          {signup && (
            <Field>
              <FieldLabel htmlFor="confirmation">
                {t('Confirm password', 'تأكيد كلمة المرور')}
              </FieldLabel>
              <Input
                id="confirmation"
                name="confirmation"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </Field>
          )}
          <Problem error={mutation.error} />
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending
              ? t('Please wait…', 'يرجى الانتظار…')
              : signup
                ? t('Create account', 'إنشاء حساب')
                : t('Sign in', 'تسجيل الدخول')}
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              setSignup(!signup)
              mutation.reset()
            }}
          >
            {signup
              ? t('Already a member? Sign in', 'لديك حساب؟ سجّل الدخول')
              : t('New here? Create an account', 'جديد هنا؟ أنشئ حسابًا')}
          </Button>
        </FieldGroup>
      </form>
    </section>
  )
}
export function Settings() {
  const { user, t, logout, setLanguage } = useSession()
  const navigate = useNavigate()
  const [reading, setReading] = useState<'en' | 'ar' | 'both'>(user?.readingLanguage ?? 'both')
  const [interfaceLanguage, setInterfaceLanguage] = useState<'en' | 'ar'>(
    user?.interfaceLanguage ?? 'en',
  )
  const save = useMutation({
    mutationFn: (form: FormData) =>
      api.profile.profile.update({
        body: {
          fullName: String(form.get('fullName')),
          bio: String(form.get('bio')),
          interfaceLanguage,
          readingLanguage: reading,
        },
      }),
    onSuccess: () => {
      setLanguage(interfaceLanguage)
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
  const leave = useMutation({
    mutationFn: () => api.profile.accessTokens.destroy({}),
    onSuccess: () => {
      logout()
      navigate('/')
    },
  })
  if (!user) {
    return <Loading />
  }
  return (
    <section className="narrow page">
      <p className="eyebrow">{t('Your space', 'مساحتك')}</p>
      <h1>{t('Profile & preferences', 'الملف والتفضيلات')}</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate(new FormData(e.currentTarget))
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="name">{t('Name', 'الاسم')}</FieldLabel>
            <Input id="name" name="fullName" defaultValue={user.fullName ?? ''} maxLength={120} />
          </Field>
          <Field>
            <FieldLabel htmlFor="bio">{t('A little about you', 'نبذة عنك')}</FieldLabel>
            <Textarea id="bio" name="bio" defaultValue={user.bio ?? ''} maxLength={2000} />
          </Field>
          <Field>
            <FieldLabel>{t('Interface language', 'لغة الواجهة')}</FieldLabel>
            <LanguageChoice
              value={interfaceLanguage}
              onChange={(v) => {
                if (v !== 'both') {
                  setInterfaceLanguage(v)
                }
              }}
            />
          </Field>
          <Field>
            <FieldLabel>{t('Reading languages', 'لغات القراءة')}</FieldLabel>
            <LanguageChoice both value={reading} onChange={setReading} />
          </Field>
          <Problem error={save.error} />
          <Button disabled={save.isPending} type="submit">
            {t('Save preferences', 'حفظ التفضيلات')}
          </Button>
          {save.isSuccess && <output>{t('Preferences saved.', 'تم حفظ التفضيلات.')}</output>}
        </FieldGroup>
      </form>
      <div className="flex flex-wrap gap-3 py-8">
        <Button variant="outline" nativeButton={false} render={<Link to={`/writers/${user.id}`} />}>
          {t('View public profile', 'عرض الملف العام')}
        </Button>
        <Button variant="ghost" onClick={() => leave.mutate()} disabled={leave.isPending}>
          {t('Sign out', 'تسجيل الخروج')}
        </Button>
      </div>
      <Problem error={leave.error} />
    </section>
  )
}
