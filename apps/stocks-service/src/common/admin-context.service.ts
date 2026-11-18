import { Injectable, Scope } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { AdminContext } from './interfaces/admin-context.interface';

/**
 * Service for managing admin context using AsyncLocalStorage
 * Provides request-scoped storage for admin authentication data
 * Used by interceptors to store context and by middleware to retrieve it
 */
@Injectable({ scope: Scope.DEFAULT })
export class AdminContextService {
  private readonly als = new AsyncLocalStorage<AdminContext>();

  /**
   * Execute a callback function within an admin context
   * @param context The admin context to store
   * @param callback Function to execute within the context
   * @returns The result of the callback function
   */
  run<T>(context: AdminContext, callback: () => T): T {
    return this.als.run(context, callback);
  }

  /**
   * Retrieve the current admin context
   * @returns The admin context if available, undefined otherwise
   */
  getContext(): AdminContext | undefined {
    return this.als.getStore();
  }

  /**
   * Convenience helper to retrieve the current admin id from context.
   * Throws if context is not available.
   */
  getAdminId(): string {
    const context = this.getContext();
    if (!context) {
      throw new Error('Admin context not available');
    }
    return context.adminId;
  }

  /**
   * Check if admin context is currently available
   * @returns True if context exists, false otherwise
   */
  hasContext(): boolean {
    return this.als.getStore() !== undefined;
  }
}
