import { ObjectId } from 'mongodb';

/**
 * Ένας επιτυχών σε σχολή, για μία χρονιά Πανελλαδικών.
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
  /**
   * Η χρονιά των επιτυχόντων, ένα σκέτο έτος: 2025 σημαίνει «Επιτυχόντες 2025».
   * Το site έγραφε «2025-2026» και ο πελάτης το διόρθωσε (10/2026) - το δεύτερο
   * έτος ήταν λάθος. Το πεδίο κράτησε το όνομα `startYear` γιατί είναι στη βάση
   * και στο API· η μετονομασία δεν άξιζε το ρίσκο.
   */
  startYear: number;
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
  slug: string;
  label: string;
  total: number;
}

export function toSlug(startYear: number): string {
  return `epityxontes-etos-${startYear}`;
}

export function toLabel(startYear: number): string {
  return `Επιτυχόντες Έτος ${startYear}`;
}
