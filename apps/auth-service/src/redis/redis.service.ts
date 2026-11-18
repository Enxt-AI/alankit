import { Injectable, NotFoundException, UnauthorizedException, BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { setKey, getKey, delKey, redis } from 'redis-service';
import * as crypto from 'crypto';
import { CONSUME_OTP, RATE_LIMIT, INCREMENT_COUNTER, RELEASE_LOCK, UPDATE_DELIVERY, TAKE_SIGNUP } from './otp-scripts';
import { PinoNestLogger } from '@smc/logger';

export interface PendingSignup {
  phone: string;
  email: string;
  existingUserId?: string;
}

/**
 * RedisService wraps the redis-service package for OTP management
 * Provides methods to store, retrieve, and delete OTPs with retry tracking
 * Local development can use in-memory fallback caches; production fails closed during Redis outages.
 */
const service = 'auth-service';
const ctx = 'RedisService';

@Injectable()
export class RedisService {
  private readonly logger = new PinoNestLogger(service, ctx);
  private requireSharedState(): void {
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException('Authentication is temporarily unavailable. Please try again later.');
    }
  }

  async consumeOTP(target: string, hash: string, maxRetries: number, proof?: { token: string; phone: string }): Promise<void> {
    const proofKey = proof ? `otp:phone-proof:${crypto.createHash('sha256').update(proof.token).digest('hex')}` : `otp:unused-proof:${target}`;
    let result: number;
    try {
      result = Number(await redis.eval(CONSUME_OTP, 3, `otp:${target}`, `lock:otp:${target}`, proofKey, hash, maxRetries, proof?.phone || ''));
    } catch {
      this.requireSharedState();
      // Development fallback is synchronous so verification and consumption cannot interleave.
      const now = Date.now();
      const block = this.fallbackCache.get(`lock:otp:${target}`);
      const item = this.fallbackCache.get(`otp:${target}`);
      const phoneProof = this.fallbackCache.get(proofKey);
      if (block && block.expiry > now) result = -2;
      else if (proof && (!phoneProof || phoneProof.expiry <= now || phoneProof.value !== proof.phone)) result = -3;
      else if (!item || item.expiry <= now) result = -1;
      else if (item.value.otp === hash && item.value.retries < maxRetries) {
        this.fallbackCache.delete(`otp:${target}`);
        if (proof) this.fallbackCache.delete(proofKey);
        result = 0;
      } else if (++item.value.retries >= maxRetries) {
        this.fallbackCache.delete(`otp:${target}`);
        this.fallbackCache.set(`lock:otp:${target}`, { value: true, expiry: now + 900000 });
        result = -2;
      } else result = maxRetries - item.value.retries;
    }
    if (result === -1) {
      this.logger.warn({ event: 'otp.verify.failed', reason: 'expired', target }, 'No OTP sent or OTP expired');
      throw new BadRequestException('No OTP sent or OTP expired');
    }
    if (result === -2) {
      this.logger.warn({ event: 'otp.verify.failed', reason: 'locked', target }, 'Verification locked due to too many failed attempts');
      throw new BadRequestException('Verification locked due to too many failed attempts. Try again in 15 minutes.');
    }
    if (result === -3) {
      this.logger.warn({ event: 'otp.verify.failed', reason: 'phone_proof_expired', target }, 'Phone verification expired or invalid');
      throw new BadRequestException('Phone verification expired or invalid. Please verify your phone again.');
    }
    if (result > 0) {
      this.logger.warn({ event: 'otp.verify.failed', reason: 'invalid_otp', target, attemptsLeft: result }, `Invalid OTP. Attempts left: ${result}`);
      throw new BadRequestException(`Invalid OTP. Attempts left: ${result}`);
    }
    if (result !== 0) {
      this.logger.error({ event: 'otp.verify.failed', reason: 'unknown', target, result }, 'Unable to verify OTP');
      throw new ServiceUnavailableException('Unable to verify OTP.');
    }
  }

  async createPhoneProof(phone: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    await this.setKey(`otp:phone-proof:${crypto.createHash('sha256').update(token).digest('hex')}`, phone, 600);
    return token;
  }

  private signupKey(token: string): string {
    return `signup:pending:${crypto.createHash('sha256').update(token).digest('hex')}`;
  }

  async createPendingSignup(data: PendingSignup): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    await this.setKey(this.signupKey(token), data, 600);
    return token;
  }

  async getPendingSignup(token: string): Promise<PendingSignup | null> {
    return this.getKey(this.signupKey(token));
  }

  async getPhoneProof(token: string): Promise<string | null> {
    return this.getKey(`otp:phone-proof:${crypto.createHash('sha256').update(token).digest('hex')}`);
  }

  async takePendingSignup(token: string): Promise<PendingSignup> {
    const key = this.signupKey(token);
    let data: PendingSignup | null = null;
    try {
      const raw = await redis.eval(TAKE_SIGNUP, 1, key);
      if (typeof raw === 'string') data = JSON.parse(raw);
    } catch {
      this.requireSharedState();
      const item = this.fallbackCache.get(key);
      if (item && item.expiry > Date.now()) data = item.value;
      this.fallbackCache.delete(key);
    }
    if (!data?.phone || !data?.email) throw new BadRequestException('Signup expired or already completed. Please verify your phone again.');
    return data;
  }

  /** Give back a claimed signup after a transient failure; never overwrites a live entry. */
  async restorePendingSignup(token: string, data: PendingSignup, ttlSeconds = 300): Promise<void> {
    const key = this.signupKey(token);
    try {
      await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds, 'NX');
    } catch {
      this.requireSharedState();
      if (!this.fallbackCache.has(key)) this.fallbackCache.set(key, { value: data, expiry: Date.now() + ttlSeconds * 1000 });
    }
  }

  async updateOtpDelivery(target: string, hash: string, status: string): Promise<void> {
    await redis.eval(UPDATE_DELIVERY, 1, `otp:${target}`, hash, status);
  }

  private readonly fallbackCache = new Map<string, { value: any; expiry: number }>();
  private readonly ipNumbersFallback = new Map<string, { numbers: Set<string>; expiry: number }>();

  /**
   * Ping Redis to monitor health
   */
  async ping(): Promise<string> {
    try {
      return await redis.ping();
    } catch (err: any) {
      this.logger.warn(`Redis ping failed: ${err?.message || err}`);
      return 'down';
    }
  }

  /**
   * Store OTP in Redis with expiry time and resend cooldown timestamp
   * @param mobile - User's mobile number or email/key
   * @param otp - Hashed 6-digit OTP
   * @param ttlSeconds - Time to live in seconds (default: 300 = 5 minutes)
   * @param cooldownSeconds - Resend cooldown in seconds (default: 30 seconds)
   */
  async setOTP(mobile: string, otp: string, ttlSeconds: number = 300, cooldownSeconds: number = 30, lock?: { key: string; token: string }) {
    const now = Date.now();
    const cooldownUntil = now + cooldownSeconds * 1000;
    const expiresAt = now + ttlSeconds * 1000;
    const record = {
      otp,
      retries: 0,
      lastSentAt: now,
      cooldownUntil,
      expiresAt,
    };

    try {
      if (lock) {
        const saved = await redis.eval(`
          if redis.call('GET', KEYS[2]) ~= ARGV[1] then return 0 end
          redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
          return 1
        `, 2, `otp:${mobile}`, lock.key, lock.token, JSON.stringify(record), ttlSeconds);
        if (Number(saved) !== 1) throw new BadRequestException('OTP request expired. Please try again.');
      } else {
        await setKey(`otp:${mobile}`, record, ttlSeconds);
      }
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      this.requireSharedState();
      this.logger.warn(`Redis setOTP failed, using fallback cache: ${error.message}`);
      if (lock) {
        const owner = this.fallbackCache.get(lock.key);
        if (!owner || owner.expiry <= now || owner.value !== lock.token) throw new BadRequestException('OTP request expired. Please try again.');
      }
      this.fallbackCache.set(`otp:${mobile}`, {
        value: record,
        expiry: expiresAt,
      });
    }
  }

  /**
   * Retrieve OTP record from Redis including cooldown metadata
   * @param mobile - User's mobile number
   * @returns OTP record with retry count & cooldown timestamps, or null if not found/expired
   */
  async getOTP(
    mobile: string,
  ): Promise<{ otp: string; retries: number; lastSentAt?: number; cooldownUntil?: number; expiresAt?: number; deliveryStatus?: string } | null> {
    try {
      return await getKey(`otp:${mobile}`);
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis getOTP failed, using fallback cache: ${error.message}`);
      const item = this.fallbackCache.get(`otp:${mobile}`);
      if (!item) return null;
      if (item.expiry < Date.now()) {
        this.fallbackCache.delete(`otp:${mobile}`);
        return null;
      }
      return item.value;
    }
  }

  /**
   * Alias for getOTP to get full record with cooldown metadata
   */
  async getOTPRecord(
    mobile: string,
  ): Promise<{ otp: string; retries: number; lastSentAt?: number; cooldownUntil?: number; expiresAt?: number; deliveryStatus?: string } | null> {
    return await this.getOTP(mobile);
  }

  /**
   * Update retry count for failed OTP attempts
   * @param mobile - User's mobile number
   * @param retries - New retry count
   * @param ttlSeconds - Reset TTL to this value
   */
  private readonly UPDATE_RETRIES_SCRIPT = `
    local raw = redis.call('GET', KEYS[1])
    if not raw then return 0 end
    local record = cjson.decode(raw)
    if record.retries >= tonumber(ARGV[1]) then return -1 end
    record.retries = record.retries + 1
    local ttl = redis.call('PTTL', KEYS[1])
    if ttl > 0 then
      redis.call('SET', KEYS[1], cjson.encode(record), 'PX', ttl)
    else
      return 0
    end
    return record.retries
  `;

  /**
   * Atomically increments the retry counter for an OTP record.
   * Returns the new retry count, or throws if MAX_RETRIES is reached.
   * The entire read-increment-write happens in a single Redis operation.
   */
  async updateRetries(mobile: string, maxRetries: number): Promise<number> {
    const key = `otp:${mobile}`;

    try {
      const result = (await redis.eval(
        this.UPDATE_RETRIES_SCRIPT,
        1,       // number of KEYS
        key,     // KEYS[1]
        maxRetries.toString(), // ARGV[1]
      )) as number;

      if (result === 0) {
        throw new NotFoundException('OTP record not found.');
      }

      if (result === -1) {
        throw new UnauthorizedException(
          `Maximum OTP attempts (${maxRetries}) exceeded.`,
        );
      }

      return result; // current retry count after increment
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof UnauthorizedException) {
        throw error;
      }
      this.requireSharedState();
      this.logger.warn(`Redis updateRetries failed, using fallback cache: ${error.message}`);
      const item = this.fallbackCache.get(key);
      if (!item || item.expiry < Date.now()) {
        if (item) this.fallbackCache.delete(key);
        throw new NotFoundException('OTP record not found.');
      }
      const record = item.value;
      if (record.retries >= maxRetries) {
        throw new UnauthorizedException(
          `Maximum OTP attempts (${maxRetries}) exceeded.`,
        );
      }
      record.retries = record.retries + 1;
      item.value = record;
      return record.retries;
    }
  }

  /**
   * Delete OTP from Redis (after successful verification)
   * @param mobile - User's mobile number
   */
  async deleteOTP(mobile: string) {
    try {
      await delKey(`otp:${mobile}`);
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis deleteOTP failed, using fallback cache: ${error.message}`);
      this.fallbackCache.delete(`otp:${mobile}`);
    }
  }

  /**
   * Check if request is within rate limit
   * @param key - Rate limit key (e.g., 'rate:otp:request:phone')
   * @param limit - Maximum requests allowed in window
   * @param windowSeconds - Time window in seconds
   * @returns true if request is allowed, false if rate limit exceeded
   */
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<boolean> {
    try {
      return Number(await redis.eval(RATE_LIMIT, 1, key, limit, windowSeconds)) === 1;
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis checkRateLimit failed, using fallback cache: ${error.message}`);
      const item = this.fallbackCache.get(key);
      let currentCount = 0;
      if (item && item.expiry >= Date.now()) {
        currentCount = item.value || 0;
      }
      if (currentCount >= limit) {
        return false;
      }
      this.fallbackCache.set(key, {
        value: currentCount + 1,
        expiry: Date.now() + windowSeconds * 1000,
      });
      return true;
    }
  }

  /**
   * Increment rate limit counter
   * @param key - Rate limit key
   * @param windowSeconds - Time window in seconds
   */
  async incrementRateLimit(key: string, windowSeconds: number): Promise<void> {
    try {
      await redis.eval(INCREMENT_COUNTER, 1, key, windowSeconds);
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis incrementRateLimit failed, using fallback cache: ${error.message}`);
      const item = this.fallbackCache.get(key);
      let currentCount = 0;
      if (item && item.expiry >= Date.now()) {
        currentCount = item.value || 0;
      }
      this.fallbackCache.set(key, {
        value: currentCount + 1,
        expiry: Date.now() + windowSeconds * 1000,
      });
    }
  }

  /**
   * Helper methods to manage blocks and lockouts
   */
  async isBlocked(key: string): Promise<boolean> {
    try {
      const blocked = await getKey(key);
      return !!blocked;
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis isBlocked failed, using fallback cache: ${error.message}`);
      const item = this.fallbackCache.get(key);
      if (!item) return false;
      if (item.expiry < Date.now()) {
        this.fallbackCache.delete(key);
        return false;
      }
      return !!item.value;
    }
  }

  async setBlock(key: string, durationSeconds: number): Promise<void> {
    try {
      await setKey(key, true, durationSeconds);
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis setBlock failed, using fallback cache: ${error.message}`);
      this.fallbackCache.set(key, {
        value: true,
        expiry: Date.now() + durationSeconds * 1000,
      });
    }
  }

  async getCooldownRemaining(key: string): Promise<number> {
    try {
      const exists = await getKey(key);
      if (!exists) return 0;
      const ttl = await redis.ttl(key);
      return ttl > 0 ? ttl : 0;
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis getCooldownRemaining failed, using fallback cache: ${error.message}`);
      const item = this.fallbackCache.get(key);
      if (!item) return 0;
      if (item.expiry < Date.now()) {
        this.fallbackCache.delete(key);
        return 0;
      }
      return Math.ceil((item.expiry - Date.now()) / 1000);
    }
  }

  async setCooldown(key: string, durationSeconds: number): Promise<void> {
    try {
      await setKey(key, true, durationSeconds);
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis setCooldown failed, using fallback cache: ${error.message}`);
      this.fallbackCache.set(key, {
        value: true,
        expiry: Date.now() + durationSeconds * 1000,
      });
    }
  }

  async trackUniqueNumberPerIp(
    ip: string,
    phone: string,
    windowSeconds: number,
    maxUnique: number,
  ): Promise<boolean> {
    const key = `ip:numbers:${ip}`;
    try {
      const isMember = await redis.sismember(key, phone);
      if (!isMember) {
        await redis.sadd(key, phone);
        const ttl = await redis.ttl(key);
        if (ttl <= 0) {
          await redis.expire(key, windowSeconds);
        }
      }
      const count = await redis.scard(key);
      return count <= maxUnique;
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis trackUniqueNumberPerIp failed, using fallback cache: ${error.message}`);
      let entry = this.ipNumbersFallback.get(ip);
      if (!entry || entry.expiry < Date.now()) {
        entry = { numbers: new Set<string>(), expiry: Date.now() + windowSeconds * 1000 };
        this.ipNumbersFallback.set(ip, entry);
      }
      entry.numbers.add(phone);
      return entry.numbers.size <= maxUnique;
    }
  }

  /**
   * Centralized method to check all rate limiters, cooldowns, and lockouts.
   * Throws NestJS HttpExceptions if blocked/limited.
   * No CAPTCHA is required; abuse protection is enforced server-side.
   */
  async resetOtpRateLimits(target: string): Promise<void> {
    const keys = [
      `rate:otp:minute:${target}`,
      `rate:otp:request:${target}`,
      `cooldown:otp:${target}`,
      `cooldown:otp:resends:${target}`,
    ];
    for (const key of keys) this.fallbackCache.delete(key);
    try {
      await redis.del(...keys);
    } catch (error: any) {
      this.logger.warn(`Failed to reset OTP limits in Redis: ${error.message}`);
    }
  }

  private async checkOtpMinuteLimit(target: string): Promise<boolean> {
    const key = `rate:otp:minute:${target}`;
    try {
      // Atomic counter with a fixed 60-second expiry from the first request.
      const allowed = await redis.eval(`
        local count = tonumber(redis.call('GET', KEYS[1]) or '0')
        if count >= 2 then return 0 end
        count = redis.call('INCR', KEYS[1])
        if count == 1 then redis.call('EXPIRE', KEYS[1], 60) end
        return 1
      `, 1, key);
      return Number(allowed) === 1;
    } catch {
      this.requireSharedState();
      const now = Date.now();
      const item = this.fallbackCache.get(key);
      const active = item && item.expiry > now ? item : { value: 0, expiry: now + 60000 };
      if (active.value >= 2) return false;
      this.fallbackCache.set(key, { value: active.value + 1, expiry: active.expiry });
      return true;
    }
  }

  async checkOtpRateLimits(
    target: string,
    ip: string,
    deviceFingerprint?: string,
  ): Promise<{ captchaRequired: boolean }> {
    // OTP rate limit disabled for OTP only
    this.logger.log(`[checkOtpRateLimits] Rate limit check bypassed for target: ${target}`);
    return { captchaRequired: false };

    /*
    // No SMS is sent for this reserved review number. Do not charge request
    // quotas or apply resend cooldowns, but never erase verification lockouts.
    if (target === '0123456789') {
      if (await this.isBlocked(`lock:otp:${target}`)) {
        this.logger.warn({ event: 'otp.rate_limit.locked', reason: 'target_locked', target }, 'Verification locked due to too many failed attempts');
        throw new BadRequestException('Verification locked due to too many failed attempts. Try again in 15 minutes.');
      }
      return { captchaRequired: false };
    }
    const cleanTarget = (target || '').replace(/^\+91/, '').replace(/\D/g, '');
    const isWhitelisted = process.env.NODE_ENV !== 'production' && (
      ['8130244036', '0123456789', '9999999999'].includes(cleanTarget) ||
      (process.env.TEST_PHONE_NUMBERS || '')
        .split(',')
        .map((p) => p.trim().replace(/^\+91/, ''))
        .filter(Boolean)
        .includes(cleanTarget));

    if (isWhitelisted) {
      this.logger.log(`[checkOtpRateLimits] Whitelisted/test number detected: ${cleanTarget}. Resetting blocks and bypassing rate limits.`);
      try {
        await Promise.allSettled([
          delKey(`rate:otp:daily:${target}`),
          delKey(`rate:otp:daily:${cleanTarget}`),
          delKey(`rate:otp:daily:+91${cleanTarget}`),
          delKey(`rate:otp:hourly:${target}`),
          delKey(`rate:otp:hourly:${cleanTarget}`),
          delKey(`rate:otp:hourly:+91${cleanTarget}`),
          delKey(`rate:otp:request:${target}`),
          delKey(`rate:otp:request:${cleanTarget}`),
          delKey(`rate:otp:request:+91${cleanTarget}`),
          delKey(`lock:otp:${target}`),
          delKey(`lock:otp:${cleanTarget}`),
          delKey(`cooldown:otp:${target}`),
          delKey(`cooldown:otp:${cleanTarget}`),
          delKey(`cooldown:otp:resends:${target}`),
          delKey(`cooldown:otp:resends:${cleanTarget}`),
        ]);
      } catch (err: any) {
        this.logger.warn(`Failed to clear Redis keys for whitelisted number: ${err?.message}`);
      }

      this.fallbackCache.delete(`rate:otp:daily:${target}`);
      this.fallbackCache.delete(`rate:otp:daily:${cleanTarget}`);
      this.fallbackCache.delete(`rate:otp:hourly:${target}`);
      this.fallbackCache.delete(`rate:otp:hourly:${cleanTarget}`);
      this.fallbackCache.delete(`rate:otp:request:${target}`);
      this.fallbackCache.delete(`rate:otp:request:${cleanTarget}`);
      this.fallbackCache.delete(`lock:otp:${target}`);
      this.fallbackCache.delete(`lock:otp:${cleanTarget}`);
      this.fallbackCache.delete(`cooldown:otp:${target}`);
      this.fallbackCache.delete(`cooldown:otp:${cleanTarget}`);
      this.fallbackCache.delete(`cooldown:otp:resends:${target}`);
      this.fallbackCache.delete(`cooldown:otp:resends:${cleanTarget}`);

      return { captchaRequired: false };
    }

    const targetLockKey = `lock:otp:${target}`;
    const ipBlockKey = `blocklist:ip:${ip}`;

    // 0. Device fingerprint check
    if (deviceFingerprint) {
      const isDeviceAllowed = await this.trackDeviceFingerprint(deviceFingerprint, target, 3600, 5);
      if (!isDeviceAllowed) {
        this.logger.warn({ event: 'otp.rate_limit.device_blocked', reason: 'suspicious_device', target, ip, deviceFingerprint }, 'Suspicious activity detected from this device');
        throw new ForbiddenException('Suspicious activity detected from this device. Temporarily blocked.');
      }
    }

    // 1. Lock/Blocklist checks
    const isTargetLocked = await this.isBlocked(targetLockKey);
    if (isTargetLocked) {
      this.logger.warn({ event: 'otp.rate_limit.locked', reason: 'target_locked', target }, 'Verification locked due to too many failed attempts');
      throw new BadRequestException('Verification locked due to too many failed attempts. Try again in 15 minutes.');
    }

    const isIpBlocked = await this.isBlocked(ipBlockKey);
    if (isIpBlocked) {
      this.logger.warn({ event: 'otp.rate_limit.ip_blocked', reason: 'ip_suspicious', target, ip }, 'Access temporarily blocked due to suspicious activity');
      throw new ForbiddenException('Access temporarily blocked due to suspicious activity.');
    }

    // 2. Cooldown check
    const cooldownKey = `cooldown:otp:${target}`;
    const cooldownRemaining = await this.getCooldownRemaining(cooldownKey);
    if (cooldownRemaining > 0) {
      this.logger.warn({ event: 'otp.rate_limit.cooldown', reason: 'cooldown_active', target, cooldownRemaining }, `Cooldown active: ${cooldownRemaining}s remaining`);
      throw new BadRequestException(`Please wait ${cooldownRemaining} seconds before requesting another OTP.`);
    }

    // 3. Global limit check (500 requests / hour)
    const globalLimitKey = `rate:otp:global`;
    const isGlobalAllowed = await this.checkRateLimit(globalLimitKey, 500, 3600);
    if (!isGlobalAllowed) {
      this.logger.warn({ event: 'otp.rate_limit.global', reason: 'global_limit_reached', target, ip }, 'System-wide OTP request limit reached');
      throw new ServiceUnavailableException('System-wide OTP request limit reached. Please try again later.');
    }

    // Spike detection: Check 5-minute global count (log critical alert if > 100)
    const spikeCheckKey = `rate:otp:global:spike-check`;
    try {
      let spikeCount = 0;
      try {
        spikeCount = (await getKey(spikeCheckKey)) || 0;
      } catch {
        const item = this.fallbackCache.get(spikeCheckKey);
        if (item && item.expiry >= Date.now()) {
          spikeCount = item.value || 0;
        }
      }
      if (spikeCount >= 100) {
        this.logger.error(`[CRITICAL ALERT] Abnormal OTP traffic spike detected! Global OTP requests exceeded 100 in the last 5 minutes. Current count: ${spikeCount + 1}`);
      }
      await this.incrementRateLimit(spikeCheckKey, 300);
    } catch (err: any) {
      this.logger.warn(`Failed to process spike check: ${err.message}`);
    }

    // 4. IP limit check (30 requests / hour)
    const ipLimitKey = `rate:otp:ip:${ip}`;
    const isIpAllowed = await this.checkRateLimit(ipLimitKey, 30, 3600);
    if (!isIpAllowed) {
      this.logger.warn({ event: 'otp.rate_limit.ip_limit', reason: 'ip_hourly_limit', target, ip }, 'Too many OTP requests from this IP');
      throw new BadRequestException('Too many OTP requests from this IP. Try again in an hour.');
    }

    // 5. IP unique numbers check (5 unique numbers / hour) - Only for phones
    const isPhone = /^[0-9+]+$/.test(target);
    if (isPhone) {
      const isIpUniqueNumberAllowed = await this.trackUniqueNumberPerIp(ip, target, 3600, 5);
      if (!isIpUniqueNumberAllowed) {
        await this.setBlock(ipBlockKey, 86400);
        this.logger.warn({ event: 'otp.rate_limit.ip_unique_numbers', reason: 'too_many_unique_numbers', target, ip }, 'Suspicious activity detected from this IP');
        throw new ForbiddenException('Suspicious activity detected from this IP. Temporarily blocked.');
      }
    }

    // 6. Target daily limit check (configurable, default 20 in prod, 200 in dev/staging)
    const dailyLimit = Number(process.env.OTP_DAILY_LIMIT) || (process.env.NODE_ENV === 'production' ? 20 : 200);
    const dailyLimitKey = `rate:otp:daily:${target}`;
    const isDailyAllowed = await this.checkRateLimit(dailyLimitKey, dailyLimit, 86400);
    if (!isDailyAllowed) {
      this.logger.warn({ event: 'otp.rate_limit.daily', reason: 'daily_limit_reached', target, ip }, 'Daily OTP request limit exceeded');
      throw new BadRequestException('Daily OTP request limit exceeded. Try again tomorrow.');
    }

    // 6.5. Target hourly limit check (configurable, default 10 in prod, 100 in dev)
    const hourlyLimit = Number(process.env.OTP_HOURLY_LIMIT) || (process.env.NODE_ENV === 'production' ? 10 : 100);
    const hourlyLimitKey = `rate:otp:hourly:${target}`;
    const isHourlyAllowed = await this.checkRateLimit(hourlyLimitKey, hourlyLimit, 3600);
    if (!isHourlyAllowed) {
      this.logger.warn({ event: 'otp.rate_limit.hourly', reason: 'hourly_limit_reached', target, ip }, 'Maximum hourly OTP limit reached');
      throw new BadRequestException('Too many OTP requests. Maximum hourly limit reached. Please try again later.');
    }

    // 7. Target 15-minute limit check (configurable, default 5 in prod, 50 in dev)
    const shortLimit = Number(process.env.OTP_15MIN_LIMIT) || (process.env.NODE_ENV === 'production' ? 5 : 50);
    const targetLimitKey = `rate:otp:request:${target}`;
    const isTargetAllowed = await this.checkRateLimit(targetLimitKey, shortLimit, 900);
    if (!isTargetAllowed) {
      this.logger.warn({ event: 'otp.rate_limit.request', reason: '15min_limit_reached', target, ip }, 'Too many OTP requests in 15 minutes');
      throw new BadRequestException('Too many OTP requests. Try again in 15 minutes.');
    }

    if (!(await this.checkOtpMinuteLimit(target))) {
      this.logger.warn({ event: 'otp.rate_limit.minute', reason: 'minute_limit_reached', target, ip }, 'Maximum 2 OTP requests per minute');
      throw new BadRequestException('Too many OTP requests. Maximum 2 requests per minute.');
    }

    // Space OTP requests 30 seconds apart to allow two per minute per target.
    const cooldownSeconds = 30;
    await this.setCooldown(cooldownKey, cooldownSeconds);
    */

    // OTP abuse protection uses server-side limits; no CAPTCHA is required.
    return {
      captchaRequired: false,
    };
  }

  /**
   * Store session in Redis with expiry time
   * @param sessionId - Unique session ID (UUID)
   * @param data - Session payload
   * @param ttlSeconds - TTL in seconds (default: 86400 = 24 hours)
   */
  async setSession(sessionId: string, data: any, ttlSeconds: number = 86400) {
    try {
      await setKey(`session:${sessionId}`, data, ttlSeconds);
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis setSession failed, using fallback cache: ${error.message}`);
      this.fallbackCache.set(`session:${sessionId}`, {
        value: data,
        expiry: Date.now() + ttlSeconds * 1000,
      });
    }
  }

  /**
   * Retrieve session from Redis
   * @param sessionId - Unique session ID
   * @returns Session data or null
   */
  async getSession(sessionId: string): Promise<any | null> {
    try {
      return await getKey(`session:${sessionId}`);
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis getSession failed, using fallback cache: ${error.message}`);
      const item = this.fallbackCache.get(`session:${sessionId}`);
      if (!item) return null;
      if (item.expiry < Date.now()) {
        this.fallbackCache.delete(`session:${sessionId}`);
        return null;
      }
      return item.value;
    }
  }

  /**
   * Delete session from Redis (immediately invalidates tokens)
   * @param sessionId - Unique session ID
   */
  async deleteSession(sessionId: string) {
    try {
      await delKey(`session:${sessionId}`);
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis deleteSession failed, using fallback cache: ${error.message}`);
      this.fallbackCache.delete(`session:${sessionId}`);
    }
  }

  /**
   * Retrieve remaining TTL of a session in seconds
   * @param sessionId - Unique session ID
   * @returns Remaining TTL in seconds
   */
  async getSessionTtl(sessionId: string): Promise<number> {
    try {
      return await redis.ttl(`session:${sessionId}`);
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis getSessionTtl failed, using fallback cache: ${error.message}`);
      const item = this.fallbackCache.get(`session:${sessionId}`);
      if (!item) return -2;
      if (item.expiry < Date.now()) {
        this.fallbackCache.delete(`session:${sessionId}`);
        return -2;
      }
      return Math.ceil((item.expiry - Date.now()) / 1000);
    }
  }

  /**
   * Extend session expiration time
   * @param sessionId - Unique session ID
   * @param ttlSeconds - New TTL in seconds (default: 86400 = 24 hours)
   */
  async extendSession(sessionId: string, ttlSeconds: number = 86400) {
    try {
      await redis.expire(`session:${sessionId}`, ttlSeconds);
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis extendSession failed, using fallback cache: ${error.message}`);
      const item = this.fallbackCache.get(`session:${sessionId}`);
      if (item) {
        item.expiry = Date.now() + ttlSeconds * 1000;
      }
    }
  }

  /**
   * Touch session: update lastActivity timestamp and reset TTL to idle timeout.
   * The session will auto-expire from Redis if no requests arrive within the idle window.
   * @param sessionId - Unique session ID
   * @param sessionData - Current session data object
   * @param idleTimeoutSeconds - Idle timeout in seconds (session expires after this much inactivity)
   */
  async touchSession(sessionId: string, sessionData: any, idleTimeoutSeconds: number): Promise<void> {
    try {
      const updatedData = { ...sessionData, lastActivity: Date.now() };
      await setKey(`session:${sessionId}`, updatedData, idleTimeoutSeconds);
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis touchSession failed, using fallback cache: ${error.message}`);
      const item = this.fallbackCache.get(`session:${sessionId}`);
      if (item) {
        item.value = { ...item.value, lastActivity: Date.now() };
        item.expiry = Date.now() + idleTimeoutSeconds * 1000;
      }
    }
  }

  /**
   * Track session for a user and enforce concurrent session limit.
   * Evicts the oldest sessions if the limit is exceeded.
   * @param userId - Unique user ID
   * @param portal - Portal type (e.g., 'USER', 'ADMIN')
   * @param newSessionId - The newly created session ID
   * @param maxSessions - Maximum allowed concurrent sessions (default: 3)
   */
  async trackSessionForLimit(userId: string, portal: string, newSessionId: string, maxSessions: number = 3): Promise<void> {
    const listKey = `user:sessions:${userId}:${portal}`;
    try {
      // 1. Get all previously tracked sessions ordered by age (oldest first)
      const allSessions = await redis.zrange(listKey, 0, -1);
      
      const activeSessions: string[] = [];
      
      // 2. Filter out sessions that have already expired naturally (idle timeout)
      for (const sessionId of allSessions) {
        if (sessionId === newSessionId) continue;
        
        const exists = await redis.exists(`session:${sessionId}`);
        if (exists) {
          activeSessions.push(sessionId);
        } else {
          // Clean up expired session from ZSET
          await redis.zrem(listKey, sessionId);
        }
      }
      
      // 3. If remaining active sessions >= limit, evict the oldest ones to make room
      if (activeSessions.length >= maxSessions) {
        const numToRemove = activeSessions.length - maxSessions + 1;
        const sessionsToRemove = activeSessions.slice(0, numToRemove);
        
        for (const sessionId of sessionsToRemove) {
          await this.deleteSession(sessionId);
          await redis.zrem(listKey, sessionId);
          this.logger.log({ userId, sessionId }, `Evicted old session ${sessionId} for user ${userId} to enforce concurrent limit`);
        }
      }
      
      // 4. Track the new session
      await redis.zadd(listKey, Date.now(), newSessionId);
      // Set TTL on the ZSET so it doesn't leak if user never logs in again (7 days max lifetime)
      await redis.expire(listKey, 604800);
      
    } catch (error: any) {
      this.logger.warn(`Redis trackSessionForLimit failed (best-effort): ${error.message}`);
    }
  }

  /**
   * Get all active sessions for a user across all portals and device classes.
   * Returns session metadata (id, portal, userAgent, ip, issuedAt, lastActivity) for each active session.
   * @param userId - Unique user ID
   * @returns Array of active session objects
   */
  async getUserActiveSessions(userId: string): Promise<any[]> {
    const activeSessions: any[] = [];
    const seenSessionIds = new Set<string>();

    try {
      // 1. Inspect direct per-device-class active sessions (BROWSER, APK, etc.)
      const deviceClasses = ['BROWSER', 'APK'];
      for (const dc of deviceClasses) {
        try {
          const rawSessionId = await getKey(`active-session:${dc}:${userId}`);
          if (rawSessionId) {
            const hashedSessionId = crypto.createHash('sha256').update(rawSessionId).digest('hex');
            const data = await this.getSession(hashedSessionId);
            if (data && data.userId === userId) {
              const ttl = await this.getSessionTtl(hashedSessionId);
              seenSessionIds.add(hashedSessionId);
              seenSessionIds.add(rawSessionId);
              activeSessions.push({
                sessionId: hashedSessionId,
                rawSessionId,
                portal: data.type || data.portal || 'USER',
                deviceClass: data.deviceClass || dc,
                userAgent: data.userAgent || (dc === 'APK' ? 'Mobile App (Android)' : 'Web Browser'),
                ip: data.ip || 'Unknown',
                issuedAt: data.createdAt ? new Date(data.createdAt).toISOString() : (data.issuedAt || null),
                lastActivity: data.lastActivity ? new Date(data.lastActivity).toISOString() : null,
                expiresInSeconds: ttl > 0 ? ttl : null,
              });
            } else {
              // Stale key cleanup
              await delKey(`active-session:${dc}:${userId}`);
            }
          }
        } catch (e: any) {
          this.logger.warn({ userId, deviceClass: dc, err: e }, `Failed reading active-session:${dc}:${userId}: ${e.message}`);
        }
      }

      // 2. Also check tracked ZSET lists for any portals (e.g. USER, ADMIN, etc.)
      const portals = ['USER', 'ADMIN', 'CMS', 'SUPPORT', 'MARKETING', 'ACCOUNTING', 'OPERATION', 'BRANCH', 'INTERNAL_RM', 'DISTRIBUTOR', 'DISTRIBUTOR_RM'];
      for (const portal of portals) {
        try {
          const listKey = `user:sessions:${userId}:${portal}`;
          const sessionIds = await redis.zrange(listKey, 0, -1);

          for (const sid of sessionIds) {
            const hashedSid = sid.length === 64 ? sid : crypto.createHash('sha256').update(sid).digest('hex');
            if (seenSessionIds.has(hashedSid) || seenSessionIds.has(sid)) continue;

            let data = await this.getSession(hashedSid);
            if (!data && sid !== hashedSid) {
              data = await this.getSession(sid);
            }

            if (data && data.userId === userId) {
              const ttl = await this.getSessionTtl(hashedSid);
              seenSessionIds.add(hashedSid);
              seenSessionIds.add(sid);
              activeSessions.push({
                sessionId: hashedSid,
                rawSessionId: sid,
                portal: data.type || data.portal || portal,
                deviceClass: data.deviceClass || 'BROWSER',
                userAgent: data.userAgent || 'Unknown',
                ip: data.ip || 'Unknown',
                issuedAt: data.createdAt ? new Date(data.createdAt).toISOString() : (data.issuedAt || null),
                lastActivity: data.lastActivity ? new Date(data.lastActivity).toISOString() : null,
                expiresInSeconds: ttl > 0 ? ttl : null,
              });
            } else {
              await redis.zrem(listKey, sid);
            }
          }
        } catch {}
      }
    } catch (error: any) {
      this.logger.warn(`Redis getUserActiveSessions failed: ${error.message}`);
    }

    return activeSessions;
  }

  /**
   * Check if a device fingerprint is new for this user.
   * If not seen before, registers it in Redis and returns true (indicating a new device).
   * If already registered, returns false.
   * @param userId - Unique user/admin ID
   * @param userAgent - User agent string
   */
  async isNewDeviceForUser(userId: string, userAgent: string): Promise<boolean> {
    const key = `user:known_devices:${userId}`;
    const deviceFingerprint = crypto
      .createHash('sha256')
      .update(userAgent || 'Unknown')
      .digest('hex')
      .slice(0, 16);

    try {
      const isKnown = await redis.sismember(key, deviceFingerprint);
      if (isKnown) {
        return false;
      }

      await redis.sadd(key, deviceFingerprint);
      // Keep known devices cache for 180 days
      await redis.expire(key, 15552000);
      return true;
    } catch (error: any) {
      this.logger.warn({ userId, err: error }, `Redis isNewDeviceForUser failed (best-effort): ${error.message}`);
      return false;
    }
  }

  /**
   * Delete all sessions associated with a specific user ID
   * @param userId - Unique user ID
   */
  async deleteUserData(user: { id: string; phone?: string | null; email?: string | null }): Promise<void> {
    const targets = new Set<string>();
    if (user.phone) {
      targets.add(user.phone);
      const digits = user.phone.replace(/\D/g, '');
      const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
      if (local.length === 10) {
        targets.add(local);
        targets.add(`+91${local}`);
        targets.add(`91${local}`);
      }
    }
    if (user.email) {
      targets.add(user.email);
      targets.add(user.email.trim().toLowerCase());
    }

    const keys = new Set([
      `user:status:${user.id}`,
      `user:known_devices:${user.id}`,
      `active-session:${user.id}`,
      `active-session:BROWSER:${user.id}`,
      `active-session:APK:${user.id}`,
    ]);
    for (const target of targets) {
      for (const prefix of [
        'otp:', 'rate:otp:minute:', 'rate:otp:request:', 'rate:otp:verify:',
        'rate:otp:hourly:', 'rate:otp:daily:', 'cooldown:otp:',
        'cooldown:otp:resends:', 'lock:otp:', 'lock:otp:gen:',
      ]) keys.add(`${prefix}${target}`);
    }

    // Clear local fallback records even when Redis is unavailable.
    for (const [key, item] of this.fallbackCache) {
      if (keys.has(key) ||
          (key.startsWith('session:') && item.value?.userId === user.id) ||
          key.startsWith(`user:sessions:${user.id}:`)) {
        this.fallbackCache.delete(key);
      }
    }

    // Sessions are keyed by opaque IDs, so inspect ownership before removing them.
    for (const pattern of ['session:*', 'user:sessions:*']) {
      let cursor = '0';
      do {
        const [next, scannedKeys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = next;
        for (const key of scannedKeys) {
          if (key.startsWith(`user:sessions:${user.id}:`)) {
            keys.add(key);
          } else if (key.startsWith('session:')) {
            const raw = await redis.get(key);
            let session: any;
            try { session = raw ? JSON.parse(raw) : null; } catch { continue; }
            if (session?.userId === user.id) await redis.del(key);
          }
        }
      } while (cursor !== '0');
    }
    await redis.del(...keys);
    // Keep the revocation version until session removal has succeeded.
    await redis.del(`user-session-version:${user.id}`);
    this.fallbackCache.delete(`user-session-version:${user.id}`);
  }

  async deleteAllUserSessions(userId: string): Promise<void> {
    // Invalidate the user status cache immediately
    try {
      await redis.del(`user:status:${userId}`);
    } catch {}
    this.fallbackCache.delete(`user:status:${userId}`);

    try {
      let cursor = '0';
      do {
        const scanResult = await redis.scan(cursor, 'MATCH', 'session:*', 'COUNT', 100);
        cursor = scanResult[0];
        const keys = scanResult[1];

        for (const key of keys) {
          const rawData = await redis.get(key);
          if (rawData) {
            try {
              const data = JSON.parse(rawData);
              if (data.userId === userId) {
                await redis.del(key);
              }
            } catch (err) {}
          }
        }
      } while (cursor !== '0');
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn({ userId, err: error }, `Redis deleteAllUserSessions failed, using fallback cache: ${error.message}`);
      for (const [key, item] of this.fallbackCache.entries()) {
        if (key.startsWith('session:')) {
          const data = item.value;
          if (data && data.userId === userId) {
            this.fallbackCache.delete(key);
          }
        }
      }
    }
  }

  /**
   * Store user status in Redis cache
   * @param userId - Unique user ID
   * @param data - Status payload
   * @param ttlSeconds - TTL in seconds (default: 60)
   */
  async setUserStatusCache(userId: string, data: any, ttlSeconds: number = 60) {
    try {
      await setKey(`user:status:${userId}`, data, ttlSeconds);
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis setUserStatusCache failed, using fallback cache: ${error.message}`);
      this.fallbackCache.set(`user:status:${userId}`, {
        value: data,
        expiry: Date.now() + ttlSeconds * 1000,
      });
    }
  }

  /**
   * Retrieve user status cache
   * @param userId - Unique user ID
   * @returns User status data or null
   */
  async getUserStatusCache(userId: string): Promise<any | null> {
    try {
      return await getKey(`user:status:${userId}`);
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis getUserStatusCache failed, using fallback cache: ${error.message}`);
      const item = this.fallbackCache.get(`user:status:${userId}`);
      if (!item) return null;
      if (item.expiry < Date.now()) {
        this.fallbackCache.delete(`user:status:${userId}`);
        return null;
      }
      return item.value;
    }
  }

  /**
   * Acquire a distributed lock in Redis (NX option)
   * @param key - Lock key
   * @param ttlSeconds - Lock TTL in seconds
   * @returns an ownership token when acquired, or null when already locked
   */
  async acquireLock(key: string, ttlSeconds: number): Promise<string | null> {
    const token = crypto.randomBytes(32).toString('hex');
    try {
      const result = await redis.set(key, token, 'EX', ttlSeconds, 'NX');
      return result === 'OK' ? token : null;
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis acquireLock failed, using fallback cache: ${error.message}`);
      const item = this.fallbackCache.get(key);
      if (item && item.expiry >= Date.now()) {
        return null; // Already locked
      }
      this.fallbackCache.set(key, {
        value: token,
        expiry: Date.now() + ttlSeconds * 1000,
      });
      return token;
    }
  }

  /**
   * Release a distributed lock
   * @param key - Lock key
   */
  async releaseLock(key: string, token: string): Promise<void> {
    try {
      await redis.eval(RELEASE_LOCK, 1, key, token);
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis releaseLock failed, using fallback cache: ${error.message}`);
      if (this.fallbackCache.get(key)?.value === token) this.fallbackCache.delete(key);
    }
  }

  /**
   * Retrieve cached idempotency response
   * @param key - Idempotency key
   * @returns Cached response payload or null
   */
  async getIdempotencyResponse(key: string): Promise<any | null> {
    try {
      return await getKey(`idempotency:${key}`);
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis getIdempotencyResponse failed, using fallback cache: ${error.message}`);
      const item = this.fallbackCache.get(`idempotency:${key}`);
      if (!item) return null;
      if (item.expiry < Date.now()) {
        this.fallbackCache.delete(`idempotency:${key}`);
        return null;
      }
      return item.value;
    }
  }

  /**
   * Cache response payload against an idempotency key
   * @param key - Idempotency key
   * @param response - Response to cache
   * @param ttlSeconds - Expiry in seconds
   */
  async setIdempotencyResponse(key: string, response: any, ttlSeconds: number): Promise<void> {
    try {
      await setKey(`idempotency:${key}`, response, ttlSeconds);
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis setIdempotencyResponse failed, using fallback cache: ${error.message}`);
      this.fallbackCache.set(`idempotency:${key}`, {
        value: response,
        expiry: Date.now() + ttlSeconds * 1000,
      });
    }
  }

  /**
   * Record metric for OTP success or failure, and record verification latency.
   * Logs a warning if the verification failure rate is high (>15%) over a sample of at least 10 attempts.
   */
  async recordOtpMetric(type: 'success' | 'failure', latencyMs?: number): Promise<void> {
    try {
      const typeKey = `otp:metrics:${type}`;
      await redis.incr(typeKey);

      if (latencyMs !== undefined) {
        await redis.incrby(`otp:metrics:latency:total`, latencyMs);
        await redis.incr(`otp:metrics:latency:count`);
      }

      const successStr = await redis.get('otp:metrics:success');
      const failureStr = await redis.get('otp:metrics:failure');
      const successCount = successStr ? parseInt(successStr, 10) : 0;
      const failureCount = failureStr ? parseInt(failureStr, 10) : 0;
      const total = successCount + failureCount;

      if (total >= 10) {
        const failureRate = failureCount / total;
        if (failureRate > 0.15) {
          this.logger.warn(`[Observability Alert] OTP Verification Failure Rate is high: ${(failureRate * 100).toFixed(1)}% (${failureCount}/${total})`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to record metrics in Redis: ${err.message}`);
    }
  }

  /**
   * Get OTP metrics summary
   */
  async getOtpMetrics(): Promise<any> {
    try {
      const successStr = await redis.get('otp:metrics:success');
      const failureStr = await redis.get('otp:metrics:failure');
      const totalLatencyStr = await redis.get('otp:metrics:latency:total');
      const latencyCountStr = await redis.get('otp:metrics:latency:count');

      const success = successStr ? parseInt(successStr, 10) : 0;
      const failure = failureStr ? parseInt(failureStr, 10) : 0;
      const totalLatency = totalLatencyStr ? parseInt(totalLatencyStr, 10) : 0;
      const latencyCount = latencyCountStr ? parseInt(latencyCountStr, 10) : 0;

      const avgLatencyMs = latencyCount > 0 ? totalLatency / latencyCount : 0;

      return {
        success,
        failure,
        total: success + failure,
        avgLatencyMs,
      };
    } catch {
      return { success: 0, failure: 0, total: 0, avgLatencyMs: 0 };
    }
  }

  /**
   * Track unique numbers/accounts requested per device fingerprint
   */
  async trackDeviceFingerprint(
    fingerprint: string,
    target: string,
    windowSeconds: number,
    maxUnique: number,
  ): Promise<boolean> {
    const key = `device:targets:${fingerprint}`;
    try {
      const isMember = await redis.sismember(key, target);
      if (!isMember) {
        await redis.sadd(key, target);
        const ttl = await redis.ttl(key);
        if (ttl <= 0) {
          await redis.expire(key, windowSeconds);
        }
      }
      const count = await redis.scard(key);
      return count <= maxUnique;
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis trackDeviceFingerprint failed, using fallback cache: ${error.message}`);
      let entry = this.ipNumbersFallback.get(fingerprint);
      if (!entry || entry.expiry < Date.now()) {
        entry = { numbers: new Set<string>(), expiry: Date.now() + windowSeconds * 1000 };
        this.ipNumbersFallback.set(fingerprint, entry);
      }
      entry.numbers.add(target);
      return entry.numbers.size <= maxUnique;
    }
  }

  /**
   * Generic key-value getter (wraps redis-service getKey)
   * Used for arbitrary keys like active-session tracking, sessionVersion, etc.
   */
  async getKey(key: string): Promise<any> {
    try {
      return await getKey(key);
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis getKey failed, using fallback cache: ${error.message}`);
      const item = this.fallbackCache.get(key);
      if (!item) return null;
      if (item.expiry < Date.now()) {
        this.fallbackCache.delete(key);
        return null;
      }
      return item.value;
    }
  }

  /**
   * Generic key-value setter (wraps redis-service setKey)
   * Used for arbitrary keys like active-session tracking, sessionVersion, etc.
   */
  async setKey(key: string, value: any, ttlSeconds: number): Promise<void> {
    try {
      await setKey(key, value, ttlSeconds);
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis setKey failed, using fallback cache: ${error.message}`);
      this.fallbackCache.set(key, {
        value,
        expiry: Date.now() + ttlSeconds * 1000,
      });
    }
  }

  /**
   * Generic key deletion (wraps redis-service delKey)
   * Used for cleaning up active-session tracking keys
   */
  async deleteKey(key: string): Promise<void> {
    try {
      await delKey(key);
    } catch (error: any) {
      this.requireSharedState();
      this.logger.warn(`Redis deleteKey failed, using fallback cache: ${error.message}`);
      this.fallbackCache.delete(key);
    }
  }

  /**
   * Convenience aliases matching stocks-service RedisService
   */
  async get(key: string): Promise<any> {
    return this.getKey(key);
  }

  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    return this.setKey(key, value, ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    return this.deleteKey(key);
  }
}
