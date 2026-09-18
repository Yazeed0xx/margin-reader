import { Blank, Loading, Problem, Pages, LanguageChoice } from '@/components/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { api, queryClient } from '@/lib/api'
import { useSession } from '@/lib/session'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowUpRight, ArrowRight, BookOpen, Feather } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import type { Data } from '@/lib/api'

export function ArticleRow({
  article,
  index = 0,
}: {
  article: Data.Article.Variants['toSummary']
  index?: number
}) {
  const { t, language } = useSession()
  return (
    <article className="article-row" dir={article.direction} lang={article.language}>
      <span className="article-number" aria-hidden="true">
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Link to={`/writers/${article.author.id}`} className="writer-link">
            {article.author.fullName ?? t('Writer', 'كاتب')}
          </Link>
          <span>·</span>
          <time>
            {article.publishedAt
              ? new Date(article.publishedAt).toLocaleDateString(language, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : ''}
          </time>
        </div>
        <h2>
          <Link to={`/articles/${article.id}`}>{article.title}</Link>
        </h2>
        <div className="flex items-center gap-3">
          <Badge variant="outline">{article.language === 'ar' ? 'العربية' : 'English'}</Badge>
          <Link className="read-link" to={`/articles/${article.id}`}>
            {t('Read essay', 'اقرأ المقال')}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  )
}
export function Discovery({
  mode = 'explore',
  authorId,
}: {
  mode?: 'explore' | 'feed' | 'saved'
  authorId?: number
}) {
  const { t, user } = useSession()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const rawLanguage = params.get('language') ?? user?.readingLanguage ?? 'both'
  const language = rawLanguage === 'ar' || rawLanguage === 'en' ? rawLanguage : 'both'
  const q = params.get('q') ?? ''
  const [search, setSearch] = useState(q)
  const query: {
    page: number
    perPage: number
    language: 'en' | 'ar' | 'both'
    q?: string
    authorId?: number
  } = {
    page,
    perPage: 12,
    language,
    ...(q.length >= 2 ? { q } : {}),
    ...(authorId ? { authorId } : {}),
  }
  const articles = useQuery({
    queryKey: ['discovery', mode, query, user?.id],
    queryFn: async () => {
      if (mode === 'saved') {
        const result = await api.profile.bookmarks.index({
          query: { page, perPage: 12 },
        })
        return {
          ...result,
          data: result.data.flatMap((item) => (item.article ? [item.article] : [])),
        }
      }
      return mode === 'feed' ? api.profile.feeds.index({ query }) : api.articles.index({ query })
    },
  })
  function filter(key: string, value: string) {
    setParams((previous) => {
      previous.set(key, value)
      previous.delete('page')
      return previous
    })
  }
  return (
    <section className={authorId ? '' : 'page'}>
      {!authorId && (
        <>
          <div className="hero">
            <div>
              <p className="eyebrow">
                {t('A little less noise. A little more thought.', 'ضجيج أقل. مساحة أكبر للفكر.')}
              </p>
              <h1>
                {mode === 'feed'
                  ? t('From your writers.', 'من كتّابك المفضّلين.')
                  : mode === 'saved'
                    ? t('Worth coming back to.', 'أفكار تستحق العودة.')
                    : t('Ideas worth staying with.', 'أفكار تستحق التأمّل.')}
              </h1>
              <p className="intro">
                {t(
                  'Essays, research, and the references behind them. Follow your curiosity without losing your place.',
                  'مقالات وأبحاث ومصادرها. اتبع فضولك دون أن تفقد موضع قراءتك.',
                )}
              </p>
            </div>
            <div className="hero-mark" aria-hidden="true">
              <BookOpen />
              <span>م / M</span>
            </div>
          </div>
          <Separator />
        </>
      )}
      <div className="discovery-tools">
        <h2 className="section-label">
          {authorId
            ? t('Published essays', 'المقالات المنشورة')
            : mode === 'saved'
              ? t('Your reading list', 'قائمة قراءتك')
              : t('The latest', 'أحدث الأفكار')}
        </h2>
        {mode !== 'saved' && (
          <LanguageChoice both value={language} onChange={(v) => filter('language', v)} />
        )}
      </div>
      {mode !== 'saved' && (
        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault()
            filter('q', search.trim())
          }}
        >
          <FieldGroup className="flex-row items-end">
            <Field>
              <FieldLabel htmlFor="search" className="sr-only">
                {t('Search essays', 'ابحث في المقالات')}
              </FieldLabel>
              <Input
                id="search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('Search titles and ideas…', 'ابحث عن عنوان أو فكرة…')}
                minLength={2}
                maxLength={200}
              />
            </Field>
            <Button type="submit" variant="outline">
              {t('Search', 'بحث')}
            </Button>
          </FieldGroup>
        </form>
      )}
      {articles.isPending && <Loading />}
      <Problem error={articles.error} retry={() => void articles.refetch()} />
      {articles.data && (
        <>
          {articles.data.data.length === 0 ? (
            <Blank
              title={t('Room for something good', 'مساحة لشيء يستحق')}
              description={
                mode === 'feed'
                  ? t('Follow a writer to find their essays here.', 'تابع كاتبًا لتظهر مقالاته هنا.')
                  : mode === 'saved'
                    ? t(
                        'Save an essay while reading. It will be waiting here.',
                        'احفظ مقالًا أثناء القراءة لتجده هنا.',
                      )
                    : t(
                        'No essays here yet. Try another search, or share the first idea.',
                        'لا توجد مقالات بعد. جرّب بحثًا آخر أو شارك أول فكرة.',
                      )
              }
            >
              <Button
                nativeButton={false}
                render={<Link to={mode === 'explore' ? '/write' : '/'} />}
              >
                {mode === 'explore'
                  ? t('Write an essay', 'اكتب مقالًا')
                  : t('Explore essays', 'استكشف المقالات')}
                <ArrowRight data-icon="inline-end" />
              </Button>
            </Blank>
          ) : (
            articles.data.data.map((article, index) => (
              <ArticleRow key={article.id} article={article} index={(page - 1) * 12 + index} />
            ))
          )}
          <Pages
            page={page}
            lastPage={Number(articles.data.metadata.lastPage)}
            onChange={(next) =>
              setParams((previous) => {
                previous.set('page', String(next))
                return previous
              })
            }
          />
        </>
      )}
    </section>
  )
}
export function FollowButton({ writerId }: { writerId: number }) {
  const { t, authenticated, user } = useSession()
  const state = useQuery({
    queryKey: ['follow', writerId, user?.id],
    queryFn: () => api.profile.follows.show({ params: { id: writerId } }),
    enabled: authenticated && user?.id !== writerId,
  })
  const mutation = useMutation({
    mutationFn: () =>
      state.data?.data.following
        ? api.profile.follows.destroy({ params: { id: writerId } })
        : api.profile.follows.store({ params: { id: writerId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['follow', writerId] })
      void queryClient.invalidateQueries({ queryKey: ['following'] })
      void queryClient.invalidateQueries({ queryKey: ['discovery', 'feed'] })
    },
  })
  if (user?.id === writerId) {
    return null
  }
  if (!authenticated) {
    return (
      <Button variant="outline" nativeButton={false} render={<Link to="/login" />}>
        {t('Follow writer', 'متابعة الكاتب')}
      </Button>
    )
  }
  return (
    <div>
      <Button
        variant="outline"
        onClick={() => mutation.mutate()}
        disabled={state.isPending || mutation.isPending || state.isError}
      >
        {state.data?.data.following
          ? t('Following · unfollow', 'متابَع · إلغاء المتابعة')
          : t('Follow writer', 'متابعة الكاتب')}
      </Button>
      <Problem error={mutation.error ?? state.error} />
    </div>
  )
}
export function Writer() {
  const { id } = useParams()
  const { t } = useSession()
  const writer = useQuery({
    queryKey: ['writer', id],
    queryFn: () => api.writers.show({ params: { id: id! } }),
  })
  if (writer.isPending) {
    return <Loading />
  }
  if (!writer.data) {
    return <Problem error={writer.error} />
  }
  return (
    <section className="page">
      <div className="writer-hero">
        <p className="eyebrow">{t('The writer', 'الكاتب')}</p>
        <h1>{writer.data.data.fullName ?? t('Writer', 'كاتب')}</h1>
        <p className="intro whitespace-pre-wrap">{writer.data.data.bio}</p>
        <FollowButton writerId={writer.data.data.id} />
      </div>
      <Separator />
      <Discovery authorId={writer.data.data.id} />
    </section>
  )
}
export function Drafts() {
  const { t, user } = useSession()
  const [page, setPage] = useState(1)
  const result = useQuery({
    queryKey: ['drafts', page, user?.id],
    queryFn: () => api.profile.articles.index({ query: { page, perPage: 12 } }),
  })
  return (
    <section className="page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t('Your writing desk', 'مكتب الكتابة')}</p>
          <h1>{t('Work in progress.', 'أفكار قيد الكتابة.')}</h1>
        </div>
        <Button nativeButton={false} render={<Link to="/write" />}>
          <Feather data-icon="inline-start" />
          {t('New essay', 'مقال جديد')}
        </Button>
      </div>
      <Separator />
      {result.isPending && <Loading />}
      <Problem error={result.error} />
      {result.data && (
        <>
          {result.data.data.map((article) => (
            <article key={article.id} className="draft-row">
              <div>
                <h2>
                  <Link to={`/write/${article.id}`}>{article.draft?.title}</Link>
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t('Last edited', 'آخر تعديل')}{' '}
                  {new Date(article.updatedAt!).toLocaleDateString()}
                </p>
              </div>
              <Badge variant="outline">
                {article.publishedAt
                  ? article.hasUnpublishedChanges
                    ? t('Unpublished changes', 'تعديلات غير منشورة')
                    : t('Published', 'منشور')
                  : t('Draft', 'مسودة')}
              </Badge>
            </article>
          ))}
          {result.data.data.length === 0 && (
            <Blank
              title={t('Start with a thought', 'ابدأ بفكرة')}
              description={t(
                'Your drafts stay private until you publish.',
                'تبقى مسوداتك خاصة حتى تنشرها.',
              )}
            />
          )}
          <Pages page={page} lastPage={Number(result.data.metadata.lastPage)} onChange={setPage} />
        </>
      )}
    </section>
  )
}
export function Following() {
  const { t, user } = useSession()
  const [page, setPage] = useState(1)
  const result = useQuery({
    queryKey: ['following', page, user?.id],
    queryFn: () => api.profile.follows.index({ query: { page, perPage: 20 } }),
  })
  return (
    <section className="page">
      <h1>{t('Writers you follow', 'الكتّاب الذين تتابعهم')}</h1>
      {result.isPending && <Loading />}
      <Problem error={result.error} />
      {result.data && (
        <>
          {result.data.data.map((item) => (
            <div className="draft-row" key={item.writer.id}>
              <Link to={`/writers/${item.writer.id}`}>
                {item.writer.fullName ?? t('Writer', 'كاتب')}
              </Link>
              <FollowButton writerId={item.writer.id} />
            </div>
          ))}
          {result.data.data.length === 0 && (
            <Blank
              title={t('Find your people', 'اكتشف كتّابك المفضّلين')}
              description={t(
                'Follow a writer from any essay or writer profile.',
                'تابع الكاتب من أي مقال أو من ملفه الشخصي.',
              )}
            />
          )}
          <Pages page={page} lastPage={Number(result.data.metadata.lastPage)} onChange={setPage} />
        </>
      )}
    </section>
  )
}
