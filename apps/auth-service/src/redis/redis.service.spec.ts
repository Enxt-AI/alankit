import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

jest.mock('redis-service', () => {
  return {
    redis: {
      ping: jest.fn(),
      eval: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      setex: jest.fn(),
      on: jest.fn(),
      ttl: jest.fn(),
      expire: jest.fn(),
      scan: jest.fn(),
    },
    setKey: jest.fn(),
    getKey: jest.fn(),
    delKey: jest.fn(),
  };
});

describe('RedisService', () => {
  let service: RedisService;
  let mockRedis: any;
  let mockSetKey: any;
  let mockGetKey: any;
  let mockDelKey: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const redisServiceMock = jest.requireMock('redis-service');
    mockRedis = redisServiceMock.redis;
    mockSetKey = redisServiceMock.setKey;
    mockGetKey = redisServiceMock.getKey;
    mockDelKey = redisServiceMock.delKey;

    const module: TestingModule = await Test.createTestingModule({
      providers: [RedisService],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('production review number limits', () => {
    let environment: string | undefined;
    let limits: jest.SpyInstance;

    beforeEach(() => {
      environment = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      jest.spyOn(service, 'isBlocked').mockResolvedValue(false);
      jest.spyOn(service, 'getCooldownRemaining').mockResolvedValue(0);
      jest.spyOn(service, 'trackUniqueNumberPerIp').mockResolvedValue(true);
      jest.spyOn(service, 'trackDeviceFingerprint').mockResolvedValue(true);
      jest.spyOn(service, 'incrementRateLimit').mockResolvedValue(undefined);
      jest.spyOn(service, 'setCooldown').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'checkOtpMinuteLimit').mockResolvedValue(true);
      limits = jest.spyOn(service, 'checkRateLimit').mockImplementation(async key =>
        !/^rate:otp:(daily|hourly|request):/.test(key));
    });

    afterEach(() => {
      jest.restoreAllMocks();
      if (environment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = environment;
    });

    it('ignores request quotas without deleting verification state', async () => {
      await expect(service.checkOtpRateLimits('0123456789', 'review-ip', 'review-device'))
        .resolves.toEqual({ captchaRequired: false });
      expect(limits).not.toHaveBeenCalled();
      expect(service.trackDeviceFingerprint).not.toHaveBeenCalled();
      expect((service as any).checkOtpMinuteLimit).not.toHaveBeenCalled();
      expect(service.setCooldown).not.toHaveBeenCalled();
      expect(mockDelKey).not.toHaveBeenCalled();
    });

    it.each(['9876543210', '0123456789@example.com'])('keeps daily limits for %s', async target => {
      await expect(service.checkOtpRateLimits(target, 'review-ip'))
        .rejects.toThrow('Daily OTP request limit exceeded');
    });

    it('ignores an existing resend cooldown', async () => {
      jest.spyOn(service, 'getCooldownRemaining').mockResolvedValue(25);
      await expect(service.checkOtpRateLimits('0123456789', 'review-ip'))
        .resolves.toEqual({ captchaRequired: false });
    });

    it('still enforces verification lockouts', async () => {
      jest.spyOn(service, 'isBlocked').mockImplementation(async key => key === 'lock:otp:0123456789');
      await expect(service.checkOtpRateLimits('0123456789', 'review-ip'))
        .rejects.toThrow('Verification locked');
    });

    it('does not charge shared IP or minute quotas for requests that send no SMS', async () => {
      limits.mockImplementation(async key => key !== 'rate:otp:ip:review-ip');
      await expect(service.checkOtpRateLimits('0123456789', 'review-ip'))
        .resolves.toEqual({ captchaRequired: false });
      limits.mockResolvedValue(true);
      jest.spyOn(service as any, 'checkOtpMinuteLimit').mockResolvedValue(false);
      await expect(service.checkOtpRateLimits('0123456789', 'review-ip'))
        .resolves.toEqual({ captchaRequired: false });
    });
  });

  describe('ping', () => {
    it('should return status from redis when ping succeeds', async () => {
      mockRedis.ping.mockResolvedValueOnce('PONG');
      const result = await service.ping();
      expect(result).toBe('PONG');
    });

    it('should return down when ping fails', async () => {
      mockRedis.ping.mockRejectedValueOnce(new Error('Connection error'));
      const result = await service.ping();
      expect(result).toBe('down');
    });
  });

  describe('setOTP and getOTP', () => {
    it('should set and get OTP via redis-service when online', async () => {
      mockSetKey.mockResolvedValueOnce(undefined);
      mockGetKey.mockResolvedValueOnce({ otp: '123456', retries: 0 });

      await service.setOTP('1234567890', '123456', 300);
      const result = await service.getOTP('1234567890');

      expect(mockSetKey).toHaveBeenCalledWith(
        'otp:1234567890',
        expect.objectContaining({ otp: '123456', retries: 0 }),
        300,
      );
      expect(result).toEqual(expect.objectContaining({ otp: '123456', retries: 0 }));
    });

    it('should fall back to in-memory cache when redis-service fails', async () => {
      mockSetKey.mockRejectedValueOnce(new Error('Redis down'));
      mockGetKey.mockRejectedValueOnce(new Error('Redis down'));

      await service.setOTP('1234567890', '123456', 300);
      const result = await service.getOTP('1234567890');

      expect(result).toEqual(expect.objectContaining({ otp: '123456', retries: 0 }));
    });
  });

  describe('updateRetries', () => {
    it('should increment retries via redis eval when online', async () => {
      mockRedis.eval.mockResolvedValueOnce(2);
      const result = await service.updateRetries('1234567890', 5);
      expect(result).toBe(2);
    });

    it('should throw if redis eval returns -1 (max retries)', async () => {
      mockRedis.eval.mockResolvedValueOnce(-1);
      await expect(service.updateRetries('1234567890', 5)).rejects.toThrow();
    });

    it('should fall back to in-memory map when redis fails', async () => {
      mockRedis.eval.mockRejectedValueOnce(new Error('Redis down'));
      
      // Seed OTP in fallback cache
      mockSetKey.mockRejectedValueOnce(new Error('Redis down'));
      await service.setOTP('1234567890', '123456', 300);

      const result = await service.updateRetries('1234567890', 5);
      expect(result).toBe(1);
    });
  });

  describe('deleteUserData', () => {
    it('clears only the deleted user records, including phone aliases and all session pages', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['4', ['session:mine', 'session:other']])
        .mockResolvedValueOnce(['0', ['session:mine2']])
        .mockResolvedValueOnce(['0', ['user:sessions:user1:USER', 'user:sessions:user2:USER']]);
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user1' }))
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user2' }))
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user1' }));

      await service.deleteUserData({ id: 'user1', phone: '+919876543210', email: 'Test@Example.com' });

      const removed = mockRedis.del.mock.calls.flat();
      expect(removed).toEqual(expect.arrayContaining([
        'session:mine', 'session:mine2', 'user:sessions:user1:USER',
        'user:status:user1', 'user:known_devices:user1', 'user-session-version:user1',
        'active-session:BROWSER:user1', 'active-session:APK:user1',
        'otp:9876543210', 'otp:+919876543210', 'otp:919876543210',
        'otp:test@example.com', 'rate:otp:minute:9876543210',
        'rate:otp:daily:test@example.com', 'cooldown:otp:9876543210', 'lock:otp:9876543210',
      ]));
      expect(removed).not.toContain('session:other');
      expect(removed).not.toContain('user:sessions:user2:USER');
      expect(removed.some((key: string) => key.startsWith('rate:otp:ip:') || key === 'rate:otp:global')).toBe(false);
    });

    it('clears local fallback data and reports Redis failure without dropping the revocation version', async () => {
      const cache = (service as any).fallbackCache;
      cache.set('otp:9876543210', { value: 'otp', expiry: Date.now() + 60000 });
      cache.set('session:mine', { value: { userId: 'user1' }, expiry: Date.now() + 60000 });
      cache.set('session:other', { value: { userId: 'user2' }, expiry: Date.now() + 60000 });
      cache.set('user-session-version:user1', { value: 2, expiry: Date.now() + 60000 });
      mockRedis.scan.mockRejectedValueOnce(new Error('Redis unavailable'));

      await expect(service.deleteUserData({ id: 'user1', phone: '9876543210' }))
        .rejects.toThrow('Redis unavailable');
      expect(cache.has('otp:9876543210')).toBe(false);
      expect(cache.has('session:mine')).toBe(false);
      expect(cache.has('session:other')).toBe(true);
      expect(cache.has('user-session-version:user1')).toBe(true);
    });
  });

  describe('checkOtpRateLimits', () => {
    it('should reject a third request and allow requests again after reset', async () => {
      mockRedis.eval.mockRejectedValue(new Error('Redis down'));
      const checkMinuteLimit = () => (service as any).checkOtpMinuteLimit('1234567890');

      expect(await checkMinuteLimit()).toBe(true);
      expect(await checkMinuteLimit()).toBe(true);
      expect(await checkMinuteLimit()).toBe(false);
      await service.resetOtpRateLimits('1234567890');
      expect(await checkMinuteLimit()).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith(
        'rate:otp:minute:1234567890',
        'rate:otp:request:1234567890',
        'cooldown:otp:1234567890',
        'cooldown:otp:resends:1234567890',
      );
    });

    it('should expire the minute counter 60 seconds after the first request', async () => {
      mockRedis.eval.mockRejectedValue(new Error('Redis down'));
      const now = jest.spyOn(Date, 'now').mockReturnValue(100000);
      try {
        const checkMinuteLimit = () => (service as any).checkOtpMinuteLimit('1234567890');
        expect(await checkMinuteLimit()).toBe(true);
        now.mockReturnValue(130000);
        expect(await checkMinuteLimit()).toBe(true);
        now.mockReturnValue(159999);
        expect(await checkMinuteLimit()).toBe(false);
        now.mockReturnValue(160000);
        expect(await checkMinuteLimit()).toBe(true);
      } finally {
        now.mockRestore();
      }
    });

    it('should throw BadRequestException if target is locked', async () => {
      mockGetKey.mockImplementation(async (key: string) => {
        if (key.startsWith('lock:otp:')) return true;
        return null;
      });

      await expect(service.checkOtpRateLimits('1234567890', '127.0.0.1'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if IP is blocked', async () => {
      mockGetKey.mockImplementation(async (key: string) => {
        if (key.startsWith('blocklist:ip:')) return true;
        return null;
      });

      await expect(service.checkOtpRateLimits('1234567890', '127.0.0.1'))
        .rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if target is in cooldown', async () => {
      mockRedis.ttl.mockResolvedValueOnce(45); // Cooldown remaining
      mockGetKey.mockImplementation(async (key: string) => {
        if (key.startsWith('cooldown:')) return 'cooldown-active';
        return null;
      });

      await expect(service.checkOtpRateLimits('1234567890', '127.0.0.1'))
        .rejects.toThrow(BadRequestException);
    });

    it('should not require CAPTCHA on repeated requests', async () => {
      mockGetKey.mockImplementation(async (key: string) => {
        if (key.startsWith('rate:otp:request:')) return 2; // current count is 2 (3rd request)
        return null;
      });
      mockRedis.ttl.mockResolvedValue(-2); // no cooldown
      mockRedis.eval.mockResolvedValue(1); // rate check passes (returns 1 for allowed)

      const result = await service.checkOtpRateLimits('1234567890', '127.0.0.1');
      expect(result.captchaRequired).toBe(false);
    });
  });
});
