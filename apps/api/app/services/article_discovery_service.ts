import Article from '#models/article'
import Follow from '#models/follow'

import type { ArticleInput, DiscoveryInput } from '#validators/article'

export default class ArticleDiscoveryService {
  normalize(text: string) {
    return text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
  }

  searchText(input: ArticleInput) {
    return this.normalize(
      [
        input.title,
        ...input.content.blocks.map((block) =>
          'text' in block ? block.text : block.items.join(' '),
        ),
      ].join(' '),
    )
  }

  async list(input: DiscoveryInput, followerId?: number) {
    const { page = 1, perPage = 20, language, authorId, q } = input
    const query = Article.query()
      .whereNotNull('publishedRevisionId')
      .preload('publishedRevision', (revision) => revision.select(['id', 'title', 'language']))
      .preload('author')
    if (followerId !== undefined) {
      query.whereIn('authorId', Follow.query().where('followerId', followerId).select('writerId'))
    }
    if (authorId) {
      query.where('authorId', authorId)
    }
    if ((language && language !== 'both') || q) {
      query.whereHas('publishedRevision', (revision) => {
        if (language && language !== 'both') {
          revision.where('language', language)
        }
        // SQLite instr gives literal substring matching: %, _, quotes are not operators.
        // Lucid has no equivalent literal-contains primitive; both operands are bound.
        if (q) {
          revision.whereRaw('instr(??, ?) > 0', ['search_text', this.normalize(q)])
        }
      })
    }
    const articles = await query
      .orderBy('publishedAt', 'desc')
      .orderBy('id', 'desc')
      .paginate(page, perPage)
    articles
      .baseUrl(followerId === undefined ? '/api/v1/articles' : '/api/v1/account/feed')
      .queryString({
        perPage,
        ...(language ? { language } : {}),
        ...(authorId ? { authorId } : {}),
        ...(q ? { q } : {}),
      })
    return articles
  }
}
