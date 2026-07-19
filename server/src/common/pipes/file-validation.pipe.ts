// src/common/pipes/file-validation.pipe.ts
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { File as MulterFile } from 'multer';
import { resolveCategory } from '../../config/upload.config';

@Injectable()
export class FileValidationPipe implements PipeTransform {
  transform(file: MulterFile): MulterFile {
    return FileValidationPipe.validate(file);
  }

  // maxSizeBytes now passed in — sourced from app.config's maxFileSizeMb
  // via ConfigService, so there's exactly one place that number lives.
  static validate(file: MulterFile, maxSizeBytes?: number): MulterFile {
    if (!file) {
      throw new BadRequestException('Aucun fichier reçu.');
    }

    const category = resolveCategory(file.mimetype, file.originalname);
    if (!category) {
      throw new BadRequestException(
        `Type de fichier non autorisé (${file.originalname}). Formats acceptés : PDF, Word, Excel, CSV, PNG, JPG.`,
      );
    }

    if (maxSizeBytes && file.size > maxSizeBytes) {
      throw new BadRequestException(
        `Fichier trop volumineux (${file.originalname}). Taille maximale : ${Math.round(maxSizeBytes / 1024 / 1024)}MB.`,
      );
    }

    return file;
  }
}