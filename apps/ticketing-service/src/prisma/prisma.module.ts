import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AdminPrismaService } from './admin-prisma.service';
import { fieldEncryptionExtension } from 'prisma-field-encryption';
import { Prisma as TicketingPrisma } from 'db-ticketing';
import { Prisma as MainPrisma, jsonEncryptionExtension } from 'db-unlisted-stox';

/* The Global decorator makes the PrismaModule available to be injected
 across the entire application without needing to import it in every module. */
@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: () => {
        const client = new PrismaService();
        const extended = client.$extends(
          fieldEncryptionExtension({
            encryptionKey: process.env.PRISMA_FIELD_ENCRYPTION_KEY,
            dmmf: TicketingPrisma.dmmf,
          }),
        );
        
        return new Proxy(extended, {
          get: (target, prop) => {
            if (prop === 'onModuleInit') return client.onModuleInit.bind(client);
            if (prop === 'onModuleDestroy') return client.onModuleDestroy.bind(client);
            return Reflect.get(target, prop);
          },
        });
      },
    },
    {
      provide: AdminPrismaService,
      useFactory: () => {
        const client = new AdminPrismaService();
        const extended = client
          .$extends(
            fieldEncryptionExtension({
              encryptionKey: process.env.PRISMA_FIELD_ENCRYPTION_KEY,
              dmmf: MainPrisma.dmmf,
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
    },
  ],
  exports: [PrismaService, AdminPrismaService],
})
export class PrismaModule {}
