import { randomUUID } from 'crypto';

// Named to avoid clashing with the Prisma-generated `IntegrationTask` model (both are re-exported from index.ts).
export interface ClaimedIntegrationTask { id: string; kind: string; entityId: string; attempts: number }

/** Claim a small batch without holding database connections during provider calls. */
export async function runIntegrationTasks(db: any, kinds: string[], handle: (task: ClaimedIntegrationTask) => Promise<unknown>, report: (message: string) => void) {
  const token = randomUUID();
  const tasks: ClaimedIntegrationTask[] = await db.$queryRaw`
    UPDATE "IntegrationTask" SET "leaseToken" = ${token},
      "availableAt" = NOW() + INTERVAL '5 minutes', "attempts" = "attempts" + 1
    WHERE "id" IN (
      SELECT "id" FROM "IntegrationTask"
      WHERE "kind" = ANY(${kinds}::text[]) AND "completedAt" IS NULL
        AND "availableAt" <= NOW() AND "attempts" < 12
      ORDER BY "availableAt" LIMIT 4 FOR UPDATE SKIP LOCKED
    ) RETURNING "id", "kind", "entityId", "attempts"`;
  await Promise.all(tasks.map(async task => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        handle(task),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Integration task deadline exceeded')), 60000);
        }),
      ]);
      await db.$executeRaw`UPDATE "IntegrationTask" SET "completedAt" = NOW(), "leaseToken" = NULL,
        "lastError" = NULL WHERE "id" = ${task.id} AND "leaseToken" = ${token}`;
    } catch (error) {
      // Keep payloads/provider errors (which may contain PII) out of the work table.
      const message = error instanceof Error ? error.name : 'IntegrationError';
      const delay = Math.min(3600, 2 ** task.attempts * 5);
      await db.$executeRaw`UPDATE "IntegrationTask" SET "leaseToken" = NULL, "lastError" = ${message},
        "availableAt" = NOW() + ${delay} * INTERVAL '1 second'
        WHERE "id" = ${task.id} AND "leaseToken" = ${token}`;
      report(`Integration task ${task.id} failed on attempt ${task.attempts}${task.attempts >= 12 ? '; manual replay required' : ''}`);
    } finally {
      clearTimeout(timeout);
    }
  }));
}
