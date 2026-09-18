import limiter from '@adonisjs/limiter/services/main'

export const publicThrottle = limiter.define('public', (ctx) =>
  limiter.allowRequests(300).every('1 minute').usingKey(`public:${ctx.request.ip()}`),
)
export const authThrottle = limiter.define('auth', (ctx) =>
  limiter.allowRequests(20).every('15 minutes').usingKey(`auth:${ctx.request.ip()}`),
)
export const resourceThrottle = limiter.define('resources', (ctx) =>
  limiter.allowRequests(20).every('1 minute').usingKey(`resources:${ctx.auth.getUserOrFail().id}`),
)
export const reportThrottle = limiter.define('reports', (ctx) =>
  limiter.allowRequests(5).every('1 hour').usingKey(`reports:${ctx.auth.getUserOrFail().id}`),
)
export const accountThrottle = limiter.define('account', (ctx) =>
  limiter.allowRequests(180).every('1 minute').usingKey(`account:${ctx.auth.getUserOrFail().id}`),
)
