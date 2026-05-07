import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PasswordPolicyService } from '../auth/password-policy.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private passwordPolicy: PasswordPolicyService,
  ) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
        isActive: true,
        isLocked: true,
        modulePermissions: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
        isActive: true,
        isLocked: true,
        failedAttempts: true,
        lockedUntil: true,
        modulePermissions: true,
        lastLoginAt: true,
        passwordExpiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) throw new ConflictException('Email déjà utilisé');

    await this.passwordPolicy.validate(dto.password);
    const rounds = this.config.get<number>('app.bcryptRounds', 12);
    const passwordHash = await bcrypt.hash(dto.password, rounds);
    const policy = await this.passwordPolicy.getPolicy();
    const passwordExpiresAt = this.passwordPolicy.computeExpiresAt(policy);

    return this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        nom: dto.nom,
        prenom: dto.prenom,
        role: dto.role,
        modulePermissions: dto.modulePermissions ?? {},
        passwordExpiresAt,
      },
      select: {
        id: true, email: true, nom: true, prenom: true, role: true, createdAt: true,
      },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);

    const updateData: any = {
      ...(dto.nom && { nom: dto.nom }),
      ...(dto.prenom && { prenom: dto.prenom }),
      ...(dto.role && { role: dto.role }),
      ...(typeof dto.isActive !== 'undefined' && { isActive: dto.isActive }),
      ...(dto.modulePermissions && { modulePermissions: dto.modulePermissions }),
    };

    if (dto.password) {
      await this.passwordPolicy.validate(dto.password);
      const rounds = this.config.get<number>('app.bcryptRounds', 12);
      updateData.passwordHash = await bcrypt.hash(dto.password, rounds);
      const policy = await this.passwordPolicy.getPolicy();
      updateData.passwordExpiresAt = this.passwordPolicy.computeExpiresAt(policy);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true, email: true, nom: true, prenom: true, role: true, isActive: true, updatedAt: true,
      },
    });
  }

  async unlock(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isLocked: false, failedAttempts: 0, lockedUntil: null },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }
}