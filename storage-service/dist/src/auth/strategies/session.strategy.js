"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionStrategy = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const passport_custom_1 = require("passport-custom");
const redis_service_1 = require("../../redis/redis.service");
const cookie_crypto_1 = require("cookie-crypto");
const crypto = __importStar(require("crypto"));
let SessionStrategy = class SessionStrategy extends (0, passport_1.PassportStrategy)(passport_custom_1.Strategy, 'jwt') {
    redisService;
    static logger = new common_1.Logger('SessionStrategy');
    constructor(redisService) {
        super();
        this.redisService = redisService;
    }
    async validate(req) {
        let sessionId = null;
        const authHeader = req.headers?.['authorization'] || req.raw?.headers?.['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            sessionId = authHeader.substring(7);
        }
        else {
            const cookies = req.cookies || {};
            sessionId =
                cookies[cookie_crypto_1.OBFUSCATED_COOKIE_NAMES.AUTH_TOKEN] ||
                    cookies[cookie_crypto_1.ORIGINAL_COOKIE_NAMES.AUTH_TOKEN] ||
                    cookies[cookie_crypto_1.OBFUSCATED_COOKIE_NAMES.ADMIN_PANEL_TOKEN] ||
                    cookies[cookie_crypto_1.ORIGINAL_COOKIE_NAMES.ADMIN_PANEL_TOKEN] ||
                    cookies[cookie_crypto_1.OBFUSCATED_COOKIE_NAMES.CMS_PANEL_TOKEN] ||
                    cookies[cookie_crypto_1.ORIGINAL_COOKIE_NAMES.CMS_PANEL_TOKEN] ||
                    cookies[cookie_crypto_1.OBFUSCATED_COOKIE_NAMES.OPERATION_PANEL_TOKEN] ||
                    cookies[cookie_crypto_1.ORIGINAL_COOKIE_NAMES.OPERATION_PANEL_TOKEN] ||
                    cookies[cookie_crypto_1.OBFUSCATED_COOKIE_NAMES.SUPPORT_PANEL_TOKEN] ||
                    cookies[cookie_crypto_1.ORIGINAL_COOKIE_NAMES.SUPPORT_PANEL_TOKEN] ||
                    cookies[cookie_crypto_1.OBFUSCATED_COOKIE_NAMES.MARKETING_PANEL_TOKEN] ||
                    cookies[cookie_crypto_1.ORIGINAL_COOKIE_NAMES.MARKETING_PANEL_TOKEN] ||
                    cookies[cookie_crypto_1.OBFUSCATED_COOKIE_NAMES.ACCOUNTING_PANEL_TOKEN] ||
                    cookies[cookie_crypto_1.ORIGINAL_COOKIE_NAMES.ACCOUNTING_PANEL_TOKEN] ||
                    cookies[cookie_crypto_1.OBFUSCATED_COOKIE_NAMES.DISTRIBUTOR_PANEL_TOKEN] ||
                    cookies[cookie_crypto_1.OBFUSCATED_COOKIE_NAMES.BRANCH_PANEL_TOKEN] ||
                    cookies[cookie_crypto_1.OBFUSCATED_COOKIE_NAMES.INTERNAL_RM_PANEL_TOKEN] ||
                    cookies[cookie_crypto_1.OBFUSCATED_COOKIE_NAMES.DISTRIBUTOR_RM_PANEL_TOKEN];
        }
        if (!sessionId) {
            throw new common_1.UnauthorizedException('No session provided');
        }
        const hashedSessionId = crypto.createHash('sha256').update(sessionId).digest('hex');
        const session = await this.redisService.get(`session:${hashedSessionId}`);
        if (!session) {
            throw new common_1.UnauthorizedException('Invalid or expired session');
        }
        return {
            userId: session.userId,
            type: session.type,
            deviceClass: session.deviceClass,
            sessionId: hashedSessionId,
        };
    }
};
exports.SessionStrategy = SessionStrategy;
exports.SessionStrategy = SessionStrategy = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService])
], SessionStrategy);
//# sourceMappingURL=session.strategy.js.map