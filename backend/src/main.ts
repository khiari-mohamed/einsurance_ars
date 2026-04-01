import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const allowedOrigins = configService.get<string>('CORS_ORIGINS') || 'http://localhost:5173,http://localhost:3000';
  const origins = allowedOrigins.split(',').map(origin => origin.trim());

  app.enableCors({
    origin: origins,
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.setGlobalPrefix('api');

  const port = configService.get<number>('PORT') || 5000;
  await app.listen(port);
  console.log(`🚀 ARS Reinsurance API running on port ${port}`);
  console.log(`🌐 CORS enabled for: ${origins.join(', ')}`);
}
bootstrap();
