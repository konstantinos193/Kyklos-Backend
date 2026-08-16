import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Collection, ObjectId } from 'mongodb';
import { DatabaseService } from '../database/database.service';
import { CacheService } from '../cache/cache.service';
import { CreateGraduateDto } from './dto/create-graduate.dto';
import { UpdateGraduateDto } from './dto/update-graduate.dto';
import { ImportGraduatesDto, ImportMode } from './dto/import-graduates.dto';
import { GraduateQueryDto } from './dto/graduate-query.dto';
import { Graduate, GraduateYear, toLabel, toSlug } from './dto/graduate.interface';

const COLLECTION_NAME = 'epityxontes';
const CACHE_PREFIX = 'epityxontes';
const CACHE_TTL_SECONDS = 600;

export interface ImportResult {
  inserted: number;
  removed: number;
  years: number[];
}

@Injectable()
export class EpityxontesService {
  private readonly logger = new Logger(EpityxontesService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cacheService: CacheService,
  ) {}

  private get collection(): Collection<Graduate> {
    return this.databaseService.getDb().collection<Graduate>(COLLECTION_NAME);
  }

  /**
   * Το public site διαβάζει από cache. Κάθε γράψιμο ρίχνει ολόκληρο το
   * namespace αντί για στοχευμένα κλειδιά: μια αλλαγή έτους μετακινεί εγγραφή
   * ανάμεσα σε δύο χρονιές και θα άφηνε το ένα από τα δύο κλειδιά μπαγιάτικο.
   */
  private async invalidateCache(): Promise<void> {
    await this.cacheService.delPattern(`${CACHE_PREFIX}:*`);
  }

  private toObjectId(id: string): ObjectId {
    if (!ObjectId.isValid(id)) {
      throw new NotFoundException('Η εγγραφή δεν βρέθηκε.');
    }
    return new ObjectId(id);
  }

  // ------------------------------------------------------------- public read

  /** Οι χρονιές που έχουν έστω έναν ορατό επιτυχόντα, νεότερη πρώτη. */
  async findYears(): Promise<GraduateYear[]> {
    const cacheKey = `${CACHE_PREFIX}:years`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const grouped = await this.collection
      .aggregate<{ _id: number; total: number }>([
        { $match: { isActive: true } },
        { $group: { _id: '$startYear', total: { $sum: 1 } } },
        { $sort: { _id: -1 } },
      ])
      .toArray();

    const years = grouped.map(({ _id: startYear, total }) => ({
      startYear,
      endYear: startYear + 1,
      slug: toSlug(startYear),
      label: toLabel(startYear),
      total,
    }));

    await this.cacheService.set(cacheKey, years, CACHE_TTL_SECONDS);
    return years;
  }

