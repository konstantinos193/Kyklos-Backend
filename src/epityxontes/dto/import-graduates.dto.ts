import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  EARLIEST_YEAR,
  LATEST_YEAR,
  NAME_MAX_LENGTH,
  SCHOOL_MAX_LENGTH,
} from './create-graduate.dto';

/** Μία ολόκληρη χρονιά είναι ~200 άτομα· το όριο πιάνει το κολλημένο-κατά-λάθος αρχείο. */
export const IMPORT_MAX_ENTRIES = 2000;

export enum ImportMode {
  /** Προσθήκη στους ήδη καταχωρημένους της χρονιάς. */
  APPEND = 'append',
  /** Αντικατάσταση: σβήνει ό,τι υπάρχει στις χρονιές που αγγίζει η εισαγωγή. */
  REPLACE = 'replace',
}

export class ImportGraduateEntryDto {
  @IsString()
  @IsNotEmpty({ message: 'Το επώνυμο είναι υποχρεωτικό.' })
  @MaxLength(NAME_MAX_LENGTH)
  lastName: string;

  @IsString()
  @IsNotEmpty({ message: 'Το όνομα είναι υποχρεωτικό.' })
  @MaxLength(NAME_MAX_LENGTH)
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Η σχολή είναι υποχρεωτική.' })
  @MaxLength(SCHOOL_MAX_LENGTH)
  schoolTitle: string;

  /**
   * Αν λείπει, ισχύει το `defaultStartYear` της εισαγωγής. Έτσι μια κόλληση
   * που έχει δική της στήλη έτους μπορεί να μοιράσει τους επιτυχόντες σε
   * πολλές χρονιές με ένα ανέβασμα.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Το έτος πρέπει να είναι αριθμός.' })
  @Min(EARLIEST_YEAR)
  @Max(LATEST_YEAR)
  startYear?: number;
}

export class ImportGraduatesDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Δεν υπάρχει καμία εγγραφή προς εισαγωγή.' })
  @ArrayMaxSize(IMPORT_MAX_ENTRIES, {
    message: `Μέγιστο ${IMPORT_MAX_ENTRIES} εγγραφές ανά εισαγωγή.`,
  })
  @ValidateNested({ each: true })
  @Type(() => ImportGraduateEntryDto)
  entries: ImportGraduateEntryDto[];

  /** Το έτος για όσες εγγραφές δεν ορίζουν δικό τους. */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Το έτος πρέπει να είναι αριθμός.' })
  @Min(EARLIEST_YEAR)
  @Max(LATEST_YEAR)
  defaultStartYear?: number;

  @IsOptional()
  @IsEnum(ImportMode)
  mode?: ImportMode;
}
