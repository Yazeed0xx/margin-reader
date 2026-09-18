import { Loading, Problem } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { api, queryClient } from '@/lib/api'
import { useSession } from '@/lib/session'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Bookmark, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useParams } from 'react-router-dom'

import { FollowButton } from './discovery'
import { ReportArticle } from './report'
import { SourceBody } from './source'

import type { Data } from '@/lib/api'

export type Block = Data.Article['content']['blocks'][number]
export function BlockText({ block }: { block: Block }) {
  switch (block.type) {
    case 'heading': {
      const Heading = `h${block.level}` as 'h2' | 'h3' | 'h4'
      return <Heading>{block.text}</Heading>
    }
    case 'quote':
      return <blockquote>{block.text}</blockquote>
    case 'code':
      return (
        <pre dir="ltr">
          <code>{block.text}</code>
        </pre>
      )
    case 'bulletList':
      return (
        <ul>
          {block.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      )
    case 'orderedList':
      return (
        <ol>
          {block.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ol>
      )
    default:
      return <p>{block.text}</p>
  }
}
function ReadingPosition({ article, paused }: { article: Data.Article; paused: boolean }) {
  const { t, user } = useSession()
  const position = useQuery({
    queryKey: ['progress', article.id, user?.id],
    queryFn: () => api.profile.readingProgresses.show({ params: { id: article.id } }),
    staleTime: 0,
  })
  const [started, setStarted] = useState(false)
  const [saved, setSaved] = useState(false)
  const version = useRef<number | undefined>(undefined)
  const busy = useRef(false)
  const [error, setError] = useState<unknown>(null)
  useEffect(() => {
    if (position.data) {
      version.current = position.data.data?.lockVersion ?? 0
    }
  }, [position.data])
  useEffect(() => {
    if (paused || error || version.current === undefined) {
      return
    }
    let timer: number | undefined
    function save() {
      if (busy.current || document.hidden) {
        return
      }
      const blocks = Array.from(document.querySelectorAll<HTMLElement>('[data-reading-block]'))
      const block = blocks.find((el) => el.getBoundingClientRect().bottom > 120)
      if (!block) {
        return
      }
      const rect = block.getBoundingClientRect()
      busy.current = true
      void api.profile.readingProgresses
        .update({
          params: { id: article.id },
          body: {
            expectedVersion: version.current!,
            revisionId: article.revisionId,
            blockId: block.dataset.readingBlock!,
            blockProgress: Math.min(1, Math.max(0, (120 - rect.top) / Math.max(1, rect.height))),
          },
        })
        .then((result) => {
          version.current = result.data.lockVersion
          setSaved(true)
        })
        .catch(setError)
        .finally(() => {
          busy.current = false
        })
    }
    function scroll() {
      setStarted(true)
      clearTimeout(timer)
      timer = window.setTimeout(save, 1200)
    }
    window.addEventListener('scroll', scroll, { passive: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', scroll)
    }
  }, [article.id, article.revisionId, paused, error, position.data])
  function begin(resume: boolean) {
    const old = position.data?.data
    if (resume && old?.blockId) {
      const block = document.getElementById(`block-${old.blockId}`)
      if (block) {
        window.scrollTo({
          top:
            window.scrollY +
            block.getBoundingClientRect().top +
            block.getBoundingClientRect().height * old.blockProgress -
            120,
          behavior: 'instant',
        })
      }
    }
    setStarted(true)
  }
  if (position.isPending) {
    return null
  }
  return (
    <div className="reading-position">
      <Problem
        error={position.error ?? error}
        retry={() => {
          setError(null)
          setStarted(false)
          void position.refetch()
        }}
      />
      {!started &&
        position.data?.data?.blockId &&
        article.content.blocks.some((b) => b.id === position.data?.data?.blockId) && (
          <Button size="sm" variant="ghost" onClick={() => begin(true)}>
            {t('Resume reading', 'متابعة القراءة')}
          </Button>
        )}
      {started && (
        <output className="text-xs text-muted-foreground">
          {saved
            ? t('Reading position saved', 'تم حفظ موضع القراءة')
            : t('Your position will save as you read', 'سيُحفظ موضعك أثناء القراءة')}
        </output>
      )}
    </div>
  )
}
export function Reader() {
  const { id } = useParams()
  const article = useQuery({
    queryKey: ['article', id],
    queryFn: () => api.articles.show({ params: { id: id! } }),
  })
  if (article.isPending) {
    return <Loading />
  }
  if (!article.data) {
    return <Problem error={article.error} retry={() => void article.refetch()} />
  }
  return <ArticleReader key={article.data.data.revisionId} article={article.data.data} />
}
function ArticleReader({ article }: { article: Data.Article }) {
  const { t, authenticated, user } = useSession()
  const [openSources, setOpenSources] = useState<Set<string>>(new Set())
  const bookmark = useQuery({
    queryKey: ['bookmark', article.id, user?.id],
    queryFn: () => api.profile.bookmarks.show({ params: { id: article.id } }),
    enabled: authenticated,
  })
  const save = useMutation({
    mutationFn: () =>
      bookmark.data?.data.bookmarked
        ? api.profile.bookmarks.destroy({ params: { id: article.id } })
        : api.profile.bookmarks.store({ params: { id: article.id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookmark', article.id] })
      void queryClient.invalidateQueries({ queryKey: ['discovery', 'saved'] })
    },
  })
  return (
    <section className="reader-page">
      <div className="reader-top">
        <Link to="/">{t('← All essays', 'كل المقالات ←')}</Link>
        <span>
          {article.references.length} {t('sources', 'مصادر')}
        </span>
      </div>
      <article lang={article.language} dir={article.direction}>
        <header className="article-header">
          <p className="eyebrow">{t('Essay', 'مقال')}</p>
          <h1>{article.title}</h1>
          <div className="article-byline">
            <div>
              <Link to={`/writers/${article.author.id}`}>
                {article.author.fullName ?? t('Writer', 'كاتب')}
              </Link>
              <p className="text-sm text-muted-foreground">
                {article.publishedAt
                  ? new Date(article.publishedAt).toLocaleDateString(article.language, {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : ''}
              </p>
            </div>
            <FollowButton writerId={article.author.id} />
          </div>
        </header>
        <Separator />
        <div className="reader-actions">
          {authenticated ? (
            <Button
              variant="ghost"
              disabled={save.isPending || bookmark.isPending || bookmark.isError}
              onClick={() => save.mutate()}
            >
              <Bookmark data-icon="inline-start" />
              {bookmark.data?.data.bookmarked
                ? t('Saved · remove', 'محفوظ · إزالة')
                : t('Save for later', 'احفظ للقراءة لاحقًا')}
            </Button>
          ) : (
            <Button variant="ghost" nativeButton={false} render={<Link to="/login" />}>
              <Bookmark data-icon="inline-start" />
              {t('Sign in to save', 'سجّل الدخول للحفظ')}
            </Button>
          )}
          <span>
            {t('Explore a source right where it belongs.', 'استكشف المصدر في موضعه من المقال.')}
          </span>
        </div>
        <Problem error={save.error ?? bookmark.error} />
        {authenticated && (
          <ReadingPosition key={user?.id} article={article} paused={openSources.size > 0} />
        )}
        <div className="article-document">
          {article.content.blocks.map((block) => (
            <section
              key={block.id}
              dir={block.direction ?? article.direction}
              className="reading-block"
            >
              <div className="prose" id={`block-${block.id}`} data-reading-block={block.id}>
                <BlockText block={block} />
              </div>
              {article.references
                .filter((ref) => ref.blockId === block.id)
                .map((ref) => (
                  <InlineReference
                    key={ref.referenceKey}
                    articleId={article.id}
                    revisionId={article.revisionId}
                    reference={ref}
                    number={article.references.indexOf(ref) + 1}
                    onToggle={(open) =>
                      setOpenSources((old) => {
                        const next = new Set(old)
                        if (open) {
                          next.add(ref.referenceKey)
                        } else {
                          next.delete(ref.referenceKey)
                        }
                        return next
                      })
                    }
                  />
                ))}
            </section>
          ))}
        </div>
        <footer className="article-end">
          <ReportArticle articleId={article.id} />
          <br />
          <span aria-hidden="true">✳</span>
          <p>{t('A good place to pause.', 'هنا مساحة للتأمّل.')}</p>
          <Link to={`/writers/${article.author.id}`}>
            {t('More from this writer', 'المزيد من هذا الكاتب')}
          </Link>
        </footer>
      </article>
    </section>
  )
}

export function InlineReference({
  articleId,
  revisionId,
  privateResource = false,
  reference,
  number,
  onToggle,
}: {
  articleId: number
  revisionId: number
  privateResource?: boolean
  reference: Data.ArticleReference
  number: number
  onToggle?: (open: boolean) => void
}) {
  const { t } = useSession()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const anchor = useRef(0)
  function toggle() {
    const button = trigger.current
    if (!button) {
      return
    }
    if (!open) {
      anchor.current = button.getBoundingClientRect().top
    }
    flushSync(() => {
      setOpen(!open)
      onToggle?.(!open)
    })
    button.focus({ preventScroll: true })
    window.scrollBy({
      top: button.getBoundingClientRect().top - anchor.current,
      behavior: 'instant',
    })
  }
  return (
    <div className="inline-reference">
      <Button
        ref={trigger}
        className="citation"
        variant="ghost"
        size="sm"
        aria-label={t(`Source ${number}`, `مصدر ${number}`)}
        aria-expanded={open}
        aria-controls={`source-${reference.referenceKey}`}
        onClick={toggle}
      >
        <span className="citation-number" aria-hidden="true">
          {number}
        </span>{' '}
        {t('Source', 'مصدر')}
        <ChevronDown data-icon="inline-end" className={open ? 'rotate-180' : ''} />
      </Button>
      {open && (
        <section
          id={`source-${reference.referenceKey}`}
          className="inline-source"
          aria-label={t(`Source ${number}`, `مصدر ${number}`)}
        >
          <SourceBody
            articleId={articleId}
            revisionId={revisionId}
            privateResource={privateResource}
            reference={reference}
          />
          <div className="source-return">
            <Button variant="ghost" size="sm" onClick={toggle}>
              {t('Continue the essay', 'متابعة المقال')} ↑
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
