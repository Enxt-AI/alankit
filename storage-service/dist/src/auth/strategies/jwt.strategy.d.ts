import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
declare const JwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtStrategy extends JwtStrategy_base {
    private static encryptionKey;
    constructor(configService: ConfigService);
    validate(payload: any): Promise<{
        adminId: any;
        email: any;
        role: any;
        permissions: any;
        type: string;
        userId?: undefined;
    } | {
        userId: any;
        email: any;
        type: string;
        adminId?: undefined;
        role?: undefined;
        permissions?: undefined;
    }>;
}
export {};
