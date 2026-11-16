"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var JwtStrategy_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtStrategy = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const passport_jwt_1 = require("passport-jwt");
const config_1 = require("@nestjs/config");
const cookie_crypto_1 = require("cookie-crypto");
let JwtStrategy = class JwtStrategy extends (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy) {
    static { JwtStrategy_1 = this; }
    static encryptionKey;
    constructor(configService) {
        const secret = configService.get('JWT_SECRET');
        const cookieEncryptionKey = configService.get('COOKIE_ENCRYPTION_KEY');
        if (!secret) {
            throw new Error('JWT_SECRET is not defined in environment variables');
        }
        JwtStrategy_1.encryptionKey = cookieEncryptionKey || '';
        super({
            jwtFromRequest: passport_jwt_1.ExtractJwt.fromExtractors([
                (request) => {
                    const authHeader = request.headers?.authorization;
                    if (authHeader && authHeader.startsWith('Bearer ')) {
                        return authHeader.substring(7);
                    }
                    for (const key of Object.keys(cookie_crypto_1.OBFUSCATED_COOKIE_NAMES)) {
                        const cookieName = cookie_crypto_1.OBFUSCATED_COOKIE_NAMES[key];
                        const token = (0, cookie_crypto_1.decryptTokenSafe)(request.cookies?.[cookieName], JwtStrategy_1.encryptionKey);
                        if (token)
                            return token;
                    }
                    for (const key of Object.keys(cookie_crypto_1.ORIGINAL_COOKIE_NAMES)) {
                        const cookieName = cookie_crypto_1.ORIGINAL_COOKIE_NAMES[key];
                        const token = (0, cookie_crypto_1.decryptTokenSafe)(request.cookies?.[cookieName], JwtStrategy_1.encryptionKey);
                        if (token)
                            return token;
                    }
                    return null;
                },
            ]),
            ignoreExpiration: false,
            secretOrKey: secret,
        });
    }
    async validate(payload) {
        if (payload.type === 'ADMIN') {
            if (!payload.adminId || !payload.email) {
                throw new common_1.UnauthorizedException('Invalid admin token');
            }
            return {
                adminId: payload.adminId,
                email: payload.email,
                role: payload.role,
                permissions: payload.permissions,
                type: 'ADMIN',
            };
        }
        if (!payload.userId || !payload.email) {
            throw new common_1.UnauthorizedException('Invalid user token');
        }
        return {
            userId: payload.userId,
            email: payload.email,
            type: 'USER',
        };
    }
};
exports.JwtStrategy = JwtStrategy;
exports.JwtStrategy = JwtStrategy = JwtStrategy_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], JwtStrategy);
//# sourceMappingURL=jwt.strategy.js.map