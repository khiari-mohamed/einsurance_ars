import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(5000),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().default('ars-jwt-secret-change-in-production'),
  }),
  JWT_REFRESH_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().default('ars-refresh-secret-change'),
  }),
  CORS_ORIGIN: Joi.string().default('*'),
}).options({ allowUnknown: true });
