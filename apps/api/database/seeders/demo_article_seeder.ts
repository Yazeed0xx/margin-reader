import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

import Article from '#models/article'
import Bookmark from '#models/bookmark'
import Follow from '#models/follow'
import ResourceAccess from '#models/resource_access'
import User from '#models/user'
import ArticlePublishingService from '#services/article_publishing_service'
import ResourceIngestionService from '#services/resource_ingestion_service'

import type Resource from '#models/resource'
import type { ArticleContent, ArticleInput } from '#validators/article'

type Block = ArticleContent['blocks'][number]
interface Demo {
  key: string
  author: number
  title: string
  language?: 'en' | 'ar'
  draft?: boolean
  blocks: Block[]
  sources?: { block: string; resource: number; note: string; seconds?: number }[]
}
const paragraph = (id: string, text: string): Block => ({ id, type: 'paragraph', text })
const heading = (id: string, text: string): Block => ({ id, type: 'heading', level: 2, text })

// Original demo writing, not extracted or attributed to the linked source authors.
const essays: Demo[] = [
  {
    key: 'slow-reading',
    author: 0,
    title: 'The quiet pleasure of reading one thing at a time',
    blocks: [
      paragraph(
        'intro',
        'This morning I opened an essay and decided to finish it before opening anything else. No collection of tabs, no messages beside the text, no promise to return later. Just a small experiment in giving one idea enough time.',
      ),
      paragraph(
        'attention',
        'The difficult part was not understanding the argument. It was resisting the urge to follow every interesting detour immediately. A reference can enrich a paragraph, but it can also become the moment we lose the paragraph entirely.',
      ),
      {
        id: 'quote',
        type: 'quote',
        text: 'A useful reference should deepen the thought you are already holding.',
      },
      heading('practice', 'A small practice'),
      paragraph(
        'finish',
        'Read a section. Pause. Look at its source if the claim deserves a closer look. Then return to the sentence that made you curious. This is not a rule about how fast anyone should read; it is an invitation to notice what helps an idea stay with you.',
      ),
    ],
  },
  {
    key: 'research-notebook',
    author: 1,
    title: 'A research notebook: reading a paper before forming an opinion',
    blocks: [
      paragraph(
        'intro',
        'This is a demonstration research notebook. It separates what a paper says, what a reader infers, and what still needs checking. The linked paper is a real source; the questions below are an example reading workflow.',
      ),
      heading('question', 'Begin with a question'),
      paragraph(
        'paper',
        'Before reading Attention Is All You Need, write down the question you want the paper to answer. Keep that question visible while exploring the source below. A famous title is not a substitute for reading the methods and limitations.',
      ),
      {
        id: 'checks',
        type: 'bulletList',
        items: [
          'What problem do the authors set out to solve?',
          'Which assumptions shape the experiment?',
          'What evidence would change my interpretation?',
          'Which conclusions are mine rather than the authors’ claims?',
        ],
      },
      heading('notes', 'Keep observations separate from conclusions'),
      paragraph(
        'method',
        'One column in a notebook can contain direct observations. Another can contain interpretations. When the two begin to blur, return to the relevant passage. This small habit makes it easier to revise an opinion without rewriting the evidence.',
      ),
      {
        id: 'caution',
        type: 'quote',
        text: 'A confident summary can still hide an unanswered question.',
      },
      paragraph(
        'end',
        'The point of this note is not to settle the paper’s contribution. It is to create a place where questions, evidence, and uncertainty can sit together.',
      ),
    ],
    sources: [
      {
        block: 'paper',
        resource: 1,
        note: 'Open the paper’s preview here while keeping the research question in view.',
      },
    ],
  },
  {
    key: 'video-notebook',
    author: 0,
    title: 'Watch a moment, then return to the thought',
    blocks: [
      paragraph(
        'intro',
        'Video references often ask the reader to switch contexts completely. This demo places two moments from the same video in different parts of an essay, so you can try opening, watching, collapsing, and reopening each citation.',
      ),
      heading('first', 'The first moment'),
      paragraph(
        'video-one',
        'Open the reference below and choose to load the player. This citation starts fifteen seconds into the video. The paragraph stays on the page while the player appears underneath it.',
      ),
      paragraph(
        'bridge',
        'After watching, collapse the source and continue here. A video should support the argument without turning the rest of the essay into background content.',
      ),
      heading('second', 'Return to a different moment'),
      paragraph(
        'video-two',
        'This second citation starts later in the same video. Each reference keeps its own playback position while the app remains open. Try both references to compare how the two moments fit into the surrounding text.',
      ),
      paragraph(
        'end',
        'An embedded player can still be unavailable because of provider or video settings. The article remains readable either way.',
      ),
    ],
    sources: [
      {
        block: 'video-one',
        resource: 0,
        note: 'A sample YouTube embed, starting at 0:15.',
        seconds: 15,
      },
      {
        block: 'video-two',
        resource: 0,
        note: 'The same video referenced from a later paragraph, starting at 0:45.',
        seconds: 45,
      },
    ],
  },
  {
    key: 'technical-guide',
    author: 1,
    title: 'A tiny fetch example, with room for the explanation',
    blocks: [
      paragraph(
        'intro',
        'Code is easier to discuss when it remains part of the surrounding explanation. This demo mixes headings, code, numbered steps, and an external documentation reference.',
      ),
      heading('request', 'Make the request explicit'),
      paragraph(
        'docs',
        'The Fetch API gives this example its request and response interface. Consult the linked documentation for details, then return to the small function below.',
      ),
      {
        id: 'code',
        type: 'code',
        direction: 'ltr',
        text: "async function loadEssay(id) {\n  const response = await fetch(`/api/v1/articles/${id}`)\n  if (!response.ok) {\n    throw new Error('The essay could not be loaded')\n  }\n  const { data } = await response.json()\n  return data\n}",
      },
      {
        id: 'steps',
        type: 'orderedList',
        items: [
          'Request the essay using its identifier.',
          'Check the HTTP response before reading the body.',
          'Extract the data envelope.',
          'Let the interface explain failures and offer a retry.',
        ],
      },
      paragraph(
        'end',
        'This is intentionally a small example. Authentication, cancellation, caching, and retries belong in the application’s wider request layer. The source stays close to the explanation so a reader can investigate those details without losing the example.',
      ),
    ],
    sources: [
      {
        block: 'docs',
        resource: 2,
        note: 'MDN’s Fetch API reference provides the background for this code example.',
      },
    ],
  },
  {
    key: 'reading-checklist',
    author: 2,
    title: 'Five questions to ask before publishing an essay',
    blocks: [
      paragraph(
        'intro',
        'A short checklist can be more useful than another long guide. These questions focus on how the essay feels to the person reading it for the first time.',
      ),
      {
        id: 'questions',
        type: 'orderedList',
        items: [
          'Can a reader tell what the opening paragraph is promising?',
          'Does every section move the thought forward?',
          'Are references attached to the claims they help explain?',
          'Can someone understand the essay without playing every video?',
          'Does the ending leave the reader with something specific to consider?',
        ],
      },
      heading('access', 'Try it with a keyboard'),
      paragraph(
        'accessibility',
        'Move through the article without a pointer. Open a source, close it, and continue. Check whether focus tells you where you are. The accessibility reference below is a useful starting point for a more complete review.',
      ),
      {
        id: 'reminder',
        type: 'bulletList',
        items: [
          'Read at a narrow screen width.',
          'Check the article with larger text.',
          'Review labels and focus states.',
          'Try both short and long source notes.',
        ],
      },
      paragraph(
        'end',
        'The checklist is not a score. It is a way to find the one change that will make this particular essay easier to follow.',
      ),
    ],
    sources: [
      {
        block: 'accessibility',
        resource: 3,
        note: 'Use the WCAG overview as a starting point for accessibility guidance.',
      },
    ],
  },
  {
    key: 'arabic-essay',
    author: 2,
    title: 'كيف نقرأ فكرة دون أن نفقد خيطها؟',
    language: 'ar',
    blocks: [
      paragraph(
        'intro',
        'أحيانًا نبدأ قراءة مقال لأن سؤالًا واحدًا أثار فضولنا، ثم نجد أنفسنا أمام عشر علامات تبويب ولا نتذكر السؤال الأول. هذه مقالة تجريبية لاختبار القراءة العربية والمراجع التي تظهر داخل النص.',
      ),
      heading('place', 'للمصدر مكان في الحكاية'),
      paragraph(
        'source',
        'حين يشير الكاتب إلى بحث أو فيديو، نحتاج إلى فهم سبب وجوده هنا. الملاحظة القصيرة بجانب المرجع تساعد القارئ على تحديد ما يبحث عنه قبل أن يستكشف التفاصيل.',
      ),
      {
        id: 'quote',
        type: 'quote',
        text: 'ليست جودة القراءة في عدد الروابط التي نفتحها، بل في وضوح الفكرة التي نعود بها.',
      },
      {
        id: 'steps',
        type: 'orderedList',
        items: [
          'اقرأ الفقرة حتى نهايتها.',
          'افتح المصدر إذا كان يساعدك على فهم الادعاء.',
          'لاحظ ما يضيفه المصدر إلى الفكرة.',
          'أغلقه وتابع المقال من الموضع نفسه.',
        ],
      },
      paragraph(
        'video',
        'جرّب فتح الفيديو التالي. سيظهر المشغّل تحت هذه الفقرة، ويمكنك العودة إليها بعد المشاهدة. الهدف من المثال هو اختبار اتجاه النص وسهولة التفاعل على الهاتف.',
      ),
      paragraph(
        'end',
        'حين تبقى الفكرة والمصدر في مكان واحد، يصبح الانتقال بينهما قرارًا صغيرًا وواضحًا. لا نحتاج إلى أن يكون كل شيء ظاهرًا في الوقت نفسه؛ نحتاج إلى أن تظهر التفاصيل في موضعها المناسب.',
      ),
    ],
    sources: [
      {
        block: 'video',
        resource: 0,
        note: 'فيديو تجريبي لاختبار المشاهدة داخل المقال العربي.',
        seconds: 15,
      },
    ],
  },
  {
    key: 'mixed-language',
    author: 2,
    title: 'ملاحظات عربية حول مثال برمجي صغير',
    language: 'ar',
    blocks: [
      paragraph(
        'intro',
        'تجمع هذه الملاحظة بين الشرح العربي وشفرة تُقرأ من اليسار إلى اليمين. الغرض هو اختبار اتجاه كل جزء من المقال دون تغيير اتجاه الصفحة كلها.',
      ),
      heading('example', 'مثال قصير'),
      {
        id: 'code',
        type: 'code',
        direction: 'ltr',
        text: "const readingState = {\n  articleId: 42,\n  blockId: 'opening',\n  blockProgress: 0.5,\n}\n\nconsole.log(readingState.blockId)",
      },
      {
        id: 'english',
        type: 'paragraph',
        direction: 'ltr',
        text: 'This paragraph deliberately uses left-to-right text inside an Arabic essay. The reader should be able to follow both without the interface changing language.',
      },
      paragraph(
        'docs',
        'يمكنك فتح المرجع البرمجي هنا، ثم متابعة قراءة الشرح العربي. راقب موضع زر المصدر عند فتحه وإغلاقه على شاشة صغيرة.',
      ),
      {
        id: 'list',
        type: 'bulletList',
        items: [
          'النص العربي يحافظ على اتجاهه.',
          'الشفرة تحافظ على المسافات والأسطر.',
          'المراجع لا تغطي الفقرة الأصلية.',
        ],
      },
    ],
    sources: [{ block: 'docs', resource: 2, note: 'مرجع خارجي باللغة الإنجليزية داخل مقال عربي.' }],
  },
  {
    key: 'long-form',
    author: 0,
    title: 'An afternoon with one question: notes on a slower web',
    blocks: [
      paragraph(
        'intro',
        'This longer demo essay is designed for testing reading progress, reopening sources, and returning after a reload. Its argument is simple: an interface can leave room for curiosity without constantly asking the reader to change direction.',
      ),
      ...[
        [
          'The invitation',
          'A good opening gives a reader a reason to stay. It does not have to announce everything that follows. A small, specific question can be enough to create momentum. The interface around that question should make space for it rather than compete with it.',
        ],
        [
          'The first detour',
          'A source appears halfway through a paragraph. There is a choice to make: continue reading or investigate. Neither choice should feel like abandoning the other. Keeping the reference nearby lets the reader decide how much detail the moment deserves.',
        ],
        [
          'The shape of evidence',
          'Different kinds of evidence ask for different kinds of attention. A short quotation may need a few seconds. A method section may need several minutes. A video may require sound, captions, and a deliberate pause. A single enormous preview is unlikely to serve all three equally well.',
        ],
        [
          'A place to return',
          'Reading is not always continuous. A message arrives, the train stops, or an appointment begins. Returning should be a simple act of recognition: this is the paragraph I was considering. Saving a block and a position within it can support that recognition.',
        ],
        [
          'What a note adds',
          'The writer’s note beside a source is a chance to explain relevance. Instead of repeating a title, it can tell the reader which question to carry into the reference. That note is part of the essay’s argument, even when the source itself belongs to another author.',
        ],
        [
          'The smaller screen',
          'On a phone, space is especially visible. A panel that covers most of the article can make the reader feel that they have entered another place. An inline section uses the same direction of travel as the essay: down the page, with a clear way to continue.',
        ],
        [
          'A pause for video',
          'Watching a clip changes the rhythm of reading. That is not necessarily a problem. The important part is that the reader chooses the change. A still, quiet invitation to play is often enough; the player can wait until it is wanted.',
        ],
        [
          'The reader’s own pace',
          'Some readers investigate every reference. Others finish the essay and return later. A useful design does not force either pattern. It gives both readers a clear path and lets the amount of detail respond to their choices.',
        ],
        [
          'Leaving things unfinished',
          'A draft is a place to think before the thought is settled. The writing surface should allow an unfinished paragraph without turning the whole page into an error. Saving the text that exists is different from deciding that the essay is ready to publish.',
        ],
        [
          'The last paragraph',
          'A slower web is not only a question of speed. It is also a question of continuity. When a source, a sentence, and a reader’s place stay connected, there is less work involved in returning to an idea. This final paragraph is a useful point for testing saved reading progress.',
        ],
      ].flatMap(([title, text], index) => [
        heading(`section-${index}`, title!),
        paragraph(`body-${index}`, text!),
      ]),
    ],
    sources: [
      {
        block: 'body-1',
        resource: 1,
        note: 'A real paper preview used to test a reading detour in a longer essay.',
      },
      {
        block: 'body-5',
        resource: 3,
        note: 'Accessibility guidance is useful when considering how people navigate a document.',
      },
      {
        block: 'body-6',
        resource: 0,
        note: 'Try watching a short section, then collapse the source and continue reading.',
        seconds: 30,
      },
    ],
  },
  {
    key: 'draft-workshop',
    author: 0,
    title: 'Draft: a thought still taking shape',
    draft: true,
    blocks: [
      paragraph(
        'intro',
        'This private demo draft is ready for you to edit. Change the title, split this paragraph with Enter, or attach a source.',
      ),
      heading('next', 'What I want to explore next'),
      {
        id: 'notes',
        type: 'bulletList',
        items: [
          'Find a concrete opening scene.',
          'Add a source that challenges the main claim.',
          'Write an ending after the argument is clearer.',
        ],
      },
    ],
  },
  {
    key: 'draft-arabic',
    author: 2,
    title: 'مسودة: فكرة تحتاج إلى مثال',
    language: 'ar',
    draft: true,
    blocks: [
      paragraph(
        'intro',
        'هذه مسودة عربية خاصة لتجربة الكتابة والحفظ التلقائي. يمكنك تغيير العنوان أو إضافة فقرة أو إرفاق مصدر قبل النشر.',
      ),
      paragraph(
        'next',
        'ما المثال الذي يجعل الفكرة أكثر وضوحًا؟ اكتب هنا مشهدًا قصيرًا ثم جرّب معاينة المقال.',
      ),
    ],
  },
]

export default class extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    const publishing = await app.container.make(ArticlePublishingService)
    const ingestion = await app.container.make(ResourceIngestionService)
    const authors = []
    for (const profile of [
      {
        email: 'maya@demo.test',
        fullName: 'Maya Bennett',
        bio: 'Demo writer · essays on reading, attention, and everyday ideas.',
        interfaceLanguage: 'en' as const,
      },
      {
        email: 'omar@demo.test',
        fullName: 'Omar Haddad',
        bio: 'Demo writer · research notebooks and approachable technology.',
        interfaceLanguage: 'en' as const,
      },
      {
        email: 'noura@demo.test',
        fullName: 'نورة السالم',
        bio: 'حساب تجريبي · أفكار عن القراءة والكتابة وتصميم التجارب.',
        interfaceLanguage: 'ar' as const,
      },
    ]) {
      authors.push(
        await User.firstOrCreate(
          { email: profile.email },
          { ...profile, password: 'MarginDemo123!' },
        ),
      )
    }
    const urls = [
      'https://www.youtube.com/watch?v=M7lc1UVf-VE',
      'https://arxiv.org/abs/1706.03762',
      'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API',
      'https://www.w3.org/WAI/standards-guidelines/wcag/',
    ]
    const resources: Resource[] = []
    for (const url of urls) {
      resources.push((await ingestion.ingest(authors[0]!.id, url)).resource)
    }
    for (const author of authors) {
      for (const resource of resources) {
        await ResourceAccess.firstOrCreate({ userId: author.id, resourceId: resource.id })
      }
    }
    let created = 0
    const published = []
    for (const demo of essays) {
      const author = authors[demo.author]!
      // Historical revisions retain this marker even if a tester edits the title or opening.
      const marker = `demo-${demo.key}-intro`
      const existing = await Article.query()
        .where('authorId', author.id)
        .whereHas('revisions', (query) => query.where('contentJson', 'like', `%"id":"${marker}"%`))
        .first()
      if (existing) {
        if (existing.publishedRevisionId) {
          published.push(existing)
        }
        continue
      }
      const input: ArticleInput = {
        title: demo.title,
        language: demo.language ?? 'en',
        content: {
          version: 1,
          blocks: demo.blocks.map((block) => ({ ...block, id: `demo-${demo.key}-${block.id}` })),
        },
        references: (demo.sources ?? []).map((source, index) => ({
          referenceKey: `demo-${demo.key}-source-${index}`,
          blockId: `demo-${demo.key}-${source.block}`,
          resourceId: resources[source.resource]!.id,
          commentary: source.note,
          selectedQuote: null,
          videoStartSeconds: source.seconds ?? null,
        })),
      }
      const article = await publishing.create(author.id, input)
      if (!demo.draft) {
        published.push(await publishing.publish(article.id, author.id, article.lockVersion))
      }
      created += 1
    }
    await Follow.firstOrCreate({ followerId: authors[0]!.id, writerId: authors[1]!.id })
    await Follow.firstOrCreate({ followerId: authors[0]!.id, writerId: authors[2]!.id })
    for (const article of published.slice(0, 3)) {
      await Bookmark.firstOrCreate({ userId: authors[0]!.id, articleId: article.id })
    }
    logger.info(
      { created, existing: essays.length - created, demoArticles: essays.length },
      'Demo articles seeded; existing articles preserved',
    )
  }
}
