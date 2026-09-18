import { Loading, Problem } from '@/components/shared'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'
import { loadYouTube } from '@/lib/youtube'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { Data } from '@/lib/api'

const videoPositions = new Map<string, number>()
function Video({
  videoId,
  start,
  positionKey,
  title,
}: {
  videoId: string
  start: number
  positionKey: string
  title: string
}) {
  const { t } = useSession()
  const container = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    const host = container.current
    let active = true
    let player: YT.Player | undefined
    let interval: number | undefined
    function remember() {
      const time = player?.getCurrentTime?.()
      if (time && Number.isFinite(time)) {
        videoPositions.set(positionKey, time)
      }
    }
    void loadYouTube()
      .then((Youtube) => {
        if (!active || !container.current) {
          return
        }
        const mount = document.createElement('div')
        container.current.append(mount)
        player = new Youtube.Player(mount, {
          host: 'https://www.youtube-nocookie.com',
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 0,
            playsinline: 1,
            origin: window.location.origin,
            start: Math.floor(videoPositions.get(positionKey) ?? start),
          },
          events: {
            onReady: (event) => {
              event.target.getIframe().title = title
              event.target.getIframe().referrerPolicy = 'strict-origin-when-cross-origin'
            },
            onError: () => {
              if (active) {
                setError(true)
              }
            },
            onStateChange: remember,
          },
        })
        interval = window.setInterval(remember, 1000)
      })
      .catch(() => {
        if (active) {
          setError(true)
        }
      })
    return () => {
      active = false
      clearInterval(interval)
      remember()
      player?.destroy()
      host?.replaceChildren()
    }
  }, [videoId, start, positionKey, title])
  return (
    <>
      {error && (
        <Alert>
          <AlertTitle>
            {t('This video cannot play here', 'لا يمكن تشغيل هذا الفيديو هنا')}
          </AlertTitle>
          <AlertDescription>
            {t(
              'YouTube may restrict this video, or the connection may be unavailable. You can still read the essay.',
              'قد يكون الفيديو مقيّدًا أو الاتصال غير متاح. يمكنك متابعة قراءة المقال.',
            )}
          </AlertDescription>
        </Alert>
      )}
      <div ref={container} className="video-player" />
    </>
  )
}
export function SourceBody({
  articleId,
  revisionId,
  reference,
  privateResource = false,
}: {
  articleId: number
  revisionId: number
  reference: Data.ArticleReference
  privateResource?: boolean
}) {
  const { t } = useSession()
  const [watch, setWatch] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const args = {
    params: { id: articleId, referenceKey: reference.referenceKey },
    query: { revisionId },
  }
  const preview = useQuery({
    queryKey: ['source', privateResource, articleId, revisionId, reference.referenceKey],
    queryFn: async () =>
      privateResource
        ? {
            data: {
              resource: (await api.profile.resources.show({ params: { id: reference.resourceId } }))
                .data,
            },
          }
        : api.articleSources.show(args),
    refetchInterval: (query) =>
      query.state.data?.data.resource.processingStatus === 'pending' ? 4000 : false,
  })
  const resource = preview.data?.data.resource
  const content = useQuery({
    queryKey: ['source-content', privateResource, articleId, revisionId, reference.referenceKey],
    queryFn: async () =>
      privateResource
        ? {
            data: (await api.profile.resources.show({ params: { id: reference.resourceId } })).data,
          }
        : api.articleSources.content(args),
    enabled: expanded && resource?.displayPolicy === 'full_content',
  })
  return (
    <div className="source-body">
      <Problem error={preview.error} retry={() => void preview.refetch()} />
      {preview.isPending && <Loading />}
      {resource && (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              {resource.kind === 'video' ? t('Video', 'فيديو') : t('Source', 'مصدر')}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {resource.siteName ?? new URL(resource.url).hostname}
            </span>
          </div>
          <h2 dir="auto">{resource.title ?? t('External reference', 'مرجع خارجي')}</h2>
          {resource.creator && (
            <p className="text-sm text-muted-foreground" dir="auto">
              {resource.creator}
            </p>
          )}
          {reference.commentary && (
            <section>
              <h3 className="section-label">
                {t('Why the writer included this', 'لماذا أضافه الكاتب')}
              </h3>
              <p dir="auto" className="whitespace-pre-wrap">
                {reference.commentary}
              </p>
            </section>
          )}
          {reference.selectedQuote && <blockquote dir="auto">{reference.selectedQuote}</blockquote>}
          {resource.playback &&
            (watch ? (
              <Video
                videoId={resource.playback.videoId}
                start={reference.videoStartSeconds ?? 0}
                positionKey={`${articleId}:${revisionId}:${reference.referenceKey}`}
                title={resource.title ?? 'YouTube video'}
              />
            ) : (
              <div className="video-placeholder">
                <Play className="size-10" aria-hidden="true" />
                <p>{t('Watch without leaving the essay', 'شاهد دون مغادرة المقال')}</p>
                <Button onClick={() => setWatch(true)}>
                  <Play data-icon="inline-start" />
                  {t('Load YouTube player', 'تحميل مشغّل يوتيوب')}
                  {reference.videoStartSeconds
                    ? ` · ${Math.floor(reference.videoStartSeconds / 60)}:${String(reference.videoStartSeconds % 60).padStart(2, '0')}`
                    : ''}
                </Button>
                <p className="text-sm text-muted-foreground">
                  {t(
                    'Loads content from YouTube when you choose to watch.',
                    'يُحمّل محتوى من يوتيوب عندما تختار المشاهدة.',
                  )}
                </p>
              </div>
            ))}
          {resource.description && (
            <div>
              <p className="whitespace-pre-wrap" dir="auto">
                {descriptionExpanded || resource.description.length <= 360
                  ? resource.description
                  : `${resource.description.slice(0, 360)}…`}
              </p>
              {resource.description.length > 360 && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-expanded={descriptionExpanded}
                  onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                >
                  {descriptionExpanded
                    ? t('Less detail', 'تفاصيل أقل')
                    : t('More detail', 'تفاصيل أكثر')}
                </Button>
              )}
            </div>
          )}
          {resource.processingStatus === 'pending' && (
            <Alert>
              <AlertTitle>{t('Preparing this source', 'جارٍ تجهيز المصدر')}</AlertTitle>
              <AlertDescription>
                {t(
                  'The preview will appear when processing finishes.',
                  'ستظهر المعاينة عند اكتمال المعالجة.',
                )}
              </AlertDescription>
            </Alert>
          )}
          {resource.processingStatus === 'failed' && (
            <Alert>
              <AlertTitle>{t('Preview unavailable', 'المعاينة غير متاحة')}</AlertTitle>
              <AlertDescription>
                {t(
                  'The source could not be fetched. The original link is available below.',
                  'تعذّر جلب المصدر. الرابط الأصلي متاح أدناه.',
                )}
              </AlertDescription>
            </Alert>
          )}
          {resource.displayPolicy === 'metadata' && resource.processingStatus !== 'pending' && (
            <p className="text-sm text-muted-foreground">
              {t(
                'This source is available as a preview. Its full text cannot be displayed here.',
                'يتوفر هذا المصدر كمعاينة. لا يمكن عرض نصّه الكامل هنا.',
              )}
            </p>
          )}
          {resource.displayPolicy === 'full_content' && (
            <Button variant="ghost" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
              {expanded
                ? t('Show less', 'عرض أقل')
                : t('Read source text here', 'اقرأ نص المصدر هنا')}
            </Button>
          )}
          {expanded && content.isFetching && <Loading />}
          <Problem error={content.error} />
          {expanded && content.data?.data.contentText && (
            <div className="source-text" dir="auto">
              {content.data.data.contentText}
            </div>
          )}
          <Button
            variant="ghost"
            nativeButton={false}
            render={
              <a
                aria-label={t('Open original in a new tab', 'فتح الأصل في علامة تبويب جديدة')}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            {t('Open original in a new tab', 'فتح الأصل في علامة تبويب جديدة')}
            <ExternalLink data-icon="inline-end" />
          </Button>
        </>
      )}
    </div>
  )
}
