import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

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

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    sendPhoneOTP: jest.fn(),
    verifyPhoneOTP: jest.fn(),
    sendEmailOTP: jest.fn(),
    verifyEmailOTP: jest.fn(),
    completeSignup: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: PrismaService, useValue: {} },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('sets an HttpOnly phone proof cookie for browser signup', async () => {
    mockAuthService.verifyPhoneOTP.mockResolvedValueOnce({ needsEmail: true,
      user: { id: 'user', phone: '9876543210' }, phoneVerificationToken: 'proof' });
    const res = { setCookie: jest.fn(), clearCookie: jest.fn() };
    const result = await controller.verifyPhoneOTP({ headers: {} },
      { phone: '9876543210', otp: '123456' }, res as any);
    expect(res.setCookie).toHaveBeenCalledWith('phone_verification', 'proof',
      expect.objectContaining({ httpOnly: true, maxAge: 600, sameSite: 'lax' }));
    expect(result).not.toHaveProperty('phoneVerificationToken');
  });

  it('returns the phone proof to mobile clients', async () => {
    mockAuthService.verifyPhoneOTP.mockResolvedValueOnce({ needsEmail: true,
      user: { id: 'user', phone: '9876543210' }, phoneVerificationToken: 'proof' });
    const result = await controller.verifyPhoneOTP({ headers: { 'x-client-type': 'mobile' } },
      { phone: '9876543210', otp: '123456' }, { setCookie: jest.fn(), clearCookie: jest.fn() } as any);
    expect(result).toHaveProperty('phoneVerificationToken', 'proof');
  });

  it('passes the browser proof to email verification', async () => {
    mockAuthService.verifyEmailOTP.mockRejectedValueOnce(new Error('test-stop'));
    const req = { cookies: { phone_verification: 'cookie-proof' }, headers: {} };
    await expect(controller.verifyEmailOTP(req,
      { email: 'user@example.com', otp: '123456', phone: '9876543210' }, {} as any)).rejects.toThrow('test-stop');
    expect(mockAuthService.verifyEmailOTP).toHaveBeenCalledWith('user@example.com', '123456', '9876543210', req, 'cookie-proof');
  });

  it('sets only a temporary signup cookie after email verification', async () => {
    mockAuthService.verifyEmailOTP.mockResolvedValueOnce({ needsName: true, isNewUser: true, signupToken: 'pending-proof' });
    const res = { setCookie: jest.fn(), clearCookie: jest.fn() };
    const result = await controller.verifyEmailOTP({ headers: {}, cookies: { phone_verification: 'phone-proof' } },
      { email: 'new@example.com', otp: '123456', phone: '9876543210' }, res as any);
    expect(result).toMatchObject({ success: true, needsName: true });
    expect(result).not.toHaveProperty('token');
    expect(res.setCookie).toHaveBeenCalledTimes(1);
    expect(res.setCookie).toHaveBeenCalledWith('pending_signup', 'pending-proof',
      expect.objectContaining({ httpOnly: true, maxAge: 600 }));
  });

  it('sets the auth cookie only after final signup succeeds', async () => {
    mockAuthService.completeSignup.mockResolvedValueOnce({ user: { id: 'new-user' }, token: 'session-token' });
    const req = { headers: {}, cookies: { pending_signup: 'pending-proof' } };
    const res = { setCookie: jest.fn(), clearCookie: jest.fn() };
    await controller.completeSignup({ fullName: 'Test User' }, req, res as any);
    expect(mockAuthService.completeSignup).toHaveBeenCalledWith('Test User', 'pending-proof', req);
    expect(res.setCookie).toHaveBeenCalledWith(expect.any(String), 'session-token', expect.objectContaining({ httpOnly: true }));
    expect(res.clearCookie).toHaveBeenCalledWith('pending_signup', expect.any(Object));
  });

  it('does not issue auth cookies on failed completion', async () => {
    mockAuthService.completeSignup.mockRejectedValueOnce(new Error('expired'));
    const res = { setCookie: jest.fn(), clearCookie: jest.fn() };
    await expect(controller.completeSignup({ fullName: 'Test User' }, { headers: {}, cookies: {} }, res as any)).rejects.toThrow('expired');
    expect(res.setCookie).not.toHaveBeenCalled();
  });
});
