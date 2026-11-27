import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AlankitKycClient } from './alankit-kyc.client';

const OPEN_ACCOUNT_URL = 'https://openaccount.alankit.co.in/';
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const phone = (value: unknown) => text(value).replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');

@Injectable()
export class AlankitKycService {
  constructor(private readonly prisma: PrismaService, private readonly client: AlankitKycClient) {}

  private async user(userId: string) {
    if (!userId) throw new ForbiddenException('A customer session is required.');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.isActive || user.isDeleted) throw new ForbiddenException('Account is not active.');
    return user;
  }

  private summary(user: any) {
    const lookup = user.kycData?.alankitLookup;
    const verified = user.kycStatus === 'VERIFIED';
    return {
      kycStatus: user.kycStatus,
      state: verified ? 'VERIFIED' : lookup?.state || 'NOT_STARTED',
      pan: lookup?.pan ? `******${lookup.pan.slice(-4)}` : null,
      canRefresh: Boolean(lookup?.pan),
      checkedAt: lookup?.checkedAt || null,
      openAccountUrl: !verified && ['NOT_FOUND', 'PENDING'].includes(lookup?.state) ? OPEN_ACCOUNT_URL : null,
    };
  }

  async status(userId: string) { return this.summary(await this.user(userId)); }

  async refresh(userId: string) {
    const user = await this.user(userId);
    const data = user.kycData as any;
    if (!data?.alankitLookup?.pan) throw new BadRequestException('Submit your PAN first.');
    return this.lookup(userId, data.alankitLookup.pan);
  }

  async lookup(userId: string, pan: string) {
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) throw new BadRequestException('Enter a valid PAN number.');
    const attemptId = randomUUID();
    const prep = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))::text AS locked`;
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');
      if (!user.isActive || user.isDeleted) throw new ForbiddenException('Account is not active.');
      if (user.kycStatus === 'VERIFIED') return { done: true as const, summary: this.summary(user) };

      const previous = (user.kycData as any) || {};
      const lookup = previous.alankitLookup;
      if (lookup?.checkedAt && Date.now() - Date.parse(lookup.checkedAt) < 30_000) {
        throw new BadRequestException('Please wait 30 seconds before checking KYC again.');
      }
      const started = {
        ...previous,
        // Invalidate any previous provider attempt so an old callback cannot verify this PAN.
        verifiedTransactionId: null,
        alankitLookup: { pan, attemptId, state: 'FETCHING', checkedAt: new Date().toISOString() },
      };
      await tx.user.update({
        where: { id: userId },
        data: { kycData: started, kycStatus: 'PENDING' },
      });
      return { done: false as const, user, previous, started };
    });
    if (prep.done) return prep.summary;
    const { user, previous, started } = prep;

    const result = await this.client.fetchByPan(pan);
    const profile = result.state === 'FOUND' ? result.response.data : null;
    let state: string = result.state;
    if (profile) {
      const samePan = text(profile.pan).toUpperCase() === pan;
      const samePhone = phone(user.phone).length === 10 && phone(user.phone) === phone(profile.mobile);
      const sameEmail = Boolean(text(user.email)) && text(user.email).toLowerCase() === text(profile.email).toLowerCase();
      state = !samePan || !text(profile.name) ? 'ERROR'
        : !samePhone && !sameEmail ? 'REVIEW_REQUIRED'
        : text(profile.kycStatus).toUpperCase() === 'ACTIVE' ? 'VERIFIED' : 'PENDING';
    }
    const next = {
      ...started,
      alankitLookup: {
        pan, attemptId, state, checkedAt: new Date().toISOString(),
        httpStatus: result.httpStatus ?? null,
        response: result.response,
      },
      ...(state === 'VERIFIED' ? {
        panDetails: { pan, name: text(profile.name), verified: true },
        firstVerifiedAt: previous.firstVerifiedAt || new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        source: 'ALANKIT',
      } : {}),
    };
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))::text AS locked`;
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { kycData: true, isActive: true, isDeleted: true },
      });
      if (
        !current ||
        !current.isActive ||
        current.isDeleted ||
        (current.kycData as any)?.alankitLookup?.attemptId !== attemptId
      ) {
        throw new ConflictException('KYC changed while fetching. Reload and try again.');
      }
      if (state === 'VERIFIED') {
        // Same lock as the existing DigiLocker flow prevents cross-provider PAN claims.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${pan}, 0))::text AS locked`;
        const owner = await tx.user.findFirst({
          where: { id: { not: userId }, kycData: { path: ['panDetails', 'pan'], equals: pan } },
          select: { id: true },
        });
        if (owner) {
          state = 'REVIEW_REQUIRED';
          next.alankitLookup.state = state;
          delete (next as any).panDetails;
          delete (next as any).approvedAt;
          delete (next as any).firstVerifiedAt;
        }
      }
      await tx.user.update({
        where: { id: userId },
        data: {
          kycData: next, kycStatus: state === 'VERIFIED' ? 'VERIFIED' : 'PENDING',
          ...(state === 'VERIFIED' ? {
            fullName: text(profile.name),
            bankData: {
              accNo: text(profile.bankAccountNo), ifsc: text(profile.bankIfsc),
              bankName: text(profile.bankName), benificiaryName: text(profile.name), source: 'ALANKIT',
            },
            dematData: {
              accountNumber: text(profile.dpAccountNoCDSL) || text(profile.dpAccountNoNSDL),
              dpId: (text(profile.dpAccountNoCDSL) || text(profile.dpAccountNoNSDL)).slice(0, 8),
              clientId: (text(profile.dpAccountNoCDSL) || text(profile.dpAccountNoNSDL)).slice(8),
              name: text(profile.name), source: 'ALANKIT',
            },
          } : {}),
        },
      });
    });
    return this.summary({ kycStatus: state === 'VERIFIED' ? 'VERIFIED' : 'PENDING', kycData: next });
  }
}
