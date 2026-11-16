import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { JwtService } from '@nestjs/jwt';
import { SmsService } from '../sms/sms.service';
import { EmailService } from 'email-service';
import { BadRequestException } from '@nestjs/common';

// Mock the redis-service module so it throws connection errors (simulating Redis offline)
// This forces RedisService to use its fallbackCache Map.
jest.mock('redis-service', () => ({
  redis: {
    on: jest.fn(),
    ping: jest.fn().mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(new Error('Connection error')), 5))),
    set: jest.fn().mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(new Error('Connection error')), 5))),
    get: jest.fn().mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(new Error('Connection error')), 5))),
    del: jest.fn().mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(new Error('Connection error')), 5))),
    ttl: jest.fn().mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(new Error('Connection error')), 5))),
    expire: jest.fn().mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(new Error('Connection error')), 5))),
    incr: jest.fn().mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(new Error('Connection error')), 5))),
  },
  setKey: jest.fn().mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(new Error('Connection error')), 5))),
  getKey: jest.fn().mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(new Error('Connection error')), 5))),
  delKey: jest.fn().mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(new Error('Connection error')), 5))),
}));

describe('AuthService Concurrency & Lock Load Test', () => {
  let service: AuthService;
  let redisService: RedisService;
  let smsService: SmsService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    session: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockJwt = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockSms = {
    sendOtpSms: jest.fn().mockResolvedValue({ success: true, ackid: 'QUEUED' }),
  };

  const mockEmail = {
    sendOtpEmail: jest.fn().mockResolvedValue({ success: true }),
    sendNewDeviceLoginAlert: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        RedisService, // Use actual implementation to test the real fallbackCache locking
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: SmsService, useValue: mockSms },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    redisService = module.get<RedisService>(RedisService);
    smsService = module.get<SmsService>(SmsService);
  });

  it('should only allow exactly one OTP generation to proceed under concurrent requests', async () => {
    const phone = '9999999999';
    const ip = '127.0.0.1';
    const fingerprint = 'test-device';

    // Send 10 concurrent requests to sendPhoneOTP
    const promises = Array.from({ length: 10 }).map(() =>
      service.sendPhoneOTP(phone, ip, undefined, fingerprint)
        .then(res => ({ success: true, res, err: null as any }))
        .catch(err => ({ success: false, res: null, err }))
    );

    const results = await Promise.all(promises);

    const successRequests = results.filter(r => r.success);
    const lockedRequests = results.filter(r => !r.success && r.err instanceof BadRequestException && r.err.message.includes('already in progress'));

    expect(successRequests.length).toBe(1);
    expect(lockedRequests.length).toBe(9);
  });
});
