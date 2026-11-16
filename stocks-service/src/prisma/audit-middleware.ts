import { PrismaClient } from 'db-unlisted-stox';
import { AdminContextService } from '../common/admin-context.service';
import { PinoNestLogger } from '@smc/logger';

const logger = new PinoNestLogger('stocks-service', 'AuditMiddleware');

/**
 * CMS models that should be audited
 * Note: StockBasket is excluded as it has explicit audit logging in BasketsService
 */
const CMS_MODELS = ['Stock', 'Blog', 'News', 'Faq', 'StaticPage'] as const;

/**
 * Maps model names to Prisma delegate names (camelCase)
 */
const MODEL_TO_DELEGATE: Record<string, string> = {
  Stock: 'stock',
  StockBasket: 'stockBasket',
  Blog: 'blog',
  News: 'news',
  Faq: 'faq',
  StaticPage: 'staticPage',
};

/**
 * Actions that should trigger audit logging
 * Note: Bulk operations (updateMany, deleteMany) are excluded as they are harder to audit meaningfully
 */
const AUDIT_ACTIONS = ['create', 'update', 'delete'] as const;

/**
 * Maps Prisma actions to audit log actions
 */
const ACTION_MAPPING: Record<string, string> = {
  create: 'CREATE',
  update: 'UPDATE',
  delete: 'DELETE',
};

/**
 * Factory function to create audit middleware
 * @param adminContextService Service to retrieve admin context
 * @param prisma Prisma client instance
 * @returns Prisma middleware function
 */
export function createAuditMiddleware(
  adminContextService: AdminContextService,
  prisma: PrismaClient,
) {
  return async (params: any, next: (params: any) => Promise<any>) => {
    // Only audit CMS models
    if (!CMS_MODELS.includes(params.model)) {
      return next(params);
    }

    // Only audit specific actions
    if (!AUDIT_ACTIONS.includes(params.action)) {
      return next(params);
    }

    // Get admin context
    const adminContext = adminContextService.getContext();
    if (!adminContext) {
      // No admin context, skip logging
      return next(params);
    }

    let beforeState: any = null;

    // For UPDATE/DELETE operations, fetch the before state
    if (params.action === 'update' || params.action === 'delete') {
      try {
        const delegateName = MODEL_TO_DELEGATE[params.model!];
        beforeState = await (prisma as any)[delegateName].findUnique({
          where: params.args.where,
        });
      } catch (error) {
        logger.warn(`Failed to fetch before state for audit log:`, error);
      }
    }

    // Execute the operation
    const result = await next(params);

    // Create audit log entry
    try {
      let changes: any = undefined;

      if (params.action === 'create') {
        changes = { before: null, after: result };
      } else if (params.action === 'update') {
        changes = { before: beforeState, after: result };
      } else if (params.action === 'delete') {
        changes = { before: beforeState, after: null };
      }
      // For updateMany/deleteMany, changes remains undefined

      const auditLogData = {
        adminId: adminContext.adminId,
        adminEmail: adminContext.email,
        adminRole: adminContext.role,
        action: ACTION_MAPPING[params.action] || params.action.toUpperCase(),
        entity: params.model!.toUpperCase(),
        entityId: result?.id || params.args?.where?.id,
        changes,
        metadata: undefined, // Could be extended to include IP, user agent, etc.
      };

      await prisma.auditLog.create({
        data: auditLogData,
      });
    } catch (error) {
      // Log error but don't block the operation
      logger.error('Failed to create audit log:', error);
    }

    return result;
  };
}
