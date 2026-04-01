export const appConfig = {
  name: 'ARS Reinsurance Management',
  version: '1.0.0',
  apiPrefix: 'api',
  port: parseInt(process.env.PORT) || 5000,
  environment: process.env.NODE_ENV || 'development',
};
