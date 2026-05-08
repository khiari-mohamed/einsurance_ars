import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PasswordPolicyService } from './password-policy.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const secret = config.get<string>('app.jwtSecret');
        const expiresIn = config.get<string>('app.jwtExpiresIn') || '8h';
        
        if (!secret) {
          throw new Error('JWT_SECRET is not configured');
        }
        
        return {
          secret,
          signOptions: { 
            expiresIn: expiresIn as any,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PasswordPolicyService],
  exports: [AuthService, PasswordPolicyService, JwtModule],
})
export class AuthModule {}