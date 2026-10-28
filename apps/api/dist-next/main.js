"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const express_1 = require("express");
const app_module_1 = require("./app.module");
BigInt.prototype.toJSON = function () {
    return this.toString();
};
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { bodyParser: false });
    app.setGlobalPrefix('api');
    app.use((0, express_1.json)({ limit: '50mb' }));
    app.use((0, express_1.urlencoded)({ extended: true, limit: '50mb' }));
    app.enableCors({
        origin: process.env.CORS_ORIGIN
            ? process.env.CORS_ORIGIN.split(',')
            : '*',
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
            enableImplicitConversion: true,
        },
    }));
    if (process.env.NODE_ENV !== 'production') {
        const config = new swagger_1.DocumentBuilder()
            .setTitle('CTQ Audit RQC API')
            .setDescription('API for CTQ Audit Roving Quality Control — Footwear Manufacturing')
            .setVersion('1.0')
            .addBearerAuth()
            .addTag('auth', 'Authentication')
            .addTag('models', 'CTQ Setup Models')
            .addTag('po', 'Purchase Orders')
            .addTag('master', 'Master Data')
            .addTag('rqc', 'RQC Audit Transactions')
            .addTag('files', 'File Upload')
            .addTag('health', 'Health Checks')
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, config);
        swagger_1.SwaggerModule.setup('api/docs', app, document);
        logger.log('Swagger docs: http://localhost:3001/api/docs');
    }
    const port = process.env.PORT || 3001;
    await app.listen(port, '0.0.0.0');
    logger.log(`🚀 CTQ Audit API running on: http://localhost:${port}/api`);
}
bootstrap();
//# sourceMappingURL=main.js.map