/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import app from '@adonisjs/core/services/app'
import router from '@adonisjs/core/services/router'

import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'
import {
  publicThrottle,
  authThrottle,
  accountThrottle,
  resourceThrottle,
  reportThrottle,
} from '#start/limiter'

router.get('/health/live', [controllers.HealthChecks, 'live'])
router.get('/health/ready', [controllers.HealthChecks, 'ready'])

router.get('/', () => ({ hello: 'world' }))

router
  .group(() => {
    router.resource('articles', controllers.Articles).only(['index', 'show'])
    router.get('articles/:id/sources/:referenceKey', [controllers.ArticleSources, 'show'])
    router.get('articles/:id/sources/:referenceKey/content', [
      controllers.ArticleSources,
      'content',
    ])
    router.resource('writers', controllers.Writers).only(['show'])

    router
      .group(() => {
        router.post('signup', [controllers.NewAccount, 'store'])
        router.post('login', [controllers.AccessTokens, 'store'])
      })
      .prefix('auth')
      .as('auth')
      .use(authThrottle)

    router
      .group(() => {
        router
          .resource('articles', controllers.DraftArticles)
          .only(['index', 'store', 'show', 'update'])
        router
          .get('articles/:id/preview', [controllers.DraftArticles, 'show'])
          .as('articles.preview')
        router.post('articles/:id/publish', [controllers.DraftArticles, 'publish'])
        router.post('articles/:id/unpublish', [controllers.DraftArticles, 'unpublish'])
        router.get('feed', [controllers.Feeds, 'index'])
        router.get('following', [controllers.Follows, 'index'])
        router.get('writers/:id/follow', [controllers.Follows, 'show'])
        router.put('writers/:id/follow', [controllers.Follows, 'store'])
        router.delete('writers/:id/follow', [controllers.Follows, 'destroy'])
        router.resource('bookmarks', controllers.Bookmarks).only(['index'])
        router.get('articles/:id/bookmark', [controllers.Bookmarks, 'show'])
        router.put('articles/:id/bookmark', [controllers.Bookmarks, 'store'])
        router.delete('articles/:id/bookmark', [controllers.Bookmarks, 'destroy'])
        router.get('articles/:id/progress', [controllers.ReadingProgresses, 'show'])
        router.put('articles/:id/progress', [controllers.ReadingProgresses, 'update'])
        router.delete('articles/:id/progress', [controllers.ReadingProgresses, 'destroy'])
        router
          .resource('resources', controllers.Resources)
          .only(['store', 'show'])
          .use(['store'], resourceThrottle)
        router
          .post('resources/:id/refresh', [controllers.Resources, 'refresh'])
          .use(resourceThrottle)
        router
          .post('articles/:id/reports', [controllers.ArticleReports, 'store'])
          .use(reportThrottle)
        router.get('profile', [controllers.Profile, 'show'])
        router.patch('profile', [controllers.Profile, 'update'])
        router.post('logout', [controllers.AccessTokens, 'destroy'])
      })
      .prefix('account')
      .as('profile')
      .use(middleware.auth())
      .use(accountThrottle)
  })
  .prefix('/api/v1')
  .use(publicThrottle)

// Starter diagnostics must not expose account data on a production server.
if (!app.inProduction) {
  router
    .group(() => {
      router.get('test', [controllers.Test, 'index']).as('test.index')
      router.post('test', [controllers.Test, 'store']).as('test.store')
      router.get('users/:id', [controllers.Users, 'show']).as('users.show')
    })
    .prefix('/api')
}
