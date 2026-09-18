import { BasePolicy } from '@adonisjs/bouncer'

import type Article from '#models/article'
import type User from '#models/user'

export default class ArticlePolicy extends BasePolicy {
  viewDraft(user: User, article: Article) {
    return user.id === article.authorId
  }

  publish(user: User, article: Article) {
    return user.id === article.authorId
  }

  unpublish(user: User, article: Article) {
    return user.id === article.authorId
  }

  update(user: User, article: Article) {
    return user.id === article.authorId
  }

  delete(user: User, article: Article) {
    return user.id === article.authorId
  }
}
