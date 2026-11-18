import { BadRequestException, NotFoundException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { Prisma } from 'db-unlisted-stox';
import { PrismaService } from '../prisma/prisma.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

jest.mock('redis-service', () => ({ redis: { on: jest.fn() } }));

const branch = {
  id: 'branch-1',
  name: 'HO Test',
  email: 'branch@example.com',
  status: 'ACTIVE',
  createdAt: new Date('2026-10-01T00:00:00Z'),
};

const distributor = {
  id: 'dist-1',
  name: 'Acme Dist',
  email: 'distributor@example.com',
  status: 'ACTIVE',
  createdAt: new Date('2026-10-01T00:00:00Z'),
};

describe('Branch detail updates', () => {
  let service: AuthService;
  let db: any;

  beforeEach(() => {
    db = {
      branch: {
        findUnique: jest.fn().mockImplementation(async ({ where }) =>
          where.id === branch.id || where.email === branch.email ? branch : null),
        update: jest.fn().mockImplementation(async ({ data }) => ({ ...branch, ...data })),
      },
    };
    service = new AuthService(db, {} as any, {} as any, {} as any);
  });

  it('updates only name and email, retaining identity and all account relationships', async () => {
    const result = await service.updateBranch(branch.id, '  Updated Branch  ', ' NEW@EXAMPLE.COM ');
    expect(result).toEqual({ ...branch, name: 'Updated Branch', email: 'new@example.com' });
    const update = db.branch.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: branch.id });
    expect(update.data).toEqual({ name: 'Updated Branch', email: 'new@example.com' });
    expect(update.select).not.toHaveProperty('passwordHash');
    expect(update.select).not.toHaveProperty('hashedRefreshToken');
  });

  it('allows a name-only change with the existing email', async () => {
    await expect(service.updateBranch(branch.id, 'Renamed Branch', branch.email))
      .resolves.toMatchObject({ name: 'Renamed Branch', email: branch.email });
  });

  it('rejects a missing branch without writing', async () => {
    await expect(service.updateBranch('missing', 'Branch', branch.email))
      .rejects.toThrow(NotFoundException);
    expect(db.branch.update).not.toHaveBeenCalled();
  });

  it('allows an email shared with another branch (same Branch Manager)', async () => {
    await expect(service.updateBranch(branch.id, 'Branch', 'shared@example.com'))
      .resolves.toMatchObject({ email: 'shared@example.com' });
    expect(db.branch.update).toHaveBeenCalled();
  });

  it.each([
    ['P2025', NotFoundException],
  ])('handles a concurrent database conflict (%s)', async (code, exception) => {
    db.branch.update.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('conflict', {
      code, clientVersion: 'test',
    }));
    await expect(service.updateBranch(branch.id, 'Branch', branch.email)).rejects.toThrow(exception);
  });

  it('does not hide unexpected database failures as a duplicate-email error', async () => {
    db.branch.update.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.updateBranch(branch.id, 'Branch', branch.email))
      .rejects.toThrow('database unavailable');
  });
});

describe('Branch login with a shared Branch Manager email', () => {
  let service: AuthService;
  let db: any;
  let branchA: any;
  let branchB: any;

  beforeEach(async () => {
    const bcrypt = require('bcrypt');
    branchA = { id: 'branch-a', name: 'Branch A', email: 'bm@example.com', status: 'ACTIVE', passwordHash: await bcrypt.hash('PassA@123', 4) };
    branchB = { id: 'branch-b', name: 'Branch B', email: 'bm@example.com', status: 'ACTIVE', passwordHash: await bcrypt.hash('PassB@123', 4) };
    const all = [branchA, branchB];
    db = {
      branch: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => all.find((b) => b.id === where.id) ?? null),
        findMany: jest.fn().mockImplementation(async ({ where }) => all.filter((b) => b.email === where.email)),
      },
    };
    service = new AuthService(db, {} as any, {} as any, {} as any);
  });

  it('logs in to the selected branch with that branch password', async () => {
    await expect(service.branchLogin(' BM@example.com ', 'PassB@123', 'branch-b'))
      .resolves.toMatchObject({ id: 'branch-b' });
  });

  it('rejects another branch password for the selected branch', async () => {
    await expect(service.branchLogin('bm@example.com', 'PassA@123', 'branch-b'))
      .rejects.toThrow('Invalid email or password');
  });

  it('rejects an email that does not belong to the selected branch', async () => {
    await expect(service.branchLogin('other@example.com', 'PassA@123', 'branch-a'))
      .rejects.toThrow('Invalid email or password');
  });

  it('asks for a branch when the shared email is used without one', async () => {
    await expect(service.branchLogin('bm@example.com', 'PassA@123'))
      .rejects.toThrow('Please select your branch to sign in.');
  });
});

