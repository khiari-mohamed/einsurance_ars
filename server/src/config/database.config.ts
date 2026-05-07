import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL ?? 'postgresql://postgres:23044943@localhost:5432/ars_reinsurance',
}));