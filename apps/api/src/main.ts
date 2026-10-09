// apps/api/src/main.ts
// NestJS application entry point (forced recompile)

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

// Fix for BigInt JSON serialization
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // ─────────────────────────────────────────────
  // Global Prefix
  // ─────────────────────────────────────────────
  app.setGlobalPrefix('api');

  // ─────────────────────────────────────────────
  // Payload Limits
  // ─────────────────────────────────────────────
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // ─────────────────────────────────────────────
  // CORS
  // ─────────────────────────────────────────────
  app.enableCors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : '*',
    credentials: true,
  });

  // ─────────────────────────────────────────────
  // Global Validation Pipe
  // ─────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // strip unknown properties
      forbidNonWhitelisted: true,
      transform: true,          // auto-transform to DTO types
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ─────────────────────────────────────────────
  // Swagger / OpenAPI Documentation
  // ─────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('CTQ Audit RQC API')
      .setDescription(
        'API for CTQ Audit Roving Quality Control — Footwear Manufacturing',
      )
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

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger docs: http://localhost:3001/api/docs');
  }

  // ─────────────────────────────────────────────
  // Start Server
  // ─────────────────────────────────────────────
  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 CTQ Audit API running on: http://localhost:${port}/api`);
}

bootstrap();