describe('Distributor detail updates', () => {
  let service: AuthService;
  let db: any;

  beforeEach(() => {
    db = {
      distributor: {
        findUnique: jest.fn().mockImplementation(async ({ where }) =>
          where.id === distributor.id || where.email === distributor.email ? distributor : null),
        update: jest.fn().mockImplementation(async ({ data }) => ({ ...distributor, ...data })),
      },
    };
    service = new AuthService(db, {} as any, {} as any, {} as any);
  });

  it('updates only name and email, retaining identity and all account relationships', async () => {
    const result = await service.updateDistributor(distributor.id, '  Updated Dist  ', ' NEW@EXAMPLE.COM ');
    expect(result).toEqual({ ...distributor, name: 'Updated Dist', email: 'new@example.com' });
    const update = db.distributor.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: distributor.id });
    expect(update.data).toEqual({ name: 'Updated Dist', email: 'new@example.com' });
    expect(update.select).not.toHaveProperty('passwordHash');
    expect(update.select).not.toHaveProperty('hashedRefreshToken');
  });

  it('allows a name-only change with the existing email', async () => {
    await expect(service.updateDistributor(distributor.id, 'Renamed Dist', distributor.email))
      .resolves.toMatchObject({ name: 'Renamed Dist', email: distributor.email });
  });

  it('rejects a missing distributor without writing', async () => {
    await expect(service.updateDistributor('missing', 'Distributor', distributor.email))
      .rejects.toThrow(NotFoundException);
    expect(db.distributor.update).not.toHaveBeenCalled();
  });

  it('rejects an email belonging to a different distributor without writing', async () => {
    db.distributor.findUnique.mockResolvedValueOnce(distributor).mockResolvedValueOnce({ id: 'dist-2' });
    await expect(service.updateDistributor(distributor.id, 'Distributor', 'taken@example.com'))
      .rejects.toThrow('Distributor with this email already exists');
    expect(db.distributor.update).not.toHaveBeenCalled();
  });

  it.each([
    ['P2002', BadRequestException],
    ['P2025', NotFoundException],
  ])('handles a concurrent database conflict (%s)', async (code, exception) => {
    db.distributor.update.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('conflict', {
      code, clientVersion: 'test',
    }));
    await expect(service.updateDistributor(distributor.id, 'Distributor', distributor.email)).rejects.toThrow(exception);
  });
});

describe('Protected branch and distributor editor API', () => {
  let app: NestFastifyApplication;
  const auth = {
    getAllBranches: jest.fn(),
    getBranchForAdmin: jest.fn(),
    updateBranch: jest.fn(),
    getAllDistributors: jest.fn(),
    getDistributorForAdmin: jest.fn(),
    updateDistributor: jest.fn(),
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
        req.user = { type: role === 'BRANCH' || role === 'DISTRIBUTOR' ? role : 'ADMIN', role };
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
    auth.getAllBranches.mockResolvedValue([branch]);
    auth.getBranchForAdmin.mockResolvedValue({ ...branch, passwordHash: 'hidden', hashedRefreshToken: 'hidden' });
    auth.updateBranch.mockResolvedValue(branch);
    auth.getAllDistributors.mockResolvedValue([distributor]);
    auth.getDistributorForAdmin.mockResolvedValue({ ...distributor, passwordHash: 'hidden', hashedRefreshToken: 'hidden' });
    auth.updateDistributor.mockResolvedValue(distributor);
  });

  afterAll(async () => { await app.close(); });

  const requestBranch = (method: 'GET' | 'PATCH', role?: string, payload?: object) => app.inject({
    method,
    url: `/auth/admin/branches/${branch.id}`,
    headers: role ? { 'x-test-role': role } : {},
    ...(payload ? { payload } : {}),
  });

  const requestDistributor = (method: 'GET' | 'PATCH', role?: string, payload?: object) => app.inject({
    method,
    url: `/auth/admin/distributors/${distributor.id}`,
    headers: role ? { 'x-test-role': role } : {},
    ...(payload ? { payload } : {}),
  });

  it.each(['GET', 'PATCH'] as const)('requires authentication for %s on branches and distributors', async (method) => {
    const branchRes = await requestBranch(method, undefined, { name: branch.name, email: branch.email });
    expect(branchRes.statusCode).toBe(401);
    const distRes = await requestDistributor(method, undefined, { name: distributor.name, email: distributor.email });
    expect(distRes.statusCode).toBe(401);
  });

  it.each([
    ['GET', 'ADMIN'], ['PATCH', 'ADMIN'], ['GET', 'BRANCH'], ['PATCH', 'BRANCH'], ['GET', 'DISTRIBUTOR'], ['PATCH', 'DISTRIBUTOR'],
  ] as const)('forbids %s to the %s role', async (method, role) => {
    const branchRes = await requestBranch(method, role, { name: branch.name, email: branch.email });
    expect(branchRes.statusCode).toBe(403);
    const distRes = await requestDistributor(method, role, { name: distributor.name, email: distributor.email });
    expect(distRes.statusCode).toBe(403);
  });

  it('reveals the edit email only to a super admin and never returns credentials', async () => {
    const branchRes = await requestBranch('GET', 'SUPER_ADMIN');
    expect(branchRes.statusCode).toBe(200);
    expect(branchRes.json().branch.email).toBe(branch.email);
    expect(branchRes.json().branch).not.toHaveProperty('passwordHash');
    expect(branchRes.json().branch).not.toHaveProperty('hashedRefreshToken');

    const distRes = await requestDistributor('GET', 'SUPER_ADMIN');
    expect(distRes.statusCode).toBe(200);
    expect(distRes.json().distributor.email).toBe(distributor.email);
    expect(distRes.json().distributor).not.toHaveProperty('passwordHash');
    expect(distRes.json().distributor).not.toHaveProperty('hashedRefreshToken');
  });

  it('continues masking branch and distributor emails in list responses', async () => {
    const branchRes = await app.inject({
      method: 'GET', url: '/auth/admin/branches', headers: { 'x-test-role': 'SUPER_ADMIN' },
    });
    expect(branchRes.statusCode).toBe(200);
    expect(branchRes.json().branches[0].email).toBe('b***h@example.com');

    const distRes = await app.inject({
      method: 'GET', url: '/auth/admin/distributors', headers: { 'x-test-role': 'SUPER_ADMIN' },
    });
    expect(distRes.statusCode).toBe(200);
    expect(distRes.json().distributors[0].email).toBe('d***r@example.com');
  });

  it('normalizes accepted updates and masks the returned list record', async () => {
    const branchRes = await requestBranch('PATCH', 'SUPER_ADMIN', { name: '  HO Test  ', email: ' BRANCH@EXAMPLE.COM ' });
    expect(branchRes.statusCode).toBe(200);
    expect(auth.updateBranch).toHaveBeenCalledWith(branch.id, 'HO Test', branch.email, {});
    expect(branchRes.json().branch.email).toBe('b***h@example.com');

    const distRes = await requestDistributor('PATCH', 'SUPER_ADMIN', { name: '  Acme Dist  ', email: ' DISTRIBUTOR@EXAMPLE.COM ' });
    expect(distRes.statusCode).toBe(200);
    expect(auth.updateDistributor).toHaveBeenCalledWith(distributor.id, 'Acme Dist', distributor.email);
    expect(distRes.json().distributor.email).toBe('d***r@example.com');
  });

  it.each([
    { name: '   ', email: branch.email },
    { name: 'A', email: branch.email },
    { name: 'A'.repeat(101), email: branch.email },
    { name: '<script>', email: branch.email },
    { name: branch.name, email: 'not-an-email' },
    { name: branch.name, email: 'b***h@example.com' },
    { name: branch.name, email: null },
    { name: branch.name },
    { email: branch.email },
    { name: branch.name, email: branch.email, status: 'INACTIVE' },
    { name: branch.name, email: branch.email, password: 'NewPassword1!' },
  ])('rejects invalid or unauthorized fields: %j', async (payload) => {
    const branchRes = await requestBranch('PATCH', 'SUPER_ADMIN', payload);
    expect(branchRes.statusCode).toBe(400);
    expect(auth.updateBranch).not.toHaveBeenCalled();

    const distRes = await requestDistributor('PATCH', 'SUPER_ADMIN', payload);
    expect(distRes.statusCode).toBe(400);
    expect(auth.updateDistributor).not.toHaveBeenCalled();
  });

  it('returns an actionable duplicate-email error to the editor', async () => {
    auth.updateBranch.mockRejectedValueOnce(new BadRequestException('Branch with this email already exists'));
    const branchRes = await requestBranch('PATCH', 'SUPER_ADMIN', { name: branch.name, email: branch.email });
    expect(branchRes.statusCode).toBe(400);
    expect(branchRes.json().message).toBe('Branch with this email already exists');

    auth.updateDistributor.mockRejectedValueOnce(new BadRequestException('Distributor with this email already exists'));
    const distRes = await requestDistributor('PATCH', 'SUPER_ADMIN', { name: distributor.name, email: distributor.email });
    expect(distRes.statusCode).toBe(400);
    expect(distRes.json().message).toBe('Distributor with this email already exists');
  });

  it('returns 404 when the selected branch or distributor was removed', async () => {
    auth.getBranchForAdmin.mockRejectedValueOnce(new NotFoundException('Branch not found'));
    const branchRes = await requestBranch('GET', 'SUPER_ADMIN');
    expect(branchRes.statusCode).toBe(404);

    auth.getDistributorForAdmin.mockRejectedValueOnce(new NotFoundException('Distributor not found'));
    const distRes = await requestDistributor('GET', 'SUPER_ADMIN');
    expect(distRes.statusCode).toBe(404);
  });
});
