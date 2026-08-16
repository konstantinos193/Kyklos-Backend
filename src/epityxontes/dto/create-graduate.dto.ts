import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Το φροντιστήριο λειτουργεί από τις αρχές του '90. Τα όρια δεν είναι
 * καλλωπισμός: κρατάνε έξω το «2O25» και το «205» που γράφονται κατά λάθος
 * και θα δημιουργούσαν σιωπηλά μια χρονιά-φάντασμα στο public site.
 */
export const EARLIEST_YEAR = 1980;
export const LATEST_YEAR = new Date().getFullYear() + 1;

export const NAME_MAX_LENGTH = 120;
export const SCHOOL_MAX_LENGTH = 250;

export class CreateGraduateDto {
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

  @Type(() => Number)
  @IsInt({ message: 'Το έτος πρέπει να είναι αριθμός.' })
  @Min(EARLIEST_YEAR, { message: `Το έτος δεν μπορεί να είναι πριν το ${EARLIEST_YEAR}.` })
  @Max(LATEST_YEAR, { message: `Το έτος δεν μπορεί να είναι μετά το ${LATEST_YEAR}.` })
  startYear: number;
}
