import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './users.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async create(data: Partial<User>): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = this.repo.create({ ...data, password: hashedPassword });
    return this.repo.save(user);
  }

  findAll(): Promise<User[]> {
    return this.repo.find({ select: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive'] });
  }

  findOne(id: string): Promise<User> {
    return this.repo.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User> {
    return this.repo.findOne({ where: { email } });
  }

  findByResetToken(resetToken: string): Promise<User> {
    return this.repo.findOne({ where: { resetToken } });
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const updateData = { ...data };
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    await this.repo.update(id, updateData);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
