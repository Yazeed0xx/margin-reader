export default {
  cacheHours: 24,
  failureCacheMinutes: 15,
  // Operator-managed permissions only. Record a license URL or written permission;
  // never accept these grants from article authors or scraped page metadata.
  approvedSources: [] as { origin: string; evidence: string }[],
}
