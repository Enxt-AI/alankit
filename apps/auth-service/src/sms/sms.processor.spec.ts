import { SmsProcessor } from './sms.processor';
import { createHash } from 'crypto';

jest.mock('redis-service', () => ({ redis: { on: jest.fn() } }));

describe('OTP SMS worker', () => {
  const sender = { sendOtpSmsSync: jest.fn() };
  const redis = { getOTP: jest.fn(), updateOtpDelivery: jest.fn() };
  const worker = new SmsProcessor(sender as any, redis as any);
  const job = { data: { phone: '9876543210', otp: '123456' }, attemptsMade: 2, opts: { attempts: 3 } };
  const hash = createHash('sha256').update('123456').digest('hex');
  beforeEach(() => {
    jest.resetAllMocks();
    redis.updateOtpDelivery.mockResolvedValue(undefined);
  });

  it.each([null, { otp: 'superseded', expiresAt: Date.now() + 60000 }, { otp: hash, expiresAt: 1 }])(
    'does not send an expired, consumed or superseded code', async (record) => {
      redis.getOTP.mockResolvedValue(record);
      await worker.handleSendOtp(job as any);
      expect(sender.sendOtpSmsSync).not.toHaveBeenCalled();
    },
  );

  it('records terminal delivery failure for the current code', async () => {
    redis.getOTP.mockResolvedValue({ otp: hash, expiresAt: Date.now() + 60000 });
    sender.sendOtpSmsSync.mockRejectedValueOnce(new Error('gateway unavailable'));
    await expect(worker.handleSendOtp(job as any)).rejects.toThrow('gateway unavailable');
    expect(redis.updateOtpDelivery).toHaveBeenCalledWith('9876543210', hash, 'failed');
  });

  it('records provider acceptance after a successful send', async () => {
    redis.getOTP.mockResolvedValue({ otp: hash, expiresAt: Date.now() + 60000 });
    sender.sendOtpSmsSync.mockResolvedValueOnce({ success: true });
    await worker.handleSendOtp(job as any);
    expect(redis.updateOtpDelivery).toHaveBeenCalledWith('9876543210', hash, 'accepted');
  });

  it('does not retry a successful SMS when its status update fails', async () => {
    redis.getOTP.mockResolvedValue({ otp: hash, expiresAt: Date.now() + 60000 });
    sender.sendOtpSmsSync.mockResolvedValueOnce({ success: true });
    redis.updateOtpDelivery.mockRejectedValueOnce(new Error('Redis unavailable'));
    await expect(worker.handleSendOtp(job as any)).resolves.toBeUndefined();
    expect(sender.sendOtpSmsSync).toHaveBeenCalledTimes(1);
  });
});
