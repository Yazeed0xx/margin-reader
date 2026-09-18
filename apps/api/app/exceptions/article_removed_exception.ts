import { Exception } from '@adonisjs/core/exceptions'
export default class ArticleRemovedException extends Exception {
  static status = 403
  static code = 'E_ARTICLE_REMOVED'
  static message = 'This article was removed by moderation and cannot be republished.'
}
