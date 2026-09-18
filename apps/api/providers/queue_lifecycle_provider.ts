import QueueProvider from '@adonisjs/queue/queue_provider'

// Queue 0.6.2 resolves its database adapter in both boot/start. Warmup runs
// those hooks but skips shutdown, so keep bindings while skipping side effects.
export default class QueueLifecycleProvider extends QueueProvider {
  async boot() {
    if (this.app.getMode() === 'run') {
      await super.boot()
    }
  }

  async start() {
    if (this.app.getMode() === 'run') {
      await super.start()
    }
  }
}
