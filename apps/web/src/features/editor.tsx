import { Loading, Problem, LanguageChoice } from '@/components/shared'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api, queryClient } from '@/lib/api'
import { useSession } from '@/lib/session'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Link2, Plus, Trash2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams, useLocation } from 'react-router-dom'

import { BlockText, InlineReference } from './reader'

import type { Block } from './reader'
import type { Data } from '@/lib/api'
import type { TextareaHTMLAttributes } from 'react'

type Reference = NonNullable<
  Parameters<typeof api.profile.articles.store>[0]['body']['references']
>[number]
function newBlock(): Block {
  return { id: crypto.randomUUID(), type: 'paragraph', text: '' }
}
export function Editor() {
  const { id } = useParams()
  const { state } = useLocation()
  const { user } = useSession()
  const draft = useQuery({
    queryKey: ['draft', id, user?.id],
    queryFn: () => api.profile.articles.show({ params: { id: id! } }),
    enabled: !!id,
    refetchOnMount: 'always',
  })
  if (id && draft.isPending) {
    return <Loading />
  }
  if (id && !draft.data) {
    return <Problem error={draft.error} retry={() => void draft.refetch()} />
  }
  return (
    <WritingDesk
      key={`${user?.id}:${state?.editorKey ?? id ?? 'new'}`}
      initial={draft.data?.data}
    />
  )
}
function WritingDesk({ initial }: { initial?: Data.DraftArticle }) {
  const { t, user } = useSession()
  const navigate = useNavigate()
  const [record, setRecord] = useState(initial)
  const [title, setTitle] = useState(initial?.draft?.title ?? '')
  const [language, setLanguage] = useState<'en' | 'ar'>(initial?.draft?.language ?? 'en')
  const [blocks, setBlocks] = useState<Block[]>(initial?.draft?.content.blocks ?? [newBlock()])
  const [references, setReferences] = useState<Reference[]>(initial?.draft?.references ?? [])
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(false)
  const editVersion = useRef(0)
  const [activeBlock, setActiveBlock] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [attach, setAttach] = useState<string | null>(null)
  const blocker = useBlocker(() => dirtyRef.current)
  function changed() {
    editVersion.current += 1
    dirtyRef.current = true
    setDirty(true)
  }
  useEffect(() => {
    function leave(event: BeforeUnloadEvent) {
      if (dirtyRef.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', leave)
    return () => window.removeEventListener('beforeunload', leave)
  }, [])
  // A trailing empty paragraph is a writing affordance, not publishable content.
  // Keep it on the page while saving the text already written around it.
  const persistedBlocks = blocks.filter(
    (block) =>
      block.type !== 'paragraph' ||
      block.text.trim() ||
      references.some((ref) => ref.blockId === block.id),
  )
  const save = useMutation({
    mutationFn: async () => {
      const body = {
        title,
        language,
        content: { version: 1 as const, blocks: persistedBlocks },
        references,
      }
      const version = editVersion.current
      const result = await (record
        ? api.profile.articles.update({
            params: { id: record.id },
            body: { ...body, expectedVersion: record.lockVersion },
          })
        : api.profile.articles.store({ body }))
      return { result, version }
    },
    onSuccess: ({ result, version }) => {
      setRecord(result.data)
      const clean = editVersion.current === version
      dirtyRef.current = !clean
      setDirty(!clean)
      void queryClient.invalidateQueries({ queryKey: ['drafts'] })
      queryClient.setQueryData(['draft', String(result.data.id), user?.id], result)
      if (!initial && clean) {
        navigate(`/write/${result.data.id}`, {
          replace: true,
          state: { editorKey: 'new', preserveScroll: true },
        })
      }
    },
  })
  const publish = useMutation({
    mutationFn: (action: 'publish' | 'unpublish') =>
      api.profile.draftArticles[action]({
        params: { id: record!.id },
        body: { expectedVersion: record!.lockVersion },
      }),
    onSuccess: (result) => {
      setRecord(result.data)
      queryClient.setQueryData(['draft', String(result.data.id), user?.id], result)
      void queryClient.invalidateQueries({ queryKey: ['drafts'] })
      void queryClient.invalidateQueries({ queryKey: ['discovery'] })
      void queryClient.invalidateQueries({ queryKey: ['article'] })
    },
  })
  const pending = save.isPending || publish.isPending
  const saveReady =
    !!title.trim() &&
    persistedBlocks.length > 0 &&
    persistedBlocks.every((b) =>
      'text' in b ? !!b.text.trim() : b.items.length > 0 && b.items.every((item) => !!item.trim()),
    )
  const saveDraft = save.mutate
  useEffect(() => {
    if (!dirty || !saveReady || pending || save.isError || blocker.state === 'blocked' || attach) {
      return
    }
    const timer = window.setTimeout(() => saveDraft(), 1800)
    return () => window.clearTimeout(timer)
  }, [
    title,
    language,
    blocks,
    references,
    dirty,
    saveReady,
    pending,
    save.isError,
    saveDraft,
    blocker.state,
    attach,
  ])
  function focusBlock(id: string, offset = 0) {
    requestAnimationFrame(() => {
      const input = document.getElementById(`edit-${id}`) as HTMLTextAreaElement | null
      input?.focus()
      input?.setSelectionRange(offset, offset)
    })
  }
  function updateBlock(id: string, block: Block) {
    setBlocks((old) => old.map((item) => (item.id === id ? block : item)))
    changed()
  }
  function move(index: number, offset: number) {
    setBlocks((old) => {
      const next = [...old]
      ;[next[index], next[index + offset]] = [next[index + offset]!, next[index]!]
      return next
    })
    changed()
  }
  function download() {
    const blob = new Blob(
      [JSON.stringify({ title, language, content: { version: 1, blocks }, references }, null, 2)],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'essay-draft.json'
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <section className="editor-page">
      <div className="editor-toolbar">
        <Link to="/drafts">{t('← Writing desk', 'مكتب الكتابة ←')}</Link>
        <div className="flex flex-wrap gap-2 items-center">
          <output className="text-sm text-muted-foreground">
            {save.isPending
              ? t('Saving…', 'جارٍ الحفظ…')
              : dirty
                ? t('Unsaved edits', 'تعديلات غير محفوظة')
                : record
                  ? t('Saved', 'محفوظ')
                  : t('New draft', 'مسودة جديدة')}
          </output>
          <Button variant="outline" onClick={() => setPreview(!preview)}>
            {preview ? t('Edit', 'تعديل') : t('Preview', 'معاينة')}
          </Button>
          <Button onClick={() => save.mutate()} disabled={pending || !saveReady}>
            {save.isPending ? t('Saving…', 'جارٍ الحفظ…') : t('Save draft', 'حفظ المسودة')}
          </Button>
        </div>
      </div>
      {blocker.state === 'blocked' && (
        <Alert>
          <AlertTitle>{t('Keep your unsaved work?', 'هل تريد الاحتفاظ بتعديلاتك؟')}</AlertTitle>
          <AlertDescription>
            <p>
              {t(
                'Save your draft before leaving, or discard these edits.',
                'احفظ المسودة قبل المغادرة أو تجاهل هذه التعديلات.',
              )}
            </p>
            <div className="flex gap-2">
              <Button onClick={() => blocker.reset()}>{t('Keep writing', 'متابعة الكتابة')}</Button>
              <Button variant="outline" onClick={() => blocker.proceed()}>
                {t('Discard & leave', 'تجاهل ومغادرة')}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      <Problem error={save.error ?? publish.error} />
      {(save.isError || publish.isError) && (
        <div className="flex flex-wrap gap-2 py-3">
          <Button variant="outline" onClick={download}>
            {t('Download your draft', 'تنزيل مسودتك')}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (
                window.confirm(
                  t(
                    'Reload the saved draft? Unsaved edits will be lost. Download them first if needed.',
                    'تحميل النسخة المحفوظة؟ ستفقد التعديلات غير المحفوظة. يمكنك تنزيلها أولًا.',
                  ),
                )
              ) {
                dirtyRef.current = false
                window.location.reload()
              }
            }}
          >
            {t('Reload saved version', 'تحميل النسخة المحفوظة')}
          </Button>
        </div>
      )}
      <fieldset disabled={publish.isPending} className="document-editor min-w-0">
        <FieldGroup>
          <Field hidden={preview}>
            <FieldLabel htmlFor="essay-title" className="sr-only">
              {t('Essay title', 'عنوان المقال')}
            </FieldLabel>
            <DocumentText
              className="document-title"
              id="essay-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                changed()
              }}
              maxLength={240}
              placeholder={t('An idea worth sharing', 'فكرة تستحق المشاركة')}
              dir="auto"
            />
          </Field>
          <Field className="document-language" hidden={preview}>
            <FieldLabel>{t('Essay language', 'لغة المقال')}</FieldLabel>
            <LanguageChoice
              value={language}
              onChange={(v) => {
                if (v !== 'both') {
                  setLanguage(v)
                  changed()
                }
              }}
            />
          </Field>
        </FieldGroup>
        {preview ? (
          <article className="preview" lang={language} dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <h1>{title}</h1>
            {blocks.map((block) => (
              <section key={block.id} dir={block.direction ?? (language === 'ar' ? 'rtl' : 'ltr')}>
                <div className="prose">
                  <BlockText block={block} />
                </div>
                {references
                  .filter((r) => r.blockId === block.id)
                  .map((ref) => (
                    <InlineReference
                      key={ref.referenceKey}
                      articleId={record?.id ?? 0}
                      revisionId={record?.draft?.id ?? 0}
                      privateResource
                      number={references.indexOf(ref) + 1}
                      reference={{
                        ...ref,
                        resourceId: Number(ref.resourceId),
                        commentary: ref.commentary ?? null,
                        selectedQuote: ref.selectedQuote ?? null,
                        videoStartSeconds:
                          ref.videoStartSeconds == null ? null : Number(ref.videoStartSeconds),
                      }}
                    />
                  ))}
              </section>
            ))}
          </article>
        ) : (
          <div className="editor-blocks">
            {blocks.map((block, index) => (
              <section
                className="editor-block"
                key={block.id}
                data-active={activeBlock === block.id}
                data-type={block.type}
                onFocus={() => setActiveBlock(block.id)}
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor={`edit-${block.id}`} className="sr-only">
                      {t(`Block ${index + 1}`, `الفقرة ${index + 1}`)}
                    </FieldLabel>
                    <DocumentText
                      id={`edit-${block.id}`}
                      className="document-paragraph"
                      placeholder={
                        index === 0
                          ? t('Start with a thought…', 'ابدأ بفكرة…')
                          : t('Keep writing…', 'تابع الكتابة…')
                      }
                      onKeyDown={(event) => {
                        if (event.nativeEvent.isComposing) {
                          return
                        }
                        const input = event.currentTarget
                        if (
                          event.key === 'Enter' &&
                          !event.shiftKey &&
                          block.type === 'paragraph' &&
                          blocks.length < 500
                        ) {
                          event.preventDefault()
                          const next = {
                            ...newBlock(),
                            text: input.value.slice(input.selectionEnd),
                          }
                          setBlocks((old) =>
                            old.flatMap((item) =>
                              item.id === block.id
                                ? [
                                    { ...block, text: input.value.slice(0, input.selectionStart) },
                                    next,
                                  ]
                                : [item],
                            ),
                          )
                          changed()
                          focusBlock(next.id)
                        } else if (
                          event.key === 'Backspace' &&
                          input.selectionStart === 0 &&
                          input.selectionEnd === 0 &&
                          index > 0
                        ) {
                          const previous = blocks[index - 1]!
                          if (previous.type !== 'paragraph' || block.type !== 'paragraph') {
                            return
                          }
                          event.preventDefault()
                          setBlocks((old) =>
                            old
                              .filter((item) => item.id !== block.id)
                              .map((item) =>
                                item.id === previous.id
                                  ? { ...previous, text: previous.text + block.text }
                                  : item,
                              ),
                          )
                          setReferences((old) =>
                            old.map((ref) =>
                              ref.blockId === block.id ? { ...ref, blockId: previous.id } : ref,
                            ),
                          )
                          changed()
                          focusBlock(previous.id, previous.text.length)
                        }
                      }}
                      rows={1}
                      maxLength={block.type === 'heading' ? 500 : 20000}
                      value={'text' in block ? block.text : block.items.join('\n')}
                      dir={block.direction ?? (language === 'ar' ? 'rtl' : 'ltr')}
                      onChange={(e) =>
                        updateBlock(
                          block.id,
                          'text' in block
                            ? { ...block, text: e.target.value }
                            : { ...block, items: e.target.value.split('\n') },
                        )
                      }
                    />
                    {'items' in block && (
                      <FieldDescription>
                        {t('One item per line.', 'عنصر واحد في كل سطر.')}
                      </FieldDescription>
                    )}
                  </Field>
                </FieldGroup>
                <div className="block-toolbar" inert={activeBlock !== block.id}>
                  <Select
                    value={block.type}
                    onValueChange={(value) => {
                      const text = 'text' in block ? block.text : block.items.join('\n')
                      if (value === 'bulletList' || value === 'orderedList') {
                        updateBlock(block.id, {
                          id: block.id,
                          type: value,
                          items: text.split('\n'),
                          direction: block.direction,
                        })
                      } else if (value === 'heading') {
                        updateBlock(block.id, {
                          id: block.id,
                          type: value,
                          level: 2,
                          text,
                          direction: block.direction,
                        })
                      } else if (value === 'paragraph' || value === 'quote' || value === 'code') {
                        updateBlock(block.id, {
                          id: block.id,
                          type: value,
                          text,
                          direction: block.direction,
                        })
                      }
                    }}
                  >
                    <SelectTrigger
                      aria-label={t(`Block ${index + 1} type`, `نوع الفقرة ${index + 1}`)}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="paragraph">{t('Paragraph', 'فقرة')}</SelectItem>
                        <SelectItem value="heading">{t('Heading', 'عنوان')}</SelectItem>
                        <SelectItem value="quote">{t('Quote', 'اقتباس')}</SelectItem>
                        <SelectItem value="code">{t('Code', 'شفرة')}</SelectItem>
                        <SelectItem value="bulletList">
                          {t('Bullet list', 'قائمة نقطية')}
                        </SelectItem>
                        <SelectItem value="orderedList">
                          {t('Numbered list', 'قائمة مرقّمة')}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t('Move up', 'نقل للأعلى')}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t('Move down', 'نقل للأسفل')}
                      disabled={index === blocks.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t('Remove block', 'حذف الفقرة')}
                      onClick={() => {
                        setBlocks((old) => old.filter((b) => b.id !== block.id))
                        setReferences((old) => old.filter((r) => r.blockId !== block.id))
                        changed()
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="block-references">
                  {references
                    .filter((r) => r.blockId === block.id)
                    .map((ref) => (
                      <div className="flex items-center gap-2" key={ref.referenceKey}>
                        <Badge variant="outline">
                          {t('Source', 'مصدر')} {references.indexOf(ref) + 1}
                        </Badge>
                        <span className="truncate text-sm">{ref.commentary}</span>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={t('Remove source', 'حذف المصدر')}
                          onClick={() => {
                            setReferences((old) =>
                              old.filter((r) => r.referenceKey !== ref.referenceKey),
                            )
                            changed()
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setAttach(block.id)}
                    disabled={references.length >= 100}
                  >
                    <Link2 data-icon="inline-start" />
                    {t('Add a source', 'أضف مصدرًا')}
                  </Button>
                </div>
                {attach === block.id && (
                  <section className="inline-source attach-source">
                    <div className="inline-source-heading">
                      <h3>{t('Give this thought a source', 'أضف مصدرًا لهذه الفكرة')}</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setAttach(null)
                          focusBlock(block.id)
                        }}
                      >
                        {t('Cancel', 'إلغاء')}
                      </Button>
                    </div>
                    <AttachSource
                      key={attach}
                      blockId={attach}
                      onAdd={(reference) => {
                        setReferences((old) => [...old, reference])
                        changed()
                        setAttach(null)
                        focusBlock(block.id)
                      }}
                    />
                  </section>
                )}
              </section>
            ))}
          </div>
        )}
        {!preview && (
          <Button
            variant="ghost"
            className="add-paragraph"
            disabled={blocks.length >= 500}
            onClick={() => {
              const next = newBlock()
              setBlocks((old) => [...old, next])
              changed()
              focusBlock(next.id)
            }}
          >
            <Plus data-icon="inline-start" />
            {t('Continue writing', 'تابع الكتابة')}
          </Button>
        )}
      </fieldset>
      {record?.removedAt && (
        <Alert>
          <AlertTitle>{t('Removed by moderation', 'تمت الإزالة بواسطة الإشراف')}</AlertTitle>
          <AlertDescription>{record.removalReason}</AlertDescription>
        </Alert>
      )}
      <div className="publish-bar">
        <div>
          <h2>
            {record?.publishedAt
              ? t('Your essay is live', 'مقالك منشور')
              : t('Ready for readers?', 'جاهز للقرّاء؟')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(
              'Your draft saves as you write. Publishing makes this version available to readers.',
              'تُحفظ المسودة أثناء الكتابة. النشر يتيح هذه النسخة للقرّاء.',
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={pending || dirty || !record || !!record.removedAt || blocks.length === 0}
            onClick={() => publish.mutate('publish')}
          >
            {record?.publishedAt
              ? t('Publish changes', 'نشر التعديلات')
              : t('Publish essay', 'نشر المقال')}
          </Button>
          {record?.publishedAt && (
            <>
              <Button
                variant="outline"
                disabled={pending || dirty}
                onClick={() => publish.mutate('unpublish')}
              >
                {t('Unpublish', 'إلغاء النشر')}
              </Button>
              <Button
                variant="ghost"
                nativeButton={false}
                render={<Link to={`/articles/${record.id}`} />}
              >
                {t('Read live essay', 'اقرأ المقال المنشور')}
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
function AttachSource({
  blockId,
  onAdd,
}: {
  blockId: string
  onAdd: (reference: Reference) => void
}) {
  const { t } = useSession()
  const [url, setUrl] = useState('')
  const [commentary, setCommentary] = useState('')
  const [quote, setQuote] = useState('')
  const [seconds, setSeconds] = useState(0)
  const ingest = useMutation({
    mutationFn: () => api.profile.resources.store({ body: { url } }),
    onSuccess: (result) => setSeconds(result.suggestedStartSeconds ?? 0),
  })
  const id = ingest.data?.data.id
  const resource = useQuery({
    queryKey: ['private-source', id],
    queryFn: () => api.profile.resources.show({ params: { id: id! } }),
    enabled: !!id,
    refetchInterval: (query) =>
      query.state.data?.data.processingStatus === 'pending' ? 3000 : false,
  })
  const data = resource.data?.data ?? ingest.data?.data
  return (
    <div className="source-body">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          ingest.mutate()
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="source-url">{t('Source URL', 'رابط المصدر')}</FieldLabel>
            <Input
              id="source-url"
              type="url"
              required
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                ingest.reset()
                setQuote('')
              }}
              placeholder="https://…"
              dir="ltr"
            />
          </Field>
          <Button type="submit" disabled={ingest.isPending}>
            {ingest.isPending ? t('Fetching…', 'جارٍ الجلب…') : t('Fetch source', 'جلب المصدر')}
          </Button>
        </FieldGroup>
      </form>
      <Problem error={ingest.error ?? resource.error} />
      {data && (
        <FieldGroup>
          <p dir="auto">{data.title ?? data.url}</p>
          <Badge variant="outline">
            {data.processingStatus === 'pending'
              ? t('Preparing preview', 'تجهيز المعاينة')
              : t('Source attached on save', 'يُرفق المصدر عند الحفظ')}
          </Badge>
          <Field>
            <FieldLabel htmlFor="commentary">
              {t('Why this source matters (optional)', 'أهمية هذا المصدر (اختياري)')}
            </FieldLabel>
            <Textarea
              id="commentary"
              value={commentary}
              onChange={(e) => setCommentary(e.target.value)}
              maxLength={5000}
            />
          </Field>
          {data.kind === 'video' && (
            <Field>
              <FieldLabel htmlFor="timestamp">
                {t('Start at (seconds)', 'ابدأ عند (بالثواني)')}
              </FieldLabel>
              <Input
                id="timestamp"
                type="number"
                min={0}
                max={604800}
                step={1}
                value={seconds}
                onChange={(e) => setSeconds(Number(e.target.value))}
              />
            </Field>
          )}
          {data.contentText && (
            <>
              <details>
                <summary>{t('Read source text', 'اقرأ نص المصدر')}</summary>
                <p className="source-text" dir="auto">
                  {data.contentText}
                </p>
              </details>
              <Field>
                <FieldLabel htmlFor="quote">
                  {t('Exact quote (optional)', 'اقتباس حرفي (اختياري)')}
                </FieldLabel>
                <Textarea
                  id="quote"
                  value={quote}
                  maxLength={2000}
                  onChange={(e) => setQuote(e.target.value)}
                />
                <FieldDescription>
                  {t(
                    'Copy a passage exactly from the source text.',
                    'انسخ مقتطفًا حرفيًا من نص المصدر.',
                  )}
                </FieldDescription>
              </Field>
            </>
          )}
          <Button
            disabled={
              (!!quote && (!data.contentText || !data.contentText.includes(quote.trim()))) ||
              !Number.isInteger(seconds) ||
              seconds < 0 ||
              seconds > 604800
            }
            onClick={() =>
              onAdd({
                blockId,
                resourceId: data.id,
                referenceKey: crypto.randomUUID(),
                commentary: commentary || null,
                selectedQuote: quote.trim() || null,
                videoStartSeconds: data.kind === 'video' ? seconds : null,
              })
            }
          >
            {t('Add to paragraph', 'أضف إلى الفقرة')}
          </Button>
        </FieldGroup>
      )}
    </div>
  )
}

// A plain-text document surface preserves the API's block format without HTML conversion.
function DocumentText(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const input = ref.current
    if (!input) {
      return
    }
    const resize = () => {
      input.style.height = '0px'
      input.style.height = `${input.scrollHeight}px`
    }
    resize()
    let width = input.parentElement?.getBoundingClientRect().width
    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width
      if (nextWidth !== width) {
        width = nextWidth
        resize()
      }
    })
    // Observe width changes, not the height changed by resize itself.
    if (input.parentElement) {
      observer.observe(input.parentElement)
    }
    return () => observer.disconnect()
  }, [props.value])
  return <textarea {...props} ref={ref} rows={1} />
}
