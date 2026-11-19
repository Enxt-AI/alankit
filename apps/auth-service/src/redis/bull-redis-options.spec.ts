import { getBullRedisOptions } from './bull-redis-options';

describe('getBullRedisOptions', () => {
  it('parses TLS Redis URLs and limits command retry delay for OTP queue requests', () => {
    expect(
      getBullRedisOptions(
        'rediss://default:test-password@redis.example.test:6380/2',
      ),
    ).toMatchObject({
      host: 'redis.example.test',
      port: 6380,
      username: 'default',
      password: 'test-password',
      db: 2,
      tls: {},
      maxRetriesPerRequest: 1,
    });
  });

  it('uses the default Redis port for non-TLS URLs', () => {
    expect(getBullRedisOptions('redis://redis.example.test')).toMatchObject({
      host: 'redis.example.test',
      port: 6379,
      maxRetriesPerRequest: 1,
    });
  });

  it('rejects unsupported Redis URL schemes', () => {
    expect(() => getBullRedisOptions('http://redis.example.test')).toThrow(
      'REDIS_URL must use redis:// or rediss://',
    );
  });
});
