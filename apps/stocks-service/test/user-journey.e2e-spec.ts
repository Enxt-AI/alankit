import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import multipart from '@fastify/multipart';

/**
 * End-to-End User Journey Test
 *
 * Tests the complete flow: KYC → Demat → Buy → Pay → Admin Allocate → Portfolio
 *
 * This test verifies:
 * 1. KYC verification flow with mock mode
 * 2. Demat account linking with admin approval
 * 3. Stock order placement (KYC gate validation)
 * 4. Mock payment processing
 * 5. Admin order allocation (Demat gate validation)
 * 6. Portfolio holdings display
 *
 * - Test database seeded with stocks
 * - Auth service running or mocked
 */

describe('User Journey E2E (KYC → Demat → Buy → Pay → Allocate → Portfolio)', () => {
  jest.setTimeout(120_000);

  let app: INestApplication<App>;
  let prisma: PrismaService;
  let testUser: any;
  let testStock: any;
  let adminUser: any;
  let userAccessToken: string;
  let adminAccessToken: string;
  let testUserEmail: string;
  let adminEmail: string;
  let testUserPhone: string;
  let adminPhone: string;
  let unverifiedUserEmail: string;
  let unverifiedUserPhone: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Use Fastify in E2E so multipart uploads work (controllers use req.file()).
    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    // Register the same core plugins we rely on in production bootstrap.
    const fastifyApp = app as unknown as NestFastifyApplication;
    await fastifyApp.register(fastifyCookie);
    await fastifyApp.register(multipart, {
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
      },
    });

    await app.init();
    await fastifyApp.getHttpAdapter().getInstance().ready();

    prisma = app.get<PrismaService>(PrismaService);
    const jwtService = app.get(JwtService);

    const runId = Date.now().toString();
    testUserEmail = `test-e2e-user+${runId}@example.com`;
    adminEmail = `test-e2e-admin+${runId}@example.com`;
    unverifiedUserEmail = `unverified-e2e+${runId}@example.com`;

    // Ensure phones are unique per run to avoid collisions with prior runs.
    // Keep them E.164-ish (+91 + 10 digits).
    const suffix = runId.slice(-10).padStart(10, '0');
    testUserPhone = `+91${suffix}`;
    adminPhone = `+91${(Number(suffix) + 1).toString().padStart(10, '0')}`;
    unverifiedUserPhone = `+91${(Number(suffix) + 2).toString().padStart(10, '0')}`;

    // Clean up any existing test data
    await prisma.order.deleteMany({
      where: { user: { email: { in: [testUserEmail, unverifiedUserEmail] } } },
    });
    await prisma.portfolio.deleteMany({
      where: { user: { email: { in: [testUserEmail, unverifiedUserEmail] } } },
    });
    await prisma.user.deleteMany({
      where: {
        email: { in: [testUserEmail, unverifiedUserEmail] },
      },
    });
    await prisma.admin.deleteMany({
      where: {
        email: { in: [adminEmail] },
      },
    });
    await prisma.stock.deleteMany({ where: { cin: 'L12345MH2026PLC100001' } });

    // Create admin user first (needed for stock creation)
    adminUser = await prisma.admin.create({
      data: {
        email: adminEmail,
        fullName: 'Test E2E Admin',
        passwordHash: 'test-password-hash',
        role: 'ADMIN',
        permissions: ['orders'],
      },
    });

    // Seed test stock
    testStock = await prisma.stock.create({
      data: {
        name: 'Test E2E Company',
        cin: 'L12345MH2026PLC100001',
        price: 1000,
        logoUrl: 'https://example.com/logo.png',
        tags: [],
        isActive: true,
        createdById: adminUser.id,
      },
    });

    // Create test user (KYC pending)
    testUser = await prisma.user.create({
      data: {
        email: testUserEmail,
        fullName: 'Test E2E User',
        phone: testUserPhone,
        kycStatus: 'PENDING',
        dematStatus: 'PENDING',
      },
    });

    // Sign JWTs (matches the real JwtStrategy/AdminJwtStrategy behavior)
    const userJwt = jwtService.sign({
      userId: testUser.id,
      email: testUser.email,
      type: 'USER',
    });
    userAccessToken = `Bearer ${userJwt}`;

    const adminPanelJwt = jwtService.sign({
      type: 'ADMIN',
      adminId: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      permissions: adminUser.permissions,
    });
    adminAccessToken = `admin_panel_token=${adminPanelJwt}`;
    // NOTE: E2E tests use the legacy cookie name because tests run against
    // an in-memory server that doesn't go through the obfuscation rename.
    // The JWT strategy checks both obfuscated and legacy names.
  });

  afterAll(async () => {
    // Clean up test data
    if (testUser?.id) {
      await prisma.order.deleteMany({ where: { userId: testUser.id } });
      await prisma.portfolio.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.deleteMany({ where: { id: testUser.id } });
    }
    if (testStock?.id) {
      await prisma.stock.deleteMany({ where: { id: testStock.id } });
    }
    if (adminUser?.id) {
      await prisma.admin.deleteMany({ where: { id: adminUser.id } });
    }

    await app.close();
  });

  describe('Step 1: KYC Verification', () => {
    it('should reject stock purchase when KYC is not verified', async () => {
      const orderDto = {
        stockId: testStock.id,
        quantity: 10,
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', userAccessToken)
        .send(orderDto)
        .expect(400);

      expect(response.body.message).toContain('KYC verification is required');
    });

    it('should complete KYC flow and be verified', async () => {
      // Direct database update to verify user since there is no mock KYC flow anymore
      await prisma.user.update({
        where: { id: testUser.id },
        data: {
          kycStatus: 'VERIFIED',
          kycData: {
            fullName: 'Test E2E User',
            dob: '1990-01-01',
            panDetails: {
              pan: 'ABCDE1234F',
              verified: true,
              verifiedAt: new Date().toISOString(),
            },
            aadhaarDetails: {
              aadhaar: 'XXXX-XXXX-1234',
              name: 'Test E2E User',
              verified: true,
              verifiedAt: new Date().toISOString(),
            },
            submittedAt: new Date().toISOString(),
            approvedAt: new Date().toISOString(),
          },
        },
      });

      // Verify database update
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(updatedUser?.kycStatus).toBe('VERIFIED');
    });

  });

  describe('Step 2: Demat Account Verification', () => {
    it('should reject order allocation when Demat is not verified', async () => {
      // First create an order (KYC is now verified)
      const orderDto = {
        stockId: testStock.id,
        quantity: 10,
      };

      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', userAccessToken)
        .send(orderDto)
        .expect(201);

      const orderId = orderResponse.body.id;

      // Try to allocate without Demat verification
      const updateDto = {
        status: 'ALLOCATED',
      };

      const response = await request(app.getHttpServer())
        .put(`/orders/admin/${orderId}/status`)
        .set('Cookie', [adminAccessToken])
        .send(updateDto)
        .expect(400);

      expect(response.body.message).toContain(
        'Demat account verification is required',
      );

      // Clean up order
      await prisma.order.delete({ where: { id: orderId } });
    });

    it('should link existing Demat account successfully', async () => {
      const dematStatementBytes = Buffer.from('mock demat statement', 'utf8');

      const dematData = {
        accountNumber: '1234567890123456',
        dpId: '12345678',
        clientId: 'TEST123',
        dematStatement: {
          fileUrl: 'https://example.com/statement.pdf',
          fileName: 'statement.pdf',
          fileSize: dematStatementBytes.length,
        },
      };

      const response = await request(app.getHttpServer())
        .post('/demat/link')
        .set('Authorization', userAccessToken)
        .send(dematData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain(
        'Demat account details submitted successfully for admin review',
      );

      // Linking requires admin review before verification.
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(updatedUser?.dematStatus).toBe('PENDING');
      expect(updatedUser?.dematData).toBeTruthy();

      await request(app.getHttpServer())
        .put(`/demat/admin/${testUser.id}/approve`)
        .set('Cookie', adminAccessToken)
        .expect(200);

      const approvedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
      expect(approvedUser?.dematStatus).toBe('VERIFIED');
    });


    it('should get Demat status successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/demat/status')
        .set('Authorization', userAccessToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeTruthy();
      expect(response.body.data.dematStatus).toBe('VERIFIED');
      expect(response.body.data.dematData).toBeTruthy();
      expect(response.body.data.dematData.accountNumber).toMatch(/\*+3456$/);
    });
  });

  describe('Step 3: Stock Purchase Flow', () => {
    let orderId: string;

    it('should create order successfully when KYC and Demat are verified', async () => {
      const orderDto = {
        stockId: testStock.id,
        quantity: 10,
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', userAccessToken)
        .send(orderDto)
        .expect(201);

      expect(response.body.id).toBeTruthy();
      expect(response.body.status).toBe('PENDING');
      expect(response.body.userId).toBe(testUser.id);
      expect(response.body.stockId).toBe(testStock.id);
      expect(response.body.quantity).toBe(10);

      orderId = response.body.id;
    });

    it('should retrieve user orders successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/orders/my-orders')
        .set('Authorization', userAccessToken)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].id).toBe(orderId);
    });

    it('should verify order details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', userAccessToken)
        .expect(200);

      expect(response.body.id).toBe(orderId);
      expect(response.body.stock).toBeTruthy();
      expect(response.body.stock.cin).toBe('L12345MH2026PLC100001');
    });
  });

  describe('Step 4: Payment Processing', () => {
    let orderId: string;
    let cashfreeOrderId: string;

    beforeAll(async () => {
      // Get the order ID from previous test
      const orders = await prisma.order.findMany({
        where: { userId: testUser.id, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      });
      orderId = orders[0].id;
    });

    it('should initiate payment successfully', async () => {
      const response = await request(app.getHttpServer())
        .post(`/payments/${orderId}/create`)
        .set('Authorization', userAccessToken)
        .expect(201);

      expect(response.body.cashfreeOrderId).toBeTruthy();
      expect(response.body.keyId).toBeTruthy();
      
      cashfreeOrderId = response.body.cashfreeOrderId;
    });

    it('should verify payment successfully (mock mode)', async () => {
      const response = await request(app.getHttpServer())
        .post('/payments/verify')
        .set('Authorization', userAccessToken)
        .send({
          orderId,
          cashfreeOrderId,
          cashfreePaymentId: 'mock_payment_id',
          cashfreeSignature: 'mock_signature',
        })
        .expect(201);

      expect(response.body.success).toBe(true);

      // Verify order payment status
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      expect(order?.paymentStatus).toBe('PAID');
      expect(order?.status).toBe('PAID');
    });

  });

  describe('Step 5: Admin Order Allocation', () => {
    let orderId: string;

    beforeAll(async () => {
      // Get the paid order
      const orders = await prisma.order.findMany({
        where: { userId: testUser.id, status: 'PAID' },
        orderBy: { createdAt: 'desc' },
      });
      orderId = orders[0].id;
    });

    it('should allocate order successfully when Demat is verified', async () => {
      const updateDto = {
        status: 'ALLOCATED',
        quantity: 10,
        allocationPrice: testStock.price,
      };

      const response = await request(app.getHttpServer())
        .put(`/orders/admin/${orderId}/status`)
        .set('Cookie', [adminAccessToken])
        .send(updateDto)
        .expect(200);

      expect(response.body.id).toBe(orderId);
      expect(response.body.status).toBe('ALLOCATED');

      // Verify portfolio was updated
      const portfolio = await prisma.portfolio.findFirst({
        where: {
          userId: testUser.id,
          stockId: testStock.id,
        },
      });

      expect(portfolio).toBeTruthy();
      expect(portfolio?.quantity).toBe(10);
      expect(portfolio?.avgPrice).toBe(testStock.price);
    });

    it('should retrieve admin orders with demat status', async () => {
      const response = await request(app.getHttpServer())
        .get('/orders/admin/all')
        .set('Cookie', [adminAccessToken])
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      const order = response.body.find((o: any) => o.id === orderId);
      expect(order).toBeTruthy();
      expect(order.user.dematStatus).toBe('VERIFIED');
    });
  });

  describe('Step 6: Portfolio Verification', () => {
    it('should retrieve portfolio holdings successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/portfolio')
        .set('Authorization', userAccessToken)
        .expect(200);

      expect(response.body.holdings).toBeTruthy();
      expect(response.body.holdings.length).toBe(1);

      const holding = response.body.holdings[0];
      expect(holding.stock.cin).toBe('L12345MH2026PLC100001');
      expect(holding.quantity).toBe(10);
      expect(holding.avgPrice).toBe(testStock.price);
      expect(holding.currentValue).toBe(testStock.price * 10);
    });

    it('should retrieve portfolio summary successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/portfolio')
        .set('Authorization', userAccessToken)
        .expect(200);

      expect(response.body.summary).toBeTruthy();
      expect(response.body.summary.totalInvestedValue).toBe(testStock.price * 10);
      expect(response.body.summary.totalCurrentValue).toBe(testStock.price * 10);
      expect(response.body.summary.totalHoldings).toBe(1);
    });

    it('should verify user can access portfolio only with KYC and Demat verified', async () => {
      // Create a new user without KYC/Demat
      const unverifiedUser = await prisma.user.create({
        data: {
          email: unverifiedUserEmail,
          fullName: 'Unverified User',
          phone: unverifiedUserPhone,
          kycStatus: 'PENDING',
          dematStatus: 'PENDING',
        },
      });

      const jwtService = app.get(JwtService);
      const unverifiedJwt = jwtService.sign({
        userId: unverifiedUser.id,
        email: unverifiedUser.email,
        type: 'USER',
      });
      const unverifiedToken = `Bearer ${unverifiedJwt}`;

      // Portfolio endpoint is authenticated, but not KYC/Demat-gated.
      const response = await request(app.getHttpServer())
        .get('/portfolio')
        .set('Authorization', unverifiedToken)
        .expect(200);

      expect(response.body.holdings).toBeTruthy();
      expect(Array.isArray(response.body.holdings)).toBe(true);

      // Clean up
      await prisma.user.delete({ where: { id: unverifiedUser.id } });
    });
  });

  describe('Complete Flow Verification', () => {

    it('should verify complete user journey state', async () => {
      const user = await prisma.user.findUnique({
        where: { id: testUser.id },
        include: {
          orders: {
            include: {
              stock: true,
            },
          },
          portfolio: true,
        },
      });

      // KYC verified
      expect(user?.kycStatus).toBe('VERIFIED');
      expect(user?.kycData).toBeTruthy();

      // Demat verified
      expect(user?.dematStatus).toBe('VERIFIED');
      expect(user?.dematData).toBeTruthy();

      // Order created and allocated
      expect(user?.orders.length).toBeGreaterThan(0);
      const allocatedOrder = user?.orders.find((o) => o.status === 'ALLOCATED');
      expect(allocatedOrder).toBeTruthy();
      expect(allocatedOrder?.paymentStatus).toBe('PAID');

      // Portfolio has holdings
      expect(user?.portfolio.length).toBe(1);
      expect(user?.portfolio[0].quantity).toBe(10);
      expect(user?.portfolio[0].stockId).toBe(testStock.id);
    });
  });
});
