import { ObjectId } from 'mongodb';

/**
 * Ένας επιτυχών σε σχολή, για ένα σχολικό έτος.
 *
 * Ονοματολογία: το domain λέγεται `epityxontes` παντού (route, collection,
 * public URL) γιατί έτσι το λέει ο πελάτης και έτσι είναι ήδη τα links του site.
 * Η μονάδα του στα αγγλικά είναι `Graduate` - δεν υπάρχει βολικός ελληνικός
 * ενικός για κώδικα.
 */
export interface Graduate {
  _id: ObjectId;
  lastName: string;
  firstName: string;
  schoolTitle: string;
  /** Έτος έναρξης σχολικής χρονιάς: το 2025 σημαίνει «2025-2026». */
  startYear: number;
  endYear: number;
  /** Παράγωγο του startYear - το route του public site. */
  slug: string;
  /** Σειρά εμφάνισης μέσα στο έτος. */
  order: number;
  isActive: boolean;
  /** `seed` για όσους ήρθαν από το παλιό students-data.ts, `admin` για τους νέους. */
  source: 'seed' | 'admin';
  createdAt: Date;
  updatedAt: Date;
  updatedBy?: string;
}

/** Μία χρονιά όπως εμφανίζεται στη λίστα ετών. */
export interface GraduateYear {
  startYear: number;
  endYear: number;
  slug: string;
  label: string;
  total: number;
}

export function toSlug(startYear: number): string {
  return `epityxontes-etos-${startYear}-${startYear + 1}`;
}

export function toLabel(startYear: number): string {
  return `Επιτυχόντες Έτος ${startYear}-${startYear + 1}`;
}
