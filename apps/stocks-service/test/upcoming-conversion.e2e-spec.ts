import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

/**
 * Upcoming Stock Conversion E2E
 *
 * Verifies:
 * - upcoming stock conversion creates a regular stock
 * - upcoming stock is hard-deleted
 * - watchlist items migrate from upcomingStockId -> stockId
 * - upcoming hard delete removes record
 * - regular soft delete sets isActive=false
 */

describe('Upcoming Stock Conversion E2E', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let adminUser: any;
  let testUser: any;

  let adminPanelJwt: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Cleanup any prior test data (best-effort)
    await prisma.watchlistItem.deleteMany({
      where: {
        user: {
          email: {
            in: [
              'test-convert-user@example.com',
              'test-convert-admin@example.com',
            ],
          },
        },
      },
    });
    await prisma.upcomingStock.deleteMany({
      where: {
        cin: { in: ['L12345MH2026PLC200001', 'L12345MH2026PLC200002'] },
      },
    });
    await prisma.stock.deleteMany({
      where: {
        cin: { in: ['L12345MH2026PLC200003', 'L12345MH2026PLC200001'] },
      },
    });
    await prisma.admin.deleteMany({
      where: { email: { in: ['test-convert-admin@example.com'] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['test-convert-user@example.com'] } },
    });

    adminUser = await prisma.admin.create({
      data: {
        email: 'test-convert-admin@example.com',
        fullName: 'Test Convert Admin',
        passwordHash: '$2b$10$test-test-test-test-test-test-test-test-test',
        role: 'ADMIN',
        permissions: ['cms_upcoming_stocks'],
      },
    });

    testUser = await prisma.user.create({
      data: {
        email: 'test-convert-user@example.com',
        fullName: 'Test Convert User',
        phone: '+919876540002',
        kycStatus: 'VERIFIED',
        dematStatus: 'VERIFIED',
      },
    });

    // Admin panel routes use AdminJwtAuthGuard, which extracts JWT from the
    // admin panel cookie. E2E tests use the legacy cookie name because the
    // strategy checks both obfuscated and legacy names.
    adminPanelJwt = jwtService.sign({
      type: 'ADMIN',
      adminId: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      permissions: adminUser.permissions,
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.watchlistItem.deleteMany({ where: { userId: testUser.id } });
    await prisma.upcomingStock.deleteMany({
      where: { createdById: adminUser.id },
    });
    await prisma.stock.deleteMany({ where: { createdById: adminUser.id } });
    await prisma.user.deleteMany({ where: { id: testUser.id } });
    await prisma.admin.deleteMany({ where: { id: adminUser.id } });

    await app.close();
    await prisma.$disconnect();
  });

  it('converts upcoming stock and migrates watchlist rows', async () => {
    const upcoming = await prisma.upcomingStock.create({
      data: {
        name: 'Test Upcoming Convert',
        cin: 'L12345MH2026PLC200001',
        price: 1234,
        logoUrl: null,
        tags: [],
        isin: null,
        isActive: true,
        isPopular: false,
        createdById: adminUser.id,
      },
    });

    const watchlistItem = await prisma.watchlistItem.create({
      data: {
        userId: testUser.id,
        upcomingStockId: upcoming.id,
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/upcoming-stocks/admin/${upcoming.id}/convert`)
      .set('Cookie', [`admin_panel_token=${adminPanelJwt}`])
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data?.newStockId).toBeTruthy();

    const newStockId = response.body.data.newStockId as string;

    const upcomingAfter = await prisma.upcomingStock.findUnique({
      where: { id: upcoming.id },
    });
    expect(upcomingAfter).toBeNull();

    const regular = await prisma.stock.findUnique({
      where: { id: newStockId },
    });
    expect(regular).toBeTruthy();
    expect(regular?.cin).toBe('L12345MH2026PLC200001');
    expect(regular?.isPopular).toBe(false);

    const migrated = await prisma.watchlistItem.findUnique({
      where: { id: watchlistItem.id },
    });
    expect(migrated?.upcomingStockId).toBeNull();
    expect(migrated?.stockId).toBe(newStockId);
  });

  it('hard deletes upcoming stocks via admin delete endpoint', async () => {
    const upcoming = await prisma.upcomingStock.create({
      data: {
        name: 'Test Upcoming Delete',
        cin: 'L12345MH2026PLC200002',
        price: 100,
        logoUrl: null,
        tags: [],
        isin: null,
        isActive: true,
        isPopular: false,
        createdById: adminUser.id,
      },
    });

    await request(app.getHttpServer())
      .delete(`/upcoming-stocks/admin/${upcoming.id}`)
      .set('Cookie', [`admin_panel_token=${adminPanelJwt}`])
      .expect(200);

    const after = await prisma.upcomingStock.findUnique({
      where: { id: upcoming.id },
    });
    expect(after).toBeNull();
  });

  it('soft deletes regular stocks via admin delete endpoint', async () => {
    const regular = await prisma.stock.create({
      data: {
        name: 'Test Regular Soft Delete',
        cin: 'L12345MH2026PLC200003',
        price: 999,
        logoUrl: null,
        tags: [],
        isin: null,
        totalShares: null,
        isActive: true,
        isPopular: false,
        createdById: adminUser.id,
      },
    });

    await request(app.getHttpServer())
      .delete(`/stocks/admin/${regular.id}`)
      .set('Cookie', [`admin_panel_token=${adminPanelJwt}`])
      .expect(200);

    const after = await prisma.stock.findUnique({ where: { id: regular.id } });
    expect(after).toBeTruthy();
    expect(after?.isActive).toBe(false);
  });
});
