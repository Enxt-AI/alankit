"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const multipart_1 = __importDefault(require("@fastify/multipart"));
const cookie_1 = __importDefault(require("@fastify/cookie"));
const cors_1 = __importDefault(require("@fastify/cors"));
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, new platform_fastify_1.FastifyAdapter());
    await app.register(cookie_1.default);
    await app.register(cors_1.default, {
        origin: [
            process.env.FRONTEND_URL || 'http://localhost:3000',
            'https://unlistedstox.com',
            'https://www.unlistedstox.com',
            'https://api.unlistedstox.com',
            'https://api.unlistedstox.com:90',
            'http://api.unlistedstox.com:90',
            'https://panels.unlistedstox.com',
            'https://distributors.unlistedstox.com',
            'http://localhost:3000',
            'http://localhost:4000',
            'http://localhost:8000',
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'Accept',
            'X-Requested-With',
            'X-CSRF-Token',
            'X-User-Id',
            'x-client-type',
            'x-device-fingerprint',
            'x-dpop-proof',
            'x-dpop-timestamp',
            'x-dpop-jti',
            'x-idempotency-key',
        ],
    });
    await app.register(multipart_1.default, {
        limits: {
            fileSize: 10 * 1024 * 1024,
        },
    });
    const fastifyInstance = app.getHttpAdapter().getInstance();
    fastifyInstance.addHook('onSend', (request, reply, payload, done) => {
        reply.removeHeader('x-powered-by');
        reply.removeHeader('X-Powered-By');
        reply.removeHeader('server');
        reply.removeHeader('Server');
        done();
    });
    await app.listen(process.env.PORT || 3005, '0.0.0.0');
    console.log(`🚀 Storage Service running on http://localhost:${process.env.PORT || 3005}`);
}
bootstrap();
//# sourceMappingURL=main.js.map