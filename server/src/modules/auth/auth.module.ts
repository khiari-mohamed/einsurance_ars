import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PasswordPolicyService } from './password-policy.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

// NOTE (bug #7): JwtAuthGuard + PermissionsGuard are only wired up on
// AuthController right now. Every other module you build (Données,
// Affaires, Sinistres, Finances, Comptabilité, GED) needs the same
// @UseGuards(JwtAuthGuard, PermissionsGuard) on its controller — or,
// cleaner, register both as APP_GUARD providers in AppModule once that
// file exists, so it's enforced app-wide by default instead of per
// controller.
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
  providers: [AuthService, JwtStrategy, PasswordPolicyService, JwtAuthGuard, PermissionsGuard],
  exports: [AuthService, PasswordPolicyService, JwtModule, JwtAuthGuard, PermissionsGuard],
})
export class AuthModule {}