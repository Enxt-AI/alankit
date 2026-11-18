import { AuthService } from './auth.service';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CompleteSignupDto } from './dto/complete-signup.dto';

jest.mock('redis-service', () => ({ redis: { on: jest.fn() } }));

describe('Redis-only signup until name completion', () => {
  let auth: AuthService;
  let db: any;
  let redis: any;
  let email: any;
  let session: jest.SpyInstance;
  const pending = { phone: '9876543210', email: 'new@example.com' };

  beforeEach(() => {
    db = { user: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
      $transaction: jest.fn() };
    db.$transaction.mockImplementation(async (callback: any) => callback(db));
    redis = { consumeOTP: jest.fn().mockResolvedValue(undefined), createPhoneProof: jest.fn().mockResolvedValue('phone-proof'),
      createPendingSignup: jest.fn().mockResolvedValue('signup-proof'), takePendingSignup: jest.fn().mockResolvedValue(pending),
      recordOtpMetric: jest.fn().mockResolvedValue(undefined), resetOtpRateLimits: jest.fn().mockResolvedValue(undefined),
      restorePendingSignup: jest.fn().mockResolvedValue(undefined) };
    email = { sendWelcomeEmail: jest.fn().mockResolvedValue({ success: true }) };
    auth = new AuthService(db, redis, {} as any, email);
    session = jest.spyOn(auth, 'generateToken').mockResolvedValue('session-token');
  });

  function expectNoAccountOrSession() {
    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
    expect(session).not.toHaveBeenCalled();
    expect(email.sendWelcomeEmail).not.toHaveBeenCalled();
  }

  it('does not create an account after phone OTP verification', async () => {
    const result = await auth.verifyPhoneOTP(pending.phone, '123456');
    expect(result).toMatchObject({ needsEmail: true, user: null, phoneVerificationToken: 'phone-proof' });
    expectNoAccountOrSession();
  });

  it('keeps legacy incomplete records unchanged while verifying the phone', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'legacy', phone: pending.phone, email: null, isActive: false });
    await auth.verifyPhoneOTP(pending.phone, '123456');
    expectNoAccountOrSession();
  });

  it('keeps both verified contacts in Redis after email verification', async () => {
    const result = await auth.verifyEmailOTP(pending.email, '123456', pending.phone, {}, 'phone-proof');
    expect(result).toMatchObject({ needsName: true, signupToken: 'signup-proof' });
    expect(redis.createPendingSignup).toHaveBeenCalledWith({ ...pending, existingUserId: undefined });
    expect(result.token).toBeUndefined();
    expectNoAccountOrSession();
  });

  it('does not let email-only requests bypass phone verification and name', async () => {
    await expect(auth.verifyEmailOTP(pending.email, '123456')).rejects.toThrow('sign up with your phone');
    expect(redis.createPendingSignup).not.toHaveBeenCalled();
    expectNoAccountOrSession();
  });

  it.each(['', '  ', ' ab ', '123', 'A'.repeat(101)])('rejects invalid names before consuming signup state: %j', async (name) => {
    await expect(auth.completeSignup(name, 'signup-proof')).rejects.toThrow('full name');
    expect(redis.takePendingSignup).not.toHaveBeenCalled();
    expectNoAccountOrSession();
    expect((await validate(plainToInstance(CompleteSignupDto, { fullName: name }))).length).toBeGreaterThan(0);
  });

  it('rejects missing or expired signup proof without database writes', async () => {
    await expect(auth.completeSignup('Test User', undefined)).rejects.toThrow('Signup expired');
    redis.takePendingSignup.mockRejectedValueOnce(new BadRequestException('Signup expired'));
    await expect(auth.completeSignup('Test User', 'expired')).rejects.toThrow('Signup expired');
    expectNoAccountOrSession();
  });

  it('commits all three fields before starting the session', async () => {
    const created = { id: 'new-user', ...pending, fullName: 'Test User', kycStatus: 'PENDING' };
    db.user.create.mockResolvedValue(created);
    session.mockImplementation(async () => {
      expect(db.user.create).toHaveBeenCalledWith({ data: { ...pending, fullName: 'Test User' } });
      await expect(db.$transaction.mock.results[0].value).resolves.toEqual(created);
      return 'session-token';
    });
    const result = await auth.completeSignup('  Test User  ', 'signup-proof');
    expect(result.token).toBe('session-token');
    expect(db.user.create.mock.invocationCallOrder[0]).toBeLessThan(session.mock.invocationCallOrder[0]);
    expect(email.sendWelcomeEmail).toHaveBeenCalledWith({ email: pending.email, fullName: 'Test User' });
  });

  it('rejects a duplicate submit before starting a second session', async () => {
    let available = true;
    redis.takePendingSignup.mockImplementation(async () => {
      if (!available) throw new BadRequestException('already completed');
      available = false;
      return pending;
    });
    db.user.create.mockResolvedValue({ id: 'new-user', ...pending, fullName: 'Test User' });
    const results = await Promise.allSettled([auth.completeSignup('Test User', 'proof'), auth.completeSignup('Test User', 'proof')]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(db.user.create).toHaveBeenCalledTimes(1);
    expect(session).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite an account created by another signup', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'another-user', ...pending });
    await expect(auth.completeSignup('Test User', 'proof')).rejects.toThrow('already exists');
    expectNoAccountOrSession();
  });

  it('does not start a session if the database transaction fails', async () => {
    db.$transaction.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(auth.completeSignup('Test User', 'proof')).rejects.toThrow('database unavailable');
    expect(session).not.toHaveBeenCalled();
    expect(email.sendWelcomeEmail).not.toHaveBeenCalled();
    expect(redis.restorePendingSignup).toHaveBeenCalledWith('proof', pending);
  });

  it('does not restore signup state after a permanent conflict', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'another-user', ...pending });
    await expect(auth.completeSignup('Test User', 'proof')).rejects.toThrow('already exists');
    expect(redis.restorePendingSignup).not.toHaveBeenCalled();
  });

  it('restores signup bound to the committed user if session creation fails', async () => {
    db.user.create.mockResolvedValue({ id: 'new-user', ...pending, fullName: 'Test User' });
    session.mockRejectedValueOnce(new Error('session store down'));
    await expect(auth.completeSignup('Test User', 'proof')).rejects.toThrow('session store down');
    expect(redis.restorePendingSignup).toHaveBeenCalledWith('proof', { ...pending, existingUserId: 'new-user' });
  });

  it('allows returning users with complete accounts to log in normally', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'returning-user', ...pending, fullName: 'Test User', isActive: true });
    expect((await auth.verifyPhoneOTP(pending.phone, '123456')).token).toBe('session-token');
    expect((await auth.verifyEmailOTP(pending.email, '123456')).token).toBe('session-token');
    expect(redis.createPendingSignup).not.toHaveBeenCalled();
    expect(db.user.create).not.toHaveBeenCalled();
  });
});
