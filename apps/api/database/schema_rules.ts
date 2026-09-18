import { type SchemaRules } from '@adonisjs/lucid/types/schema_generator'

export default {
  columns: {
    interface_language: { tsType: "'ar' | 'en'" },
    reading_language: { tsType: "'ar' | 'en' | 'both'" },
  },
  tables: {
    article_revisions: {
      columns: { language: { tsType: "'ar' | 'en'" } },
    },
    resources: {
      columns: {
        kind: { tsType: "'unknown' | 'article' | 'research' | 'video' | 'pdf'" },
        processing_status: { tsType: "'pending' | 'ready' | 'limited' | 'failed'" },
        display_policy: { tsType: "'metadata' | 'embed' | 'full_content'" },
      },
    },
  },
} satisfies SchemaRules
