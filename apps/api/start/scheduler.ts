import app from '@adonisjs/core/services/app'

import RecoverResources from '#jobs/recover_resources'

// Code generation also imports web preloads; it must not connect or schedule work.
if (app.getMode() === 'run') {
  await RecoverResources.schedule({}).every('1m').id('resource-recovery').run()
}
