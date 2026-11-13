"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const config = app.get(config_1.ConfigService);
    app.use((0, cookie_parser_1.default)());
    const origins = config
        .getOrThrow('CORS_ORIGINS')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    app.enableCors({ origin: origins, credentials: true });
    app.enableCsrfProtection({ trustedOrigins: origins });
    app.useGlobalPipes(new common_1.StandardSchemaValidationPipe());
    app.enableShutdownHooks();
    const port = config.getOrThrow('PORT');
    await app.listen(port);
    common_1.Logger.log(`API listening on http://localhost:${port}`, 'Bootstrap');
}
void bootstrap();
//# sourceMappingURL=main.js.map