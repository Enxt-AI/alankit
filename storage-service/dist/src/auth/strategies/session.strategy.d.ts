import { RedisService } from '../../redis/redis.service';
declare const SessionStrategy_base: new (...args: [] | [options: import("passport-custom").StrategyOptions]) => import("passport-custom") & {
    validate(...args: any[]): unknown;
};
export declare class SessionStrategy extends SessionStrategy_base {
    private readonly redisService;
    private static readonly logger;
    constructor(redisService: RedisService);
    validate(req: any): Promise<any>;
}
export {};
