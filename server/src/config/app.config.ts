import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '5000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  jwtSecret: process.env.JWT_SECRET ?? 'ars-jwt-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'ars-refresh-secret-change',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB ?? '50', 10),
  storageProvider: process.env.STORAGE_PROVIDER ?? 'local', // 'local' | 's3'
  s3Bucket: process.env.S3_BUCKET ?? '',
  s3Region: process.env.S3_REGION ?? 'us-east-1',
  s3AccessKey: process.env.S3_ACCESS_KEY ?? '',
  s3SecretKey: process.env.S3_SECRET_KEY ?? '',
  smtpHost: process.env.SMTP_HOST ?? 'localhost',
  smtpPort: parseInt(process.env.SMTP_PORT ?? '587', 10),
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  smtpFrom: process.env.SMTP_FROM ?? 'noreply@ars-tunisie.com',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
}));