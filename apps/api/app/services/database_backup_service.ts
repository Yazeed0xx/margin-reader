import { open, chmod, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'

import Database from 'better-sqlite3'

export default class DatabaseBackupService {
  async create(source: string, destination: string) {
    const target = resolve(destination)
    if (resolve(source) === target) {
      throw new Error('Backup destination must differ from the live database')
    }
    // Exclusive creation refuses existing files, including symlinks. Keep backups private.
    const file = await open(target, 'wx', 0o600)
    await file.close()
    let database: Database.Database | undefined
    try {
      database = new Database(source, { readonly: true, fileMustExist: true })
      await database.backup(target)
      const verification = new Database(target, { readonly: true, fileMustExist: true })
      try {
        if (
          verification.pragma('integrity_check', { simple: true }) !== 'ok' ||
          (verification.pragma('foreign_key_check') as unknown[]).length
        ) {
          throw new Error('Backup failed integrity verification')
        }
      } finally {
        verification.close()
      }
      await chmod(target, 0o600)
      return target
    } catch (error) {
      await unlink(target)
      throw error
    } finally {
      database?.close()
    }
  }
}
