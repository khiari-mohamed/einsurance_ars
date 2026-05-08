import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir = path.join(process.cwd(), 'backups');

  constructor() {
    if (!fs.existsSync(this.backupDir))
      fs.mkdirSync(this.backupDir, { recursive: true });
  }

  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `ars-backup-${timestamp}.sql`;
    const filePath = path.join(this.backupDir, fileName);
    const dbUrl = process.env.DATABASE_URL;

    try {
      await execAsync(`pg_dump "${dbUrl}" -f "${filePath}" --no-password`);
      const { size } = fs.statSync(filePath);
      this.logger.log(`Backup created: ${fileName} (${size} bytes)`);
      return { fileName, filePath, sizeBytes: size };
    } catch (err) {
      this.logger.error(`Backup failed: ${err.message}`);
      throw new Error(`Backup échoué: ${err.message}`);
    }
  }

  listBackups() {
    if (!fs.existsSync(this.backupDir)) return [];
    return fs
      .readdirSync(this.backupDir)
      .filter((f) => f.endsWith('.sql'))
      .map((fileName) => {
        const filePath = path.join(this.backupDir, fileName);
        const stats = fs.statSync(filePath);
        return { fileName, filePath, sizeBytes: stats.size, createdAt: stats.birthtime };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getBackupFile(fileName: string): Buffer {
    const filePath = path.join(this.backupDir, path.basename(fileName));
    if (!fs.existsSync(filePath)) throw new Error(`Fichier introuvable: ${fileName}`);
    return fs.readFileSync(filePath);
  }

  deleteBackup(fileName: string) {
    const filePath = path.join(this.backupDir, path.basename(fileName));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.logger.log(`Backup deleted: ${fileName}`);
    }
  }
}