import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { fieldEncryptionExtension } from 'prisma-field-encryption';
import { Prisma, jsonEncryptionExtension } from 'db-unlistedstock';

/**
 * Global module that provides Prisma database access to all modules
 * @Global decorator makes PrismaService available without importing PrismaModule everywhere
 */
@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: () => {
        const client = new PrismaService();
        const extended = client
          .$extends(
            fieldEncryptionExtension({
              encryptionKey: process.env.PRISMA_FIELD_ENCRYPTION_KEY,
              dmmf: Prisma.dmmf,
            }),
          )
          .$extends(jsonEncryptionExtension());
        
        // Return a proxy to ensure NestJS lifecycle hooks (onModuleInit/Destroy) are called on the original instance
        return new Proxy(extended, {
          get: (target, prop) => {
            if (prop === 'onModuleInit') return client.onModuleInit.bind(client);
            if (prop === 'onModuleDestroy') return client.onModuleDestroy.bind(client);
            return Reflect.get(target, prop);
          },
        });
      },
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
