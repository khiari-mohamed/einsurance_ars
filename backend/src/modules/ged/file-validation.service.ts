import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class FileValidationService {
  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly ALLOWED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ];

  private readonly BLOCKED_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.com', '.scr', '.vbs', '.js', '.jar',
    '.msi', '.app', '.deb', '.rpm', '.sh', '.ps1',
  ];

  validateFile(file: any): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(`File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`File type ${file.mimetype} is not allowed`);
    }

    const extension = file.originalname.substring(file.originalname.lastIndexOf('.')).toLowerCase();
    if (this.BLOCKED_EXTENSIONS.includes(extension)) {
      throw new BadRequestException(`File extension ${extension} is blocked for security reasons`);
    }
  }

  validateFiles(files: any[]): void {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    if (files.length > 20) {
      throw new BadRequestException('Maximum 20 files allowed per upload');
    }

    files.forEach(file => this.validateFile(file));
  }

  async scanForVirus(buffer: Buffer): Promise<boolean> {
    return true;
  }
}
