import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { JwtService } from '@nestjs/jwt';
import { SmsService } from '../sms/sms.service';
import { EmailService } from 'email-service';

// Mock the redis-service module to prevent it from establishing connection during tests
jest.mock('redis-service', () => ({
  redis: {
    on: jest.fn(),
    ping: jest.fn(),
  },
  setKey: jest.fn(),
  getKey: jest.fn(),
  delKey: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let redis: RedisService;
  let jwt: JwtService;
  let sms: SmsService;
  let email: EmailService;

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

  const mockRedis = {
    consumeOTP: jest.fn().mockResolvedValue(undefined),
    createPhoneProof: jest.fn().mockResolvedValue('phone-proof'),
    recordOtpMetric: jest.fn().mockResolvedValue(undefined),
    resetOtpRateLimits: jest.fn().mockResolvedValue(undefined),
    checkOtpRateLimits: jest.fn(),
    setOTP: jest.fn(),
    getOTP: jest.fn(),
    updateRetries: jest.fn(),
    deleteSession: jest.fn(),
    setSession: jest.fn(),
    acquireLock: jest.fn().mockResolvedValue('lock-owner'),
    releaseLock: jest.fn().mockResolvedValue(undefined),
    getUserActiveSessions: jest.fn().mockResolvedValue([]),
    trackSessionForLimit: jest.fn().mockResolvedValue(undefined),
    isNewDeviceForUser: jest.fn().mockResolvedValue(false),
  };

  const mockJwt = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockSms = {
    sendOtpSms: jest.fn(),
    sendOtpSmsSync: jest.fn(),
  };

  const mockEmail = {
    sendOtpEmail: jest.fn(),
    sendWelcomeEmail: jest.fn(),
    sendNewDeviceLoginAlert: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: JwtService, useValue: mockJwt },
        { provide: SmsService, useValue: mockSms },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
    jwt = module.get<JwtService>(JwtService);
    sms = module.get<SmsService>(SmsService);
    email = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('requires current phone verification before linking email, even if a phone account exists', async () => {
    await expect(service.verifyEmailOTP('user@example.com', '123456', '9876543210'))
      .rejects.toThrow('verify your phone again');
    expect(mockRedis.consumeOTP).not.toHaveBeenCalled();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an invalid phone proof before any account mutation', async () => {
    mockRedis.consumeOTP.mockRejectedValueOnce(new Error('Phone verification expired or invalid'));
    await expect(service.verifyEmailOTP('user@example.com', '123456', '9876543210', {}, 'invalid-proof'))
      .rejects.toThrow('Phone verification');
    expect(mockRedis.consumeOTP).toHaveBeenCalledWith('user@example.com', expect.any(String), 5,
      { phone: '9876543210', token: 'invalid-proof' });
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('issues a phone proof only after consuming the phone OTP', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user', phone: '9876543210', email: null });
    const result = await service.verifyPhoneOTP('9876543210', '123456');
    expect(result.needsEmail).toBe(true);
    expect(result.phoneVerificationToken).toBe('phone-proof');
    expect(mockRedis.consumeOTP.mock.invocationCallOrder[0]).toBeLessThan(mockRedis.createPhoneProof.mock.invocationCallOrder[0]);
  });

  it('does not issue a phone proof after a rejected or replayed OTP', async () => {
    mockRedis.consumeOTP.mockRejectedValueOnce(new Error('OTP expired'));
    await expect(service.verifyPhoneOTP('9876543210', '123456')).rejects.toThrow('expired');
    expect(mockRedis.createPhoneProof).not.toHaveBeenCalled();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('keeps normal phone and email OTPs random in production', async () => {
    const environment = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const generator = jest.spyOn(service as any, 'generateOTP').mockReturnValue('654321');
    mockSms.sendOtpSms.mockResolvedValueOnce({ success: true, ackid: 'QUEUED' });
    mockEmail.sendOtpEmail.mockResolvedValueOnce({ success: true });
    try {
      const result = await service.sendPhoneOTP('9876543210');
      await service.sendEmailOTP('test@example.com');
      expect(mockSms.sendOtpSms).toHaveBeenCalledWith('9876543210', '654321');
      expect(mockEmail.sendOtpEmail).toHaveBeenCalledWith('test@example.com', '654321');
      expect(result.smsQueued).toBe(true);
      expect(result.smsSent).toBeUndefined();
    } finally {
      process.env.NODE_ENV = environment;
      generator.mockRestore();
    }
  });

  it('allows the reserved review phone in production through the normal Redis OTP flow', async () => {
    const environment = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const result = await service.sendPhoneOTP('0123456789');
      expect(result.success).toBe(true);
      expect(mockRedis.checkOtpRateLimits).toHaveBeenCalledWith('0123456789', 'Unknown', undefined);
      expect(mockRedis.setOTP).toHaveBeenCalledWith('0123456789',
        (service as any).hashOtp('123456'), 300, 0,
        { key: 'lock:otp:gen:0123456789', token: 'lock-owner' });
      expect(mockSms.sendOtpSms).not.toHaveBeenCalled();
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockJwt.sign).not.toHaveBeenCalled();
    } finally {
      if (environment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = environment;
    }
  });

  describe('OTP sending and generation', () => {
    it('should generate secure 6-digit OTP and call rate limits', async () => {
      mockRedis.checkOtpRateLimits.mockResolvedValueOnce({ captchaRequired: false });
      mockRedis.setOTP.mockResolvedValueOnce(undefined);
      mockSms.sendOtpSms.mockResolvedValueOnce({ success: true, ackid: 'QUEUED' });

      const result = await service.sendPhoneOTP('9876543210', '127.0.0.1');

      expect(redis.checkOtpRateLimits).toHaveBeenCalledWith('9876543210', '127.0.0.1', undefined);
      expect(redis.setOTP).toHaveBeenCalled();
      expect(sms.sendOtpSms).toHaveBeenCalled();
      expect(result).toHaveProperty('message');
    });

    it('should throw if target rate limiting is active', async () => {
      mockRedis.checkOtpRateLimits.mockRejectedValueOnce(new Error('Too many requests'));

      await expect(service.sendPhoneOTP('9876543210', '127.0.0.1')).rejects.toThrow();
    });
  });
});
