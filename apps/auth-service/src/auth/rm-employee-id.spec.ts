import { BadRequestException, NotFoundException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

jest.mock('redis-service', () => ({ redis: { on: jest.fn() } }));
jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed-password') }));

const rm = {
  id: 'rm-1',
  name: 'Rahul Sharma',
  email: 'rahul@example.com',
  employeeId: '00127',
  status: 'ACTIVE',
  createdAt: new Date('2026-10-15T00:00:00Z'),
};

const credentials = {
  name: rm.name,
  email: rm.email,
  password: 'StrongPassword1!',
};

const portals = [
  {
    label: 'branch',
    role: 'BRANCH',
    wrongRole: 'DISTRIBUTOR',
    parentId: 'branch-1',
    parentField: 'branchId',
    parentModel: 'branch',
    model: 'internalRM',
    createMethod: 'createInternalRm',
    updateMethod: 'updateInternalRmEmployeeId',
    listMethod: 'getBranchInternalRms',
    listAllMethod: 'getAllInternalRms',
    createUrl: '/auth/branch/internal-rm',
    updateUrl: `/auth/branch/internal-rm/${rm.id}`,
    listUrl: '/auth/branch/internal-rms',
    rmType: 'INTERNAL_RM',
  },
  {
    label: 'distributor',
    role: 'DISTRIBUTOR',
    wrongRole: 'BRANCH',
    parentId: 'distributor-1',
    parentField: 'distributorId',
    parentModel: 'distributor',
    model: 'distributorRM',
    createMethod: 'createDistributorRm',
    updateMethod: 'updateDistributorRmEmployeeId',
    listMethod: 'getDistributorRms',
    listAllMethod: 'getAllDistributorRms',
    createUrl: '/auth/distributor/distributor-rm',
    updateUrl: `/auth/distributor/distributor-rm/${rm.id}`,
    listUrl: '/auth/distributor/distributor-rms',
    rmType: 'DISTRIBUTOR_RM',
  },
] as const;

describe.each(portals)('$label RM employee ID persistence', (portal) => {
  let service: AuthService;
  let records: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
  };

  beforeEach(() => {
    records = {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async ({ data }) => ({
        ...rm,
        employeeId: data.employeeId ?? null,
      })),
      update: jest.fn().mockImplementation(async ({ data }) => ({
        ...rm,
        employeeId: data.employeeId,
      })),
      findMany: jest.fn().mockResolvedValue([
        rm,
        { ...rm, id: 'legacy-rm', employeeId: null },
      ]),
    };
    service = new AuthService({
      [portal.model]: records,
      [portal.parentModel]: { findUnique: jest.fn().mockResolvedValue({ id: portal.parentId }) },
    } as any, {} as any, {} as any, {} as any);
  });

  it('persists the trimmed text ID with the assigned parent and returns it without credentials', async () => {
    const result = await service[portal.createMethod](
      portal.parentId, credentials.name, credentials.email, credentials.password, '  00127  ',
    );

    expect(result.employeeId).toBe('00127');
    const query = records.create.mock.calls[0][0];
    expect(query.data).toMatchObject({
      employeeId: '00127',
      [portal.parentField]: portal.parentId,
      passwordHash: 'hashed-password',
    });
    expect(query.select.employeeId).toBe(true);
    expect(query.select).not.toHaveProperty('passwordHash');
    expect(query.select).not.toHaveProperty('hashedRefreshToken');
  });

  it('returns employee IDs and legacy null values from parent-scoped and admin lists', async () => {
    const scoped = await service[portal.listMethod](portal.parentId);
    const all = await service[portal.listAllMethod]();

    expect(scoped.map((record) => record.employeeId)).toEqual(['00127', null]);
    expect(all.map((record) => record.employeeId)).toEqual(['00127', null]);
    expect(records.findMany.mock.calls[0][0].where).toEqual({ [portal.parentField]: portal.parentId });
    for (const [query] of records.findMany.mock.calls) {
      expect(query.select.employeeId).toBe(true);
      expect(query.select).not.toHaveProperty('passwordHash');
      expect(query.select).not.toHaveProperty('hashedRefreshToken');
    }
  });

  it('preserves admin creation without an employee ID', async () => {
    await expect(service[portal.createMethod](
      portal.parentId, credentials.name, credentials.email, credentials.password,
    )).resolves.toMatchObject({ employeeId: null });
    expect(records.create).toHaveBeenCalledTimes(1);
  });

  it('allows setting or updating employee ID for an existing RM belonging to the parent', async () => {
    records.findUnique.mockResolvedValueOnce({ id: rm.id, [portal.parentField]: portal.parentId, employeeId: null });
    const updated = await service[portal.updateMethod](portal.parentId, rm.id, '  EMP-099  ');
    expect(updated.employeeId).toBe('EMP-099');
    expect(records.update).toHaveBeenCalledWith({
      where: { id: rm.id },
      data: { employeeId: 'EMP-099' },
      select: { id: true, name: true, email: true, employeeId: true, status: true, createdAt: true },
    });
  });

  it('rejects updating an employee ID if the RM already has one assigned', async () => {
    records.findUnique.mockResolvedValueOnce({
      id: rm.id,
      [portal.parentField]: portal.parentId,
      employeeId: 'EXISTING-001',
    });
    await expect(service[portal.updateMethod](portal.parentId, rm.id, 'NEW-002'))
      .rejects.toThrow(BadRequestException);
    expect(records.update).not.toHaveBeenCalled();
  });

  it('rejects updating an RM that does not exist or belongs to another parent', async () => {
    records.findUnique.mockResolvedValueOnce(null);
    await expect(service[portal.updateMethod](portal.parentId, 'missing', '00127'))
      .rejects.toThrow(NotFoundException);

    records.findUnique.mockResolvedValueOnce({ id: rm.id, [portal.parentField]: 'other-parent' });
    await expect(service[portal.updateMethod](portal.parentId, rm.id, '00127'))
      .rejects.toThrow(NotFoundException);
    expect(records.update).not.toHaveBeenCalled();
  });
});

