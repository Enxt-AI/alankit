import { RedisService } from './redis.service';
import { ServiceUnavailableException } from '@nestjs/common';
import { CONSUME_OTP, RELEASE_LOCK } from './otp-scripts';

jest.mock('redis-service', () => ({
  redis: { eval: jest.fn(), set: jest.fn() },
  setKey: jest.fn(), getKey: jest.fn(), delKey: jest.fn(),
}));

describe('OTP production safeguards', () => {
  const backend = jest.requireMock('redis-service');
  const originalEnv = process.env.NODE_ENV;
  let service: RedisService;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.NODE_ENV = 'production';
    service = new RedisService();
  });
  afterEach(() => { process.env.NODE_ENV = originalEnv; });

  it('fails closed for generation, verification, counters and locks when Redis fails', async () => {
    backend.redis.eval.mockRejectedValue(new Error('offline'));
    backend.redis.set.mockRejectedValue(new Error('offline'));
    backend.setKey.mockRejectedValue(new Error('offline'));
    backend.getKey.mockRejectedValue(new Error('offline'));
    await expect(service.setOTP('phone', 'hash')).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.consumeOTP('phone', 'hash', 5)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.checkRateLimit('rate', 10, 60)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.acquireLock('lock', 120)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.createPhoneProof('phone')).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.isBlocked('lock')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('uses a single atomic operation for verification and phone proof consumption', async () => {
    backend.redis.eval.mockResolvedValue(0);
    await service.consumeOTP('email', 'hash', 5, { token: 'secret-proof', phone: '9876543210' });
    expect(backend.redis.eval).toHaveBeenCalledWith(CONSUME_OTP, 3, 'otp:email', 'lock:otp:email',
      expect.stringMatching(/^otp:phone-proof:[a-f0-9]{64}$/), 'hash', 5, '9876543210');
    expect(backend.getKey).not.toHaveBeenCalled();
    expect(backend.delKey).not.toHaveBeenCalled();
  });

  it.each([[-1, 'expired'], [-2, 'locked'], [-3, 'Phone verification'], [4, 'Attempts left: 4']])(
    'rejects verification result %s', async (result, message) => {
      backend.redis.eval.mockResolvedValue(result);
      await expect(service.consumeOTP('phone', 'hash', 5)).rejects.toThrow(String(message));
    },
  );

  it('does not allow expired generation owners to save a code', async () => {
    backend.redis.eval.mockResolvedValue(0);
    await expect(service.setOTP('phone', 'hash', 300, 30, { key: 'lock', token: 'old' }))
      .rejects.toThrow('OTP request expired');
    expect(backend.setKey).not.toHaveBeenCalled();
  });

  it('returns unique lock ownership tokens and checks ownership when releasing', async () => {
    backend.redis.set.mockResolvedValue('OK');
    const first = await service.acquireLock('lock', 120);
    const second = await service.acquireLock('lock', 120);
    expect(first).not.toEqual(second);
    await service.releaseLock('lock', first!);
    expect(backend.redis.eval).toHaveBeenCalledWith(RELEASE_LOCK, 1, 'lock', first);
  });

  it('does not bypass rate limits for test phone numbers in production', async () => {
    backend.getKey.mockResolvedValue(true);
    await expect(service.checkOtpRateLimits('0123456789', '127.0.0.1')).rejects.toThrow('locked');
  });
});
