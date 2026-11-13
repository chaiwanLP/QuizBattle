"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const config = app.get(config_1.ConfigService);
    const origins = config
        .getOrThrow('CORS_ORIGINS')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    app.enableCors({ origin: origins, credentials: true });
    app.useGlobalPipes(new common_1.StandardSchemaValidationPipe());
    app.enableShutdownHooks();
    const port = config.getOrThrow('PORT');
    await app.listen(port);
    common_1.Logger.log(`API listening on http://localhost:${port}`, 'Bootstrap');
}
void bootstrap();
//# sourceMappingURL=main.js.map