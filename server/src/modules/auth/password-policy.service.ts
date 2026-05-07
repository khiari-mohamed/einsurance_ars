import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PasswordPolicyService {
  constructor(private prisma: PrismaService) {}

  async getPolicy() {
    let policy = await this.prisma.passwordPolicy.findFirst();
    if (!policy) {
      policy = await this.prisma.passwordPolicy.create({
        data: {},
      });
    }
    return policy;
  }

  async validate(password: string): Promise<void> {
    const policy = await this.getPolicy();

    if (password.length < policy.longueurMin) {
      throw new BadRequestException(
        `Le mot de passe doit contenir au moins ${policy.longueurMin} caractères`,
      );
    }
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      throw new BadRequestException(
        'Le mot de passe doit contenir au moins une majuscule',
      );
    }
    if (policy.requireNumber && !/\d/.test(password)) {
      throw new BadRequestException(
        'Le mot de passe doit contenir au moins un chiffre',
      );
    }
    if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
      throw new BadRequestException(
        'Le mot de passe doit contenir au moins un symbole',
      );
    }
  }

  computeExpiresAt(policy: { expirationJours: number }): Date {
    const d = new Date();
    d.setDate(d.getDate() + policy.expirationJours);
    return d;
  }
}