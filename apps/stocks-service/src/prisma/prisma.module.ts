import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AdminContextService } from '../common/admin-context.service';
import { fieldEncryptionExtension } from 'prisma-field-encryption';
import { Prisma, jsonEncryptionExtension } from 'db-unlistedstock';

/**
 * Global module that provides Prisma database access and admin context to all modules
 * @Global decorator makes PrismaService and AdminContextService available without importing PrismaModule everywhere
 */
@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: (adminContextService: AdminContextService) => {
        const client = new PrismaService(adminContextService);
        const extended = client
          .$extends(
            fieldEncryptionExtension({
              encryptionKey: process.env.PRISMA_FIELD_ENCRYPTION_KEY,
              dmmf: Prisma.dmmf,
            }),
          )
          .$extends(jsonEncryptionExtension());
        
        return new Proxy(extended, {
          get: (target, prop) => {
            if (prop === 'onModuleInit') return client.onModuleInit.bind(client);
            if (prop === 'onModuleDestroy') return client.onModuleDestroy.bind(client);
            return Reflect.get(target, prop);
          },
        });
      },
      inject: [AdminContextService],
    },
    AdminContextService,
  ],
  exports: [PrismaService, AdminContextService],
})
export class PrismaModule {}