  /** Οι επιτυχόντες μιας χρονιάς, στη σειρά που τους έχει βάλει ο διαχειριστής. */
  async findByYear(startYear: number): Promise<Graduate[]> {
    const cacheKey = `${CACHE_PREFIX}:year:${startYear}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const graduates = await this.collection
      .find({ startYear, isActive: true })
      .sort({ order: 1, lastName: 1 })
      .toArray();

    await this.cacheService.set(cacheKey, graduates, CACHE_TTL_SECONDS);
    return graduates;
  }

  async findBySlug(slug: string): Promise<Graduate[]> {
    const startYear = this.parseSlug(slug);
    if (startYear === null) {
      throw new NotFoundException('Η χρονιά δεν βρέθηκε.');
    }
    return this.findByYear(startYear);
  }

  private parseSlug(slug: string): number | null {
    const match = /^epityxontes-etos-(\d{4})-(\d{4})$/.exec(slug);
    if (!match) return null;

    const startYear = parseInt(match[1], 10);
    // Το slug κουβαλάει και τα δύο έτη· αν δεν είναι διαδοχικά είναι χειρόγραφο.
    if (parseInt(match[2], 10) !== startYear + 1) return null;

    return startYear;
  }

  // -------------------------------------------------------------- admin read

  /** Λίστα για τη σελίδα διαχείρισης: με αναζήτηση, σελιδοποίηση και κρυμμένους. */
  async findAll(query: GraduateQueryDto) {
    const { startYear, search, includeHidden, page = 1, limit = 100 } = query;

    const filter: Record<string, unknown> = {};
    if (startYear !== undefined) filter.startYear = startYear;
    if (includeHidden !== 'true') filter.isActive = true;

    if (search?.trim()) {
      // Τα ονόματα είναι κεφαλαία ελληνικά· η αναζήτηση δεν πρέπει να το απαιτεί.
      const term = new RegExp(escapeRegExp(search.trim()), 'i');
      filter.$or = [{ lastName: term }, { firstName: term }, { schoolTitle: term }];
    }

    const total = await this.collection.countDocuments(filter);
    const graduates = await this.collection
      .find(filter)
      .sort({ startYear: -1, order: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    return {
      success: true,
      data: graduates,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ------------------------------------------------------------------ writes

  async create(dto: CreateGraduateDto, adminId: string): Promise<Graduate> {
    const now = new Date();
    const document = {
      ...normalizeNames(dto),
      startYear: dto.startYear,
      endYear: dto.startYear + 1,
      slug: toSlug(dto.startYear),
      order: await this.nextOrder(dto.startYear),
      isActive: true,
      source: 'admin' as const,
      createdAt: now,
      updatedAt: now,
      updatedBy: adminId,
    };

    const { insertedId } = await this.collection.insertOne(document as Graduate);
    await this.invalidateCache();

    return { ...document, _id: insertedId } as Graduate;
  }

  async update(id: string, dto: UpdateGraduateDto, adminId: string): Promise<Graduate> {
    const changes: Record<string, unknown> = { updatedAt: new Date(), updatedBy: adminId };

    if (dto.lastName !== undefined) changes.lastName = dto.lastName.trim();
    if (dto.firstName !== undefined) changes.firstName = dto.firstName.trim();
    if (dto.schoolTitle !== undefined) changes.schoolTitle = dto.schoolTitle.trim();
    if (dto.isActive !== undefined) changes.isActive = dto.isActive;

    // Η αλλαγή χρονιάς μετακομίζει την εγγραφή, άρα χρειάζεται νέα θέση στο
    // τέλος της χρονιάς-προορισμού - αλλιώς θα μοιραζόταν `order` με άλλον.
    if (dto.startYear !== undefined) {
      changes.startYear = dto.startYear;
      changes.endYear = dto.startYear + 1;
      changes.slug = toSlug(dto.startYear);
      changes.order = await this.nextOrder(dto.startYear);
    }

    const updated = await this.collection.findOneAndUpdate(
      { _id: this.toObjectId(id) },
      { $set: changes },
      { returnDocument: 'after' },
    );

    if (!updated) {
      throw new NotFoundException('Η εγγραφή δεν βρέθηκε.');
    }

    await this.invalidateCache();
    return updated;
  }

  async remove(id: string): Promise<{ deleted: true }> {
    const { deletedCount } = await this.collection.deleteOne({ _id: this.toObjectId(id) });

    if (deletedCount === 0) {
      throw new NotFoundException('Η εγγραφή δεν βρέθηκε.');
    }

    await this.invalidateCache();
    return { deleted: true };
  }

  async removeYear(startYear: number): Promise<{ removed: number }> {
    const { deletedCount } = await this.collection.deleteMany({ startYear });
    await this.invalidateCache();

    this.logger.log(`Διαγράφηκε η χρονιά ${startYear} (${deletedCount} εγγραφές)`);
    return { removed: deletedCount };
  }

  /**
   * Μαζική εισαγωγή. Οι εγγραφές μπορούν να ανήκουν σε διαφορετικές χρονιές
   * μέσα στην ίδια κόλληση, οπότε ομαδοποιούνται ανά έτος και κάθε ομάδα
   * παίρνει τις δικές της συνεχόμενες θέσεις.
   */
  async import(dto: ImportGraduatesDto, adminId: string): Promise<ImportResult> {
    const mode = dto.mode ?? ImportMode.APPEND;
    const now = new Date();

    const byYear = new Map<number, ImportGraduatesDto['entries']>();
    for (const entry of dto.entries) {
      const startYear = entry.startYear ?? dto.defaultStartYear;
      if (startYear === undefined) {
        throw new BadRequestException(
          'Λείπει η χρονιά: όρισε έτος για την εισαγωγή ή στήλη έτους ανά γραμμή.',
        );
      }
      const bucket = byYear.get(startYear);
      if (bucket) bucket.push(entry);
      else byYear.set(startYear, [entry]);
    }

    let inserted = 0;
    let removed = 0;

    for (const [startYear, entries] of byYear) {
      if (mode === ImportMode.REPLACE) {
        const { deletedCount } = await this.collection.deleteMany({ startYear });
        removed += deletedCount;
      }

      const firstOrder = await this.nextOrder(startYear);
      const documents = entries.map((entry, index) => ({
        ...normalizeNames(entry),
        startYear,
        endYear: startYear + 1,
        slug: toSlug(startYear),
        order: firstOrder + index,
        isActive: true,
        source: 'admin' as const,
        createdAt: now,
        updatedAt: now,
        updatedBy: adminId,
      }));

      await this.collection.insertMany(documents as Graduate[]);
      inserted += documents.length;
    }

    await this.invalidateCache();
    this.logger.log(`Εισαγωγή ${inserted} επιτυχόντων σε ${byYear.size} χρονιές (${mode})`);

    return { inserted, removed, years: [...byYear.keys()].sort((a, b) => b - a) };
  }

  /** Η επόμενη ελεύθερη θέση σε μια χρονιά. */
  private async nextOrder(startYear: number): Promise<number> {
    const last = await this.collection
      .find({ startYear })
      .sort({ order: -1 })
      .limit(1)
      .next();

    return last ? last.order + 1 : 0;
  }
}

function normalizeNames<T extends { lastName: string; firstName: string; schoolTitle: string }>(
  entry: T,
) {
  return {
    lastName: entry.lastName.trim(),
    firstName: entry.firstName.trim(),
    schoolTitle: entry.schoolTitle.trim(),
  };
}

/** Ο όρος αναζήτησης πάει σε RegExp· χωρίς escape ένα «(» ρίχνει το query. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
