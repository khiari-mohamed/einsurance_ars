import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { StorageService } from '../shared/services/storage.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import * as unzipper from 'unzipper';

const execAsync = promisify(exec);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir = path.join(process.cwd(), 'backups');

  constructor(
    private dataSource: DataSource,
    private storageService: StorageService,
  ) {
    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Create full database backup
   */
  async createBackup(type: 'manual' | 'auto' = 'manual'): Promise<{ filename: string; size: number; path: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${type}_${timestamp}.sql`;
    const filepath = path.join(this.backupDir, filename);

    try {
      this.logger.log(`Creating ${type} backup: ${filename}`);

      const dbConfig = this.dataSource.options as any;
      const { host, port, username, password, database } = dbConfig;

      // PostgreSQL backup command
      const pgDumpCmd = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${username} -d ${database} -F c -f "${filepath}"`;

      await execAsync(pgDumpCmd);

      // Compress backup
      const zipFilename = `${filename}.zip`;
      const zipPath = path.join(this.backupDir, zipFilename);
      await this.compressFile(filepath, zipPath);

      // Upload to cloud storage
      const buffer = fs.readFileSync(zipPath);
      await this.storageService.uploadFile(`backups/${zipFilename}`, buffer, 'application/zip');

      // Get file size
      const stats = fs.statSync(zipPath);

      // Clean up local SQL file
      fs.unlinkSync(filepath);

      this.logger.log(`Backup created successfully: ${zipFilename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

      return {
        filename: zipFilename,
        size: stats.size,
        path: zipPath,
      };
    } catch (error) {
      this.logger.error(`Backup failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Restore database from backup
   */
  async restoreBackup(filename: string): Promise<void> {
    const zipPath = path.join(this.backupDir, filename);

    try {
      this.logger.log(`Starting restore from: ${filename}`);

      // Download from cloud if not local
      if (!fs.existsSync(zipPath)) {
        this.logger.log('Downloading backup from cloud storage...');
        const buffer = await this.storageService.getFile(`backups/${filename}`);
        fs.writeFileSync(zipPath, buffer);
      }

      // Extract SQL file
      const sqlFilename = filename.replace('.zip', '');
      const sqlPath = path.join(this.backupDir, sqlFilename);
      await this.extractFile(zipPath, sqlPath);

      // Restore database
      const dbConfig = this.dataSource.options as any;
      const { host, port, username, password, database } = dbConfig;

      // Drop existing connections
      await this.dataSource.query(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = '${database}'
        AND pid <> pg_backend_pid();
      `);

      // Restore command
      const pgRestoreCmd = `PGPASSWORD="${password}" pg_restore -h ${host} -p ${port} -U ${username} -d ${database} -c "${sqlPath}"`;

      await execAsync(pgRestoreCmd);

      // Clean up
      fs.unlinkSync(sqlPath);

      this.logger.log('Database restored successfully');
    } catch (error) {
      this.logger.error(`Restore failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * List all available backups
   */
  async listBackups(): Promise<Array<{ filename: string; size: number; date: Date; type: string }>> {
    const backups: Array<{ filename: string; size: number; date: Date; type: string }> = [];

    // List local backups
    const files = fs.readdirSync(this.backupDir).filter(f => f.endsWith('.zip'));

    for (const file of files) {
      const filepath = path.join(this.backupDir, file);
      const stats = fs.statSync(filepath);
      
      // Parse type from filename
      const type = file.includes('_auto_') ? 'auto' : 'manual';

      backups.push({
        filename: file,
        size: stats.size,
        date: stats.mtime,
        type,
      });
    }

    // Sort by date descending
    return backups.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  /**
   * Delete old backups (keep last N)
   */
  async cleanOldBackups(keepCount: number = 10): Promise<number> {
    const backups = await this.listBackups();
    
    if (backups.length <= keepCount) {
      return 0;
    }

    const toDelete = backups.slice(keepCount);
    let deleted = 0;

    for (const backup of toDelete) {
      try {
        const filepath = path.join(this.backupDir, backup.filename);
        fs.unlinkSync(filepath);
        
        // Also delete from cloud
        await this.storageService.deleteFile(`backups/${backup.filename}`);
        
        deleted++;
        this.logger.log(`Deleted old backup: ${backup.filename}`);
      } catch (error) {
        this.logger.warn(`Failed to delete backup ${backup.filename}: ${error.message}`);
      }
    }

    return deleted;
  }

  /**
   * Export specific tables
   */
  async exportTables(tables: string[]): Promise<{ filename: string; path: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `export_tables_${timestamp}.sql`;
    const filepath = path.join(this.backupDir, filename);

    try {
      const dbConfig = this.dataSource.options as any;
      const { host, port, username, password, database } = dbConfig;

      const tablesList = tables.map(t => `-t ${t}`).join(' ');
      const pgDumpCmd = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${username} -d ${database} ${tablesList} -f "${filepath}"`;

      await execAsync(pgDumpCmd);

      return { filename, path: filepath };
    } catch (error) {
      this.logger.error(`Table export failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create data snapshot (JSON format)
   */
  async createDataSnapshot(): Promise<{ filename: string; data: any }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `snapshot_${timestamp}.json`;

    try {
      // Export key tables to JSON
      const [affaires] = await this.dataSource.query('SELECT * FROM affaires LIMIT 1000');
      const [cedantes] = await this.dataSource.query('SELECT * FROM cedantes');
      const [reassureurs] = await this.dataSource.query('SELECT * FROM reassureurs');
      const [sinistres] = await this.dataSource.query('SELECT * FROM sinistres LIMIT 1000');

      const snapshot = {
        timestamp: new Date(),
        version: '1.0',
        data: {
          affaires,
          cedantes,
          reassureurs,
          sinistres,
        },
      };

      const filepath = path.join(this.backupDir, filename);
      fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2));

      // Upload to cloud
      const buffer = fs.readFileSync(filepath);
      await this.storageService.uploadFile(`snapshots/${filename}`, buffer, 'application/json');

      return { filename, data: snapshot };
    } catch (error) {
      this.logger.error(`Snapshot creation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Automatic daily backup (cron job)
   */
  @Cron('0 2 * * *', { name: 'daily-backup' })
  async handleDailyBackup() {
    this.logger.log('Starting automatic daily backup...');
    
    try {
      await this.createBackup('auto');
      await this.cleanOldBackups(30); // Keep last 30 backups
    } catch (error) {
      this.logger.error('Automatic backup failed', error.stack);
    }
  }

  /**
   * Weekly full backup
   */
  @Cron('0 3 * * 0', { name: 'weekly-backup' })
  async handleWeeklyBackup() {
    this.logger.log('Starting weekly full backup...');
    
    try {
      const backup = await this.createBackup('auto');
      
      // Create additional snapshot
      await this.createDataSnapshot();
      
      this.logger.log(`Weekly backup completed: ${backup.filename}`);
    } catch (error) {
      this.logger.error('Weekly backup failed', error.stack);
    }
  }

  // ==================== HELPER METHODS ====================

  private async compressFile(sourcePath: string, targetPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(targetPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));

      archive.pipe(output);
      archive.file(sourcePath, { name: path.basename(sourcePath) });
      archive.finalize();
    });
  }

  private async extractFile(zipPath: string, targetPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: path.dirname(targetPath) }))
        .on('close', () => resolve())
        .on('error', (err) => reject(err));
    });
  }
}
