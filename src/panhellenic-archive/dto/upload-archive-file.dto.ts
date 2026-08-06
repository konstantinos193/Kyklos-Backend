import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ArchiveSubject } from './create-archive-file.dto';

/**
 * Multipart form fields always arrive as strings, so everything is validated as a
 * string here and converted afterwards. Without this the endpoint happily stored
 * `year: NaN` and unknown subjects, which made the file invisible on the public page.
 */
export class UploadArchiveFileDto {
  @IsString()
  @IsNotEmpty({ message: 'Το όνομα αρχείου είναι υποχρεωτικό' })
  @MaxLength(200, { message: 'Το όνομα αρχείου είναι πολύ μεγάλο (μέγιστο 200 χαρακτήρες)' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  displayName: string;

  @IsEnum(ArchiveSubject, { message: 'Μη έγκυρο μάθημα' })
  @IsNotEmpty({ message: 'Το μάθημα είναι υποχρεωτικό' })
  subject: ArchiveSubject;

  @Matches(/^(19|20)\d{2}$/, { message: 'Μη έγκυρο έτος' })
  @IsNotEmpty({ message: 'Το έτος είναι υποχρεωτικό' })
  year: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000, { message: 'Η περιγραφή είναι πολύ μεγάλη (μέγιστο 2000 χαρακτήρες)' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;
}
