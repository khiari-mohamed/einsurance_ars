import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;

  constructor(private config: ConfigService) {
    this.uploadDir = config.get<string>('app.uploadDir', './uploads');
    this.ensureDir(this.uploadDir);
  }

  private ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async saveFile(
    buffer: Buffer,
    originalName: string,
    subDir = '',
  ): Promise<{ filePath: string; fileName: string }> {
    const ext = path.extname(originalName);
    const fileName = `${uuidv4()}${ext}`;
    const dir = subDir ? path.join(this.uploadDir, subDir) : this.uploadDir;
    this.ensureDir(dir);
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, buffer);
    this.logger.log(`File saved: ${filePath}`);
    return { filePath, fileName };
  }

  async deleteFile(filePath: string): Promise<void> {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.logger.log(`File deleted: ${filePath}`);
    }
  }

  async getFileBuffer(filePath: string): Promise<Buffer> {
    return fs.readFileSync(filePath);
  }

  getReadStream(filePath: string): fs.ReadStream {
    return fs.createReadStream(filePath);
  }

  fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }
}