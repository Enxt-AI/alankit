import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { AuthService } from '../src/auth/auth.service';
import { delKey } from 'redis-service';

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unused-vars */

describe('Phone Authentication (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let authService: AuthService;
  const testPhone = '9876543210';
  const testEmail = 'test@example.com';
  const testGoogleId = 'google_123456789';
  // NOTE: testReferralCode removed as part of referral system deprecation.

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    authService = app.get(AuthService);
    await app.init();

    // Mock OTP generation to return deterministic value
    jest.spyOn(authService as any, 'generateOTP').mockReturnValue('123456');

    // Clean up test data
    // NOTE: Referral cleanup was removed as part of referral system deprecation.

    // Delete the users
    await prisma.user.deleteMany({
      where: {
        OR: [{ phone: testPhone }, { email: testEmail }],
      },
    });

    try {
      await delKey(`otp:${testPhone}`);
      // Clear rate limiting keys
      await delKey(`rate:otp:request:${testPhone}`);
      await delKey(`rate:otp:verify:${testPhone}`);
    } catch (_error) {
      // Redis might not be available in test environment
      console.warn('Redis cleanup failed');
    }
  });

  afterEach(async () => {
    // Clear Redis keys after each test
    try {
      await redis.deleteOTP(testPhone);
      // Clear rate limiting keys if they exist
    } catch (_error) {
      // Ignore Redis errors in cleanup
    }

    await app.close();
  });

  describe('New User Flow (Phone → Google)', () => {
    it('should complete full phone-first authentication flow', async () => {
      // Step 1: Request OTP
      const requestResponse = await request(app.getHttpServer())
        .post('/auth/phone/otp/request')
        .send({ phone: testPhone })
        .expect(200);

      expect(requestResponse.body.success).toBe(true);
      expect(requestResponse.body.message).toContain('OTP sent');

      // Step 2: Verify OTP (mock OTP = '123456' for testing)
      const verifyResponse = await request(app.getHttpServer())
        .post('/auth/phone/otp/verify')
        .send({ phone: testPhone, otp: '123456' })
        .expect(200);

      expect(verifyResponse.body.needsGoogle).toBe(true);
      expect(verifyResponse.body.currentStep).toBe(0.5);

      // Step 3: Link Google account
      const linkResponse = await request(app.getHttpServer())
        .post('/auth/phone/google/link')
        .send({
          email: testEmail,
          name: 'Test User',
          googleId: testGoogleId,
          phone: testPhone,
        })
        .expect(200);

      expect(linkResponse.body.success).toBe(true);
      expect(linkResponse.body.currentStep).toBe(1);
      expect(linkResponse.body.token).toBeDefined();

      // Verify user was created in database
      const user = await prisma.user.findUnique({
        where: { phone: testPhone },
      });

      expect(user).toBeDefined();
      expect(user!.email).toBe(testEmail);
      expect(user!.phone).toBe(testPhone);
    });
  });

  describe('Existing User Flow (Phone-Only Login)', () => {
    beforeEach(async () => {
      // Create existing user with phone + email
      await prisma.user.create({
        data: {
          phone: testPhone,
          email: testEmail,
          fullName: 'Existing User',
          kycStatus: 'PENDING',
        },
      });
    });

    it('should login existing user directly without Google step', async () => {
      // Request OTP
      await request(app.getHttpServer())
        .post('/auth/phone/otp/request')
        .send({ phone: testPhone })
        .expect(200);

      // Verify OTP
      const verifyResponse = await request(app.getHttpServer())
        .post('/auth/phone/otp/verify')
        .send({ phone: testPhone, otp: '123456' })
        .expect(200);

      expect(verifyResponse.body.needsGoogle).toBe(false);
      expect(verifyResponse.body.token).toBeDefined();
      expect(verifyResponse.body.currentStep).toBe(1);
    });
  });

  describe('Rate Limiting', () => {
    it('should block excessive OTP requests', async () => {
      // Make 4 requests (limit is 3)
      for (let i = 0; i < 4; i++) {
        const response = await request(app.getHttpServer())
          .post('/auth/phone/otp/request')
          .send({ phone: testPhone });

        if (i < 3) {
          expect(response.status).toBe(200);
        } else {
          expect(response.status).toBe(429); // Too Many Requests
        }
      }
    });

    it('should block excessive OTP verification attempts', async () => {
      // Request OTP first
      await request(app.getHttpServer())
        .post('/auth/phone/otp/request')
        .send({ phone: testPhone })
        .expect(200);

      // Make 6 verification attempts (limit is 5)
      for (let i = 0; i < 6; i++) {
        const response = await request(app.getHttpServer())
          .post('/auth/phone/otp/verify')
          .send({ phone: testPhone, otp: '999999' }); // Wrong OTP

        if (i < 5) {
          expect(response.status).toBe(400); // Bad Request (wrong OTP)
        } else {
          expect(response.status).toBe(429); // Too Many Requests
        }
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid OTP', async () => {
      // Request OTP
      await request(app.getHttpServer())
        .post('/auth/phone/otp/request')
        .send({ phone: testPhone })
        .expect(200);

      // Try invalid OTP
      const response = await request(app.getHttpServer())
        .post('/auth/phone/otp/verify')
        .send({ phone: testPhone, otp: '999999' })
        .expect(400);

      expect(response.body.message).toContain('Invalid OTP');
    });

    it('should handle phone-only user trying to link Google twice', async () => {
      // Create phone-only user
      await prisma.user.create({
        data: {
          phone: testPhone,
          fullName: 'Phone Only User',
          kycStatus: 'PENDING',
        },
      });

      // Try to link Google
      await request(app.getHttpServer())
        .post('/auth/phone/google/link')
        .send({
          email: testEmail,
          name: 'Test User',
          googleId: testGoogleId,
          phone: testPhone,
        })
        .expect(200);

      // Try to link again with different email
      const response = await request(app.getHttpServer())
        .post('/auth/phone/google/link')
        .send({
          email: 'different@example.com',
          name: 'Different User',
          googleId: 'different_google_id',
          phone: testPhone,
        })
        .expect(400);

      expect(response.body.message).toContain('already linked');
    });
  });

  // NOTE: 'Referral URL Auto-Fill' describe block was removed as part of referral system deprecation.
});
