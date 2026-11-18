import { BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { KycService } from './kyc.service';
import { Prisma } from 'db-unlistedstock';
import { validateDigilockerIdentity } from './digilocker-validation';
jest.mock('redis-service', () => ({ redis: {}, getKey: jest.fn(), setKey: jest.fn(), delKey: jest.fn() }));

describe('DigiLocker verification and concurrency', () => {
  const model = {
    pan: { panNumber: 'ABCDE1234F', name: 'Test User' },
    maskedAdharNumber: 'XXXXXXXX1234',
    name: 'Test User', dob: '01-01-1990',
  };
  let db: any;
  let email: any;
  let service: KycService;
  let user: any;
  let fetchMock: jest.SpyInstance;
  const response = (data: any, status = 200) => ({
    ok: status === 200, status, json: async () => data,
  });

  beforeEach(() => {
    user = { id: 'user-1', kycStatus: 'PENDING', kycData: { digitapTransactionId: 'tx-1' } };
    db = {
      user: {
        findUnique: jest.fn(async () => structuredClone(user)),
        findFirst: jest.fn(async () => null),
        update: jest.fn(async ({ where, data }) => {
          Object.assign(user, structuredClone(data));
          return user;
        }),
        updateMany: jest.fn(async ({ where, data }) => {
          if (where.kycData === Prisma.DbNull) throw new Error('Expected JsonNullableFilter, provided Enum');
          if (where.kycData?.equals === Prisma.DbNull) {
            if (user.kycData != null) return { count: 0 };
          } else if (where.kycData?.equals && JSON.stringify(where.kycData.equals) !== JSON.stringify(user.kycData)) return { count: 0 };
          Object.assign(user, structuredClone(data));
          return { count: 1 };
        }),
      },
      kycDocument: { deleteMany: jest.fn(), createMany: jest.fn() },
      $queryRaw: jest.fn(),
    };
    db.$transaction = jest.fn(async (callback) => callback(db));
    email = { sendKycPendingEmail: jest.fn(), sendKycVerifiedEmail: jest.fn() };
    service = new KycService(db, email, { get: () => 'https://example.test' } as any,
      { createNotification: jest.fn() } as any, { createUserLedger: jest.fn() } as any);
    fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(response({ code: '200', model }) as any);
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    {}, { ...model, pan: undefined }, { ...model, maskedAdharNumber: undefined },
    { ...model, name: '' }, { ...model, dob: '' },
    { ...model, pan: { panNumber: 'invalid' } },
    { ...model, aadhaar: { verified: false } },
  ])('rejects incomplete identity evidence: %j', (value) => {
    expect(() => validateDigilockerIdentity(value)).toThrow(BadRequestException);
  });

  it('checks the full PAN, never masked Aadhaar suffixes, and locks before checking', async () => {
    await service.fetchDigilockerDetails(user.id);
    expect(db.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { not: user.id }, kycData: { path: ['panDetails', 'pan'], equals: 'ABCDE1234F' } },
    }));
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(db.user.findFirst.mock.invocationCallOrder[0]);
    expect(user.kycData.verifiedTransactionId).toBe('tx-1');
  });

  it('rejects an already claimed PAN without verifying the user', async () => {
    db.user.findFirst.mockResolvedValue({ id: 'another-user' });
    await expect(service.fetchDigilockerDetails(user.id)).rejects.toThrow('PAN is already linked');
    expect(user.kycData.panDetails).toBeUndefined();
  });

  it('does not accept a provider business failure in an HTTP 200 response', async () => {
    fetchMock.mockResolvedValue(response({ code: '400', model }) as any);
    await expect(service.fetchDigilockerDetails(user.id)).rejects.toThrow(BadRequestException);
    expect(user.kycData.verifiedTransactionId).toBeUndefined();
  });

  it('does not reuse identity fields from an older attempt', async () => {
    user.kycData.panDetails = { pan: 'ABCDE1234F', verified: true };
    fetchMock.mockResolvedValue(response({ code: '200', model: { ...model, pan: undefined } }) as any);
    await expect(service.fetchDigilockerDetails(user.id)).rejects.toThrow(BadRequestException);
    await expect(service.submitKYC(user.id)).rejects.toThrow(BadRequestException);
  });

  it('makes completed callbacks idempotent', async () => {
    await service.fetchDigilockerDetails(user.id);
    await service.fetchDigilockerDetails(user.id);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it('allows only one concurrent callback to call the provider', async () => {
    const results = await Promise.allSettled([
      service.fetchDigilockerDetails(user.id), service.fetchDigilockerDetails(user.id),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite a reset that happens during a provider request', async () => {
    fetchMock.mockImplementation(async () => {
      user.kycData = { resetAt: new Date().toISOString() };
      return response({ code: '200', model });
    });
    await expect(service.fetchDigilockerDetails(user.id)).rejects.toThrow(ConflictException);
    expect(user.kycData.panDetails).toBeUndefined();
    expect(db.kycDocument.createMany).not.toHaveBeenCalled();
  });

  it('requires both identities from the current transaction at final submission', async () => {
    user.kycData = {
      digitapTransactionId: 'new', verifiedTransactionId: 'old',
      panDetails: { pan: 'ABCDE1234F', verified: true },
      aadhaarDetails: { aadhaar: 'XXXXXXXX1234', verified: true },
    };
    await expect(service.submitKYC(user.id)).rejects.toThrow(BadRequestException);
    expect((await service.getKycStatus(user.id)).canSubmit).toBe(false);
  });

  it('allows only one concurrent submission to notify and approve', async () => {
    await service.fetchDigilockerDetails(user.id);
    user.email = 'test@example.test';
    const results = await Promise.allSettled([service.submitKYC(user.id), service.submitKYC(user.id)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(email.sendKycVerifiedEmail).toHaveBeenCalledTimes(1);
  });

  it('claims only one new session and reuses its URL on a retry', async () => {
    fetchMock.mockResolvedValue(response({ code: '200', model: { transactionId: 'new', kycUrl: 'https://example.test/kyc' } }) as any);
    const results = await Promise.allSettled([
      service.generateDigilockerUrl(user.id, {}), service.generateDigilockerUrl(user.id, {}),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    await service.generateDigilockerUrl(user.id, {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('claims only one first session when KYC data is database NULL', async () => {
    user.kycData = null;
    fetchMock.mockResolvedValue(response({ code: '200', model: { transactionId: 'new', kycUrl: 'https://example.test/kyc' } }) as any);

    const results = await Promise.allSettled([
      service.generateDigilockerUrl(user.id, {}), service.generateDigilockerUrl(user.id, {}),
    ]);

    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(db.user.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { id: user.id, kycData: { equals: Prisma.DbNull } },
    }));
    expect(user.kycData.digitapTransactionId).toBe('new');
    await service.generateDigilockerUrl(user.id, {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('bounds network requests and releases a failed processing claim for retry', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'));
    await expect(service.fetchDigilockerDetails(user.id)).rejects.toThrow(ServiceUnavailableException);
    expect(fetchMock.mock.calls[0][1].signal).toBeDefined();
    expect(user.kycData.attemptState).toBe('AWAITING_CONSENT');
  });



  it('does not create another session while verification is processing', async () => {
    user.kycData.attemptState = 'PROCESSING';
    user.kycData.processingStartedAt = new Date().toISOString();
    await expect(service.generateDigilockerUrl(user.id, {})).rejects.toThrow(ConflictException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
