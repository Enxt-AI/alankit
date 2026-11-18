

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { KycService } from './kyc.service';
jest.mock('redis-service', () => ({ redis: {}, getKey: jest.fn(), setKey: jest.fn(), delKey: jest.fn() }));

describe('KycService - 2 KYC updates per year post 1st successful KYC', () => {
  let service: KycService;
  let mockPrisma: any;
  let mockEmail: any;
  let mockConfig: any;
  let mockNotifications: any;
  let mockAccounting: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn(),
      },
      kycDocument: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    mockPrisma.$queryRaw = jest.fn().mockResolvedValue([]);
    mockPrisma.$transaction = jest.fn((callback) => callback(mockPrisma));
    mockEmail = {
      sendKycVerifiedEmail: jest.fn().mockResolvedValue(true),
      sendKycPendingEmail: jest.fn().mockResolvedValue(true),
    };
    mockConfig = {
      get: jest.fn().mockReturnValue('mock-val'),
    };
    mockNotifications = {
      createNotification: jest.fn().mockResolvedValue(true),
    };
    mockAccounting = {
      createUserLedger: jest.fn().mockResolvedValue(true),
    };

    service = new KycService(
      mockPrisma,
      mockEmail,
      mockConfig,
      mockNotifications,
      mockAccounting,
    );
  });

  describe('checkKycUpdateEligibility', () => {
    it('allows updates if user has never been verified (initial KYC)', () => {
      const user = {
        kycStatus: 'PENDING',
        kycData: {},
      };
      const result = service.checkKycUpdateEligibility(user);
      expect(result.allowed).toBe(true);
      expect(result.hasBeenVerified).toBe(false);
      expect(result.updatesThisYear).toBe(0);
      expect(result.updatesRemaining).toBe(2);
    });

    it('allows 1st update if user was previously verified and has 0 updates', () => {
      const user = {
        kycStatus: 'VERIFIED',
        kycData: {
          firstVerifiedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          kycUpdates: [],
        },
      };
      const result = service.checkKycUpdateEligibility(user);
      expect(result.allowed).toBe(true);
      expect(result.hasBeenVerified).toBe(true);
      expect(result.updatesThisYear).toBe(0);
      expect(result.updatesRemaining).toBe(2);
    });

    it('allows 2nd update if user has 1 update in the past year', () => {
      const user = {
        kycStatus: 'VERIFIED',
        kycData: {
          firstVerifiedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
          kycUpdates: [
            { timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() },
          ],
        },
      };
      const result = service.checkKycUpdateEligibility(user);
      expect(result.allowed).toBe(true);
      expect(result.hasBeenVerified).toBe(true);
      expect(result.updatesThisYear).toBe(1);
      expect(result.updatesRemaining).toBe(1);
    });

    it('blocks 3rd update when user has already updated 2 times in the last 365 days', () => {
      const update1 = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
      const update2 = new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString();

      const user = {
        kycStatus: 'VERIFIED',
        kycData: {
          firstVerifiedAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
          kycUpdates: [{ timestamp: update1 }, { timestamp: update2 }],
        },
      };
      const result = service.checkKycUpdateEligibility(user);
      expect(result.allowed).toBe(false);
      expect(result.hasBeenVerified).toBe(true);
      expect(result.updatesThisYear).toBe(2);
      expect(result.updatesRemaining).toBe(0);
      expect(result.nextAvailableDate).toBeDefined();
      expect(result.message).toContain('maximum limit of 2 KYC updates allowed per year');
    });

    it('allows update when an older update drops outside the 365-day rolling window', () => {
      const updateOld = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(); // > 1 year ago
      const updateRecent = new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(); // within 1 year

      const user = {
        kycStatus: 'VERIFIED',
        kycData: {
          firstVerifiedAt: new Date(Date.now() - 500 * 24 * 60 * 60 * 1000).toISOString(),
          kycUpdates: [{ timestamp: updateOld }, { timestamp: updateRecent }],
        },
      };
      const result = service.checkKycUpdateEligibility(user);
      expect(result.allowed).toBe(true);
      expect(result.updatesThisYear).toBe(1);
      expect(result.updatesRemaining).toBe(1);
    });
  });

  describe('resetKyc', () => {
    it('successfully resets and increments update count for a verified user', async () => {
      const user = {
        id: 'usr_1',
        kycStatus: 'VERIFIED',
        kycData: {
          firstVerifiedAt: '2026-01-01T00:00:00.000Z',
          kycUpdates: [],
        },
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue({});

      const response = await service.resetKyc('usr_1');
      expect(response.success).toBe(true);
      expect(response.kycUpdatesRemaining).toBe(1);

      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'usr_1' }),
          data: expect.objectContaining({
            kycStatus: 'PENDING',
            kycData: expect.objectContaining({
              firstVerifiedAt: '2026-01-01T00:00:00.000Z',
              kycUpdates: expect.arrayContaining([
                expect.objectContaining({ previousStatus: 'VERIFIED' }),
              ]),
            }),
          }),
        }),
      );
    });

    it('throws BadRequestException when user has already reached 2 updates in the year', async () => {
      const user = {
        id: 'usr_2',
        kycStatus: 'VERIFIED',
        kycData: {
          firstVerifiedAt: '2026-01-01T00:00:00.000Z',
          kycUpdates: [
            { timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
            { timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
          ],
        },
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(service.resetKyc('usr_2')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('getKycStatus', () => {
    it('returns KYC update quota details', async () => {
      const user = {
        id: 'usr_3',
        kycStatus: 'VERIFIED',
        kycData: {
          firstVerifiedAt: '2026-01-01T00:00:00.000Z',
          kycUpdates: [
            { timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
          ],
        },
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const status = await service.getKycStatus('usr_3');
      expect(status.hasBeenVerified).toBe(true);
      expect(status.kycUpdatesCount).toBe(1);
      expect(status.kycUpdatesRemaining).toBe(1);
      expect(status.maxKycUpdatesPerYear).toBe(2);
      expect(status.canUpdateKyc).toBe(true);
    });
  });
});