describe('Partner RM employee ID API', () => {
  let app: NestFastifyApplication;
  const auth = {
    createInternalRm: jest.fn(),
    createDistributorRm: jest.fn(),
    updateInternalRmEmployeeId: jest.fn(),
    updateDistributorRmEmployeeId: jest.fn(),
    getBranchInternalRms: jest.fn(),
    getDistributorRms: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: PrismaService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).overrideGuard(JwtAuthGuard).useValue({
      canActivate(context: any) {
        const req = context.switchToHttp().getRequest();
        const role = req.headers['x-test-role'];
        if (!role) throw new UnauthorizedException();
        req.user = {
          type: role === 'SUPER_ADMIN' ? 'ADMIN' : role,
          role,
          ...(role === 'BRANCH' ? { branchId: 'branch-1' } : {}),
          ...(role === 'DISTRIBUTOR' ? { distributorId: 'distributor-1' } : {}),
        };
        return true;
      },
    }).compile();

    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    for (const portal of portals) {
      auth[portal.createMethod].mockResolvedValue({
        ...rm, passwordHash: 'hidden', hashedRefreshToken: 'hidden',
      });
      auth[portal.updateMethod].mockResolvedValue({
        ...rm, passwordHash: 'hidden', hashedRefreshToken: 'hidden',
      });
      auth[portal.listMethod].mockResolvedValue([
        rm,
        { ...rm, id: 'legacy-rm', employeeId: null },
      ]);
    }
  });

  afterAll(async () => { await app.close(); });

  describe.each(portals)('$label creation and update', (portal) => {
    const request = (payload: object, role: string | undefined = portal.role) => app.inject({
      method: 'POST',
      url: portal.createUrl,
      headers: role ? { 'x-test-role': role } : {},
      payload,
    });

    const patchRequest = (payload: object, role: string | undefined = portal.role) => app.inject({
      method: 'PATCH',
      url: portal.updateUrl,
      headers: role ? { 'x-test-role': role } : {},
      payload,
    });

    const postUpdateRequest = (payload: object, role: string | undefined = portal.role) => app.inject({
      method: 'POST',
      url: portal.updateUrl,
      headers: role ? { 'x-test-role': role } : {},
      payload,
    });

    it.each([
      ['missing', {}],
      ['null', { employeeId: null }],
      ['number', { employeeId: 127 }],
      ['empty', { employeeId: '' }],
      ['whitespace', { employeeId: ' \t\n ' }],
      ['overlong', { employeeId: 'A'.repeat(101) }],
    ])('rejects a %s employee ID before calling the service', async (_label, fields) => {
      const response = await request({ ...credentials, ...(fields as object) });

      expect(response.statusCode).toBe(400);
      expect(response.json().message.join(' ')).toMatch(/employee/i);
      expect(auth[portal.createMethod]).not.toHaveBeenCalled();

      const patchRes = await patchRequest(fields as object);
      expect(patchRes.statusCode).toBe(400);
      expect(auth[portal.updateMethod]).not.toHaveBeenCalled();
    });

    it('passes the normalized ID and authenticated parent to the service, preserving leading zeros', async () => {
      const response = await request({ ...credentials, employeeId: '  00127  ' });

      expect(response.statusCode).toBe(201);
      expect(auth[portal.createMethod]).toHaveBeenCalledWith(
        portal.parentId, credentials.name, credentials.email, credentials.password, '00127',
      );
      expect(response.json().rm.employeeId).toBe('00127');
      expect(response.json().rm).not.toHaveProperty('passwordHash');
      expect(response.json().rm).not.toHaveProperty('hashedRefreshToken');
    });

    it('updates the employee ID for an older RM and strips credentials', async () => {
      const response = await patchRequest({ employeeId: '  00127  ' });

      expect(response.statusCode).toBe(200);
      expect(auth[portal.updateMethod]).toHaveBeenCalledWith(
        portal.parentId, rm.id, '00127',
      );
      expect(response.json().rm.employeeId).toBe('00127');
      expect(response.json().rm).not.toHaveProperty('passwordHash');
      expect(response.json().rm).not.toHaveProperty('hashedRefreshToken');

      const postResponse = await postUpdateRequest({ employeeId: '  00127  ' });
      expect(postResponse.statusCode).toBe(200);
      expect(postResponse.json().rm.employeeId).toBe('00127');
    });

    it('requires authentication and rejects other account types on create and update', async () => {
      const payload = { ...credentials, employeeId: '00127' };
      const anonymous = await app.inject({ method: 'POST', url: portal.createUrl, payload });
      expect(anonymous.statusCode).toBe(401);
      const anonymousPatch = await app.inject({ method: 'PATCH', url: portal.updateUrl, payload: { employeeId: '00127' } });
      expect(anonymousPatch.statusCode).toBe(401);
      for (const role of [portal.wrongRole, 'INTERNAL_RM', 'DISTRIBUTOR_RM', 'SUPER_ADMIN']) {
        const response = await request(payload, role);
        expect(response.statusCode).toBe(401);
        const patchRes = await patchRequest({ employeeId: '00127' }, role);
        expect(patchRes.statusCode).toBe(401);
      }
      expect(auth[portal.createMethod]).not.toHaveBeenCalled();
      expect(auth[portal.updateMethod]).not.toHaveBeenCalled();
    });

    it('rejects a caller-supplied parent assignment', async () => {
      const response = await request({
        ...credentials, employeeId: '00127', [portal.parentField]: 'another-parent',
      });
      expect(response.statusCode).toBe(400);
      expect(auth[portal.createMethod]).not.toHaveBeenCalled();
    });

    it('includes saved employee IDs and null legacy IDs in the parent directory', async () => {
      const response = await app.inject({
        method: 'GET', url: portal.listUrl, headers: { 'x-test-role': portal.role },
      });

      expect(response.statusCode).toBe(200);
      expect(auth[portal.listMethod]).toHaveBeenCalledWith(portal.parentId);
      expect(response.json().rms.map((record: any) => record.employeeId)).toEqual(['00127', null]);
    });

    it('keeps the admin creation endpoint compatible without an employee ID', async () => {
      auth[portal.createMethod].mockResolvedValueOnce({ ...rm, employeeId: null });
      const response = await app.inject({
        method: 'POST',
        url: '/auth/admin/rms',
        headers: { 'x-test-role': 'SUPER_ADMIN' },
        payload: { ...credentials, type: portal.rmType, parentId: portal.parentId },
      });

      expect(response.statusCode).toBe(201);
      expect(auth[portal.createMethod]).toHaveBeenCalledWith(
        portal.parentId, credentials.name, credentials.email, credentials.password,
      );
      expect(response.json().rm.employeeId).toBeNull();
    });
  });
});
