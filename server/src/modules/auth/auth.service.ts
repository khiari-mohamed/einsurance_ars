import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordPolicyService } from './password-policy.service';
import { EmailService } from '../../shared/services/email.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from './dto/reset-password.dto';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private passwordPolicy: PasswordPolicyService,
    private email: EmailService,
  ) {}

  // Kept in place even though the frontend dropdown no longer conditions on
  // it — harmless, public, and may be useful for an ops/health dashboard
  // later. No longer consulted by register() below.
  async setupStatus() {
    const userCount = await this.prisma.user.count();
    return { needsBootstrap: userCount === 0 };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    if (user.isLocked) {
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new UnauthorizedException(
          `Compte bloqué jusqu'à ${user.lockedUntil.toLocaleString('fr-TN')}`,
        );
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isLocked: false, failedAttempts: 0, lockedUntil: null },
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Compte désactivé');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      const policy = await this.passwordPolicy.getPolicy();
      const newAttempts = user.failedAttempts + 1;

      if (newAttempts >= policy.maxTentatives) {
        const lockedUntil = new Date();
        lockedUntil.setMinutes(
          lockedUntil.getMinutes() + policy.dureeLockoutMinutes,
        );
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedAttempts: newAttempts,
            isLocked: true,
            lockedUntil,
          },
        });
        throw new UnauthorizedException(
          `Compte bloqué pour ${policy.dureeLockoutMinutes} minutes après ${policy.maxTentatives} tentatives échouées`,
        );
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts: newAttempts },
      });

      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    if (user.passwordExpiresAt && user.passwordExpiresAt < new Date()) {
      throw new UnauthorizedException(
        'Mot de passe expiré. Veuillez le réinitialiser.',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lastLoginAt: new Date() },
    });

    return this.generateTokens(user);
  }

  // Public self-registration, all 6 roles freely selectable including
  // SUPER_ADMIN — no restriction on how many SUPER_ADMIN accounts can
  // exist or who can create them. This was an explicit choice (see chat):
  // anyone who can reach this endpoint can mint a super-admin account at
  // any time. If that ever needs tightening again, the guard that used to
  // live here checked `await this.prisma.user.count()` and only allowed
  // role === 'SUPER_ADMIN' when it was 0.
  async register(dto: RegisterDto) {
    await this.passwordPolicy.validate(dto.password);

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new BadRequestException('Cet email est déjà utilisé');
    }

    const rounds = this.config.get<number>('app.bcryptRounds', 12);
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    const policy = await this.passwordPolicy.getPolicy();
    const passwordExpiresAt = this.passwordPolicy.computeExpiresAt(policy);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        nom: dto.nom,
        prenom: dto.prenom,
        role: dto.role,
        passwordExpiresAt,
      },
    });

    this.logger.log(`User registered: ${user.email} [${user.role}]`);
    return this.generateTokens(user);
  }

  async refresh(refreshToken: string) {
    const token = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!token || token.revokedAt || token.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }

    return this.generateTokens(token.user);
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) return;

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 3600 * 1000);

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    await this.email.sendPasswordReset(user.email, token);
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(dto.token)
      .digest('hex');

    const record = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Token invalide ou expiré');
    }

    await this.passwordPolicy.validate(dto.newPassword);

    const rounds = this.config.get<number>('app.bcryptRounds', 12);
    const passwordHash = await bcrypt.hash(dto.newPassword, rounds);
    const policy = await this.passwordPolicy.getPolicy();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          passwordExpiresAt: this.passwordPolicy.computeExpiresAt(policy),
          isLocked: false,
          failedAttempts: 0,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const isValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new BadRequestException('Mot de passe actuel incorrect');
    }

    await this.passwordPolicy.validate(dto.newPassword);
    const rounds = this.config.get<number>('app.bcryptRounds', 12);
    const passwordHash = await bcrypt.hash(dto.newPassword, rounds);
    const policy = await this.passwordPolicy.getPolicy();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          passwordExpiresAt: this.passwordPolicy.computeExpiresAt(policy),
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
        modulePermissions: true,
        lastLoginAt: true,
        passwordExpiresAt: true,
        createdAt: true,
      },
    });
  }

  private async generateTokens(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwt.sign(payload);

    const refreshTokenValue = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: { userId: user.id, token: refreshTokenValue, expiresAt },
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        modulePermissions: user.modulePermissions,
      },
    };
  }
}