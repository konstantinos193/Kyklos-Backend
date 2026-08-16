import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CacheService } from '../cache/cache.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { ObjectId } from 'mongodb';
import { NewsType } from './dto/create-news.dto';
import { News } from './dto/news.interface';
import { slugify, uniqueSlug } from './slug.util';

@Injectable()
export class NewsService {
  private readonly COLLECTION_NAME = 'news';
  private readonly CACHE_DURATION = {
    NEWS_LIST: 300, // 5 minutes
    NEWS_SINGLE: 600, // 10 minutes
    NEWS_TYPES: 1800, // 30 minutes
  };

  private readonly logger = new Logger(NewsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cacheService: CacheService,
    private readonly storageService: LocalStorageService,
  ) {}

  private getCollection() {
    return this.databaseService.getDb().collection(this.COLLECTION_NAME);
  }

  private toObjectId(id: string | ObjectId): ObjectId | null {
    if (!id) return null;
    if (typeof id === 'string') {
      if (!ObjectId.isValid(id)) return null;
      return new ObjectId(id);
    }
    return id;
  }

  /**
   * A slug that transliterates Greek and does not collide with an existing
   * post. `excludeId` keeps a post from being treated as its own duplicate
   * when it is saved again under the same title.
   */
  private async generateSlug(title: string, excludeId?: ObjectId): Promise<string> {
    const collection = this.getCollection();

    return uniqueSlug(slugify(title), async (candidate) => {
      const filter: any = { slug: candidate };
      if (excludeId) filter._id = { $ne: excludeId };
      return (await collection.countDocuments(filter, { limit: 1 })) > 0;
    });
  }

  private calculateReadTime(content: string): string {
    const wordsPerMinute = 200;
    // Tags are not words. Counting them inflated the estimate on any post that
    // used formatting, which is now every post.
    const text = content
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .trim();
    const wordCount = text ? text.split(/\s+/).length : 0;
    const minutes = Math.max(1, Math.ceil(wordCount / wordsPerMinute));
    return `${minutes} λεπτά`;
  }

  /**
   * The listing behind the admin panel.
   *
   * `findAll` pins `status: 'published'` because it answers public requests, so
   * an administrator using it could never see a draft — the drafts existed, and
   * nothing in the product could show them. This is the same query without that
   * pin, on a guarded route, and deliberately uncached: someone who just saved
   * a post expects to see it in the list, not in five minutes.
   */
  async findAllForAdmin(query: {
    page?: number;
    limit?: number;
    type?: NewsType;
    status?: string;
    search?: string;
  }) {
    const { page = 1, limit = 20, type, status, search } = query;
    const filter: any = {};

    if (type) filter.type = type;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const collection = this.getCollection();
    const total = await collection.countDocuments(filter);

    const data = await collection
      .find(filter)
      // Newest first by the date the administrator set, falling back to
      // creation for rows that predate a publish date.
      .sort({ publishDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    return {
      success: true,
      data,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    type?: NewsType;
    search?: string;
    featured?: string;
  }) {
    const { page = 1, limit = 10, type, search, featured } = query;
    const cacheKey = `news:list:${page}:${limit}:${type || 'all'}:${search || 'none'}:${featured || 'all'}`;

    // Try cache first
    const cachedResult = await this.cacheService.get(cacheKey);
    if (cachedResult) {
      return {
        success: true,
        data: cachedResult.data,
        pagination: cachedResult.pagination,
        cached: true,
        timestamp: new Date().toISOString(),
      };
    }

    // Build query
    const filter: any = { status: 'published' };

    if (type) {
      filter.type = type;
    }

    if (featured === 'true') {
      filter.featured = true;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const collection = this.getCollection();
    const skip = (page - 1) * limit;

    // Get total count
    const total = await collection.countDocuments(filter);

    // Get documents
    let cursor = collection.find(filter).sort({ publishedAt: -1, publishDate: -1 }).skip(skip).limit(limit);
    const data = await cursor.toArray();

    // Sort featured posts first
    data.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return 0;
    });

    const formattedResult = {
      data,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };

    // Cache the result
    await this.cacheService.set(cacheKey, formattedResult, this.CACHE_DURATION.NEWS_LIST);

    return {
      success: true,
      data: formattedResult.data,
      pagination: formattedResult.pagination,
      cached: false,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Looks a post up by id or slug without caring whether it is public.
   *
   * `findById` answers the public route and so only ever returns published
   * posts. Everything behind the admin guard — loading a draft into the
   * editor, attaching a file to one — needs the post regardless of status, and
   * used to get a 404 instead. Uncached and without a view count, because
   * neither belongs to an editing session.
   */
  private async findRawById(id: string) {
    const objectId = this.toObjectId(id);

    return this.getCollection().findOne({
      $or: objectId ? [{ _id: objectId }, { slug: id }] : [{ slug: id }],
    });
  }

  async findByIdForAdmin(id: string) {
    const post = await this.findRawById(id);
    if (!post) {
      throw new NotFoundException('News post not found');
    }

    return { success: true, data: post, cached: false };
  }

  async findById(id: string) {
    const cacheKey = `news:single:${id}`;

    const cachedResult = await this.cacheService.get(cacheKey);
    if (cachedResult) {
      // Increment view count asynchronously
      this.incrementViews(id).catch(() => {});
      return {
        success: true,
        data: cachedResult,
        cached: true,
      };
    }

    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    
    const post = await collection.findOne({
      $or: objectId ? [{ _id: objectId }, { slug: id }] : [{ slug: id }],
      status: 'published',
    });

    if (!post) {
      throw new NotFoundException('News post not found');
    }

    // Cache the result
    await this.cacheService.set(cacheKey, post, this.CACHE_DURATION.NEWS_SINGLE);

    // Increment view count asynchronously
    this.incrementViews(post._id.toString()).catch(() => {});

    return {
      success: true,
      data: post,
      cached: false,
    };
  }

  async getByType(type: NewsType) {
    const cacheKey = `news:type:${type}`;

    const cachedResult = await this.cacheService.get(cacheKey);
    if (cachedResult) {
      return {
        success: true,
        data: cachedResult,
        cached: true,
      };
    }

    const collection = this.getCollection();
    const posts = await collection
      .find({ type, status: 'published' })
      .sort({ publishedAt: -1, publishDate: -1 })
      .toArray();

    await this.cacheService.set(cacheKey, posts, this.CACHE_DURATION.NEWS_LIST);

    return {
      success: true,
      data: posts,
      cached: false,
    };
  }

  async getTypes() {
    const cacheKey = 'news:types';

    const cachedResult = await this.cacheService.get(cacheKey);
    if (cachedResult) {
      return {
        success: true,
        data: cachedResult,
        cached: true,
      };
    }

    const collection = this.getCollection();
    const types = await collection.distinct('type', { status: 'published' });

    await this.cacheService.set(cacheKey, types, this.CACHE_DURATION.NEWS_TYPES);

    return {
      success: true,
      data: types,
      cached: false,
    };
  }

  async create(data: Partial<News>) {
    const collection = this.getCollection();

    // The editor sends a slug of its own; either way it has to be unique, and
    // slugifying an already-slugified string leaves it unchanged.
    data.slug = await this.generateSlug(data.slug || data.title || '');

    // Calculate read time if not provided
    if (!data.readTime && data.content) {
      data.readTime = this.calculateReadTime(data.content);
    }

    // Set publish date if not provided
    if (!data.publishDate) {
      data.publishDate = new Date();
    }

    // Remove _id from data before insert
    const { _id, ...insertData } = data;
    const result = await collection.insertOne(insertData);
    const post = { ...data, _id: result.insertedId };

    // Clear related caches
    await this.cacheService.delPattern('news:list:*');
    await this.cacheService.delPattern('news:type:*');
    await this.cacheService.del('news:types');

    return {
      success: true,
      data: post,
      message: 'News post created successfully',
    };
  }

  async update(id: string, data: any) {
    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) {
      throw new NotFoundException('Invalid news post ID');
    }

    // Re-derive the slug whenever either half of it moves, excluding this post
    // so re-saving under the same title doesn't append a counter each time.
    if (data.slug || data.title) {
      data.slug = await this.generateSlug(data.slug || data.title, objectId);
    }

    // Calculate read time if content is being updated
    if (data.content && !data.readTime) {
      data.readTime = this.calculateReadTime(data.content);
    }

    const result = await collection.findOneAndUpdate(
      { _id: objectId },
      { $set: data },
      { returnDocument: 'after' },
    );

    if (!result) {
      throw new NotFoundException('News post not found');
    }

    // Clear related caches
    await this.cacheService.delPattern('news:list:*');
    await this.cacheService.delPattern('news:type:*');
    await this.cacheService.del(`news:single:${id}`);
    await this.cacheService.del('news:types');

    return {
      success: true,
      data: result,
      message: 'News post updated successfully',
    };
  }

  async delete(id: string) {
    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) {
      throw new NotFoundException('Invalid news post ID');
    }

    const result = await collection.findOneAndDelete({ _id: objectId });

    if (!result) {
      throw new NotFoundException('News post not found');
    }

    // The files are ours now, not a third party's, so a deleted post takes its
    // cover and attachments off the disk with it. Deletion never throws, so a
    // missing file cannot fail a request whose record is already gone.
    const deleted = result as any;
    await this.storageService.delete(deleted?.image?.publicId);
    for (const attachment of deleted?.attachments ?? []) {
      await this.storageService.delete(attachment?.publicId);
    }

    // Clear related caches
    await this.cacheService.delPattern('news:list:*');
    await this.cacheService.delPattern('news:type:*');
    await this.cacheService.del(`news:single:${id}`);
    await this.cacheService.del('news:types');

    return {
      success: true,
      message: 'News post deleted successfully',
    };
  }

  private async incrementViews(id: string) {
    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) return;

    await collection.updateOne({ _id: objectId }, { $inc: { views: 1 } });
  }

  async addFiles(id: string | ObjectId, files: Express.Multer.File[]) {
    const post = await this.findByIdForAdmin(id.toString());
    if (!post || !post.success) {
      throw new NotFoundException('News post not found');
    }

    const uploadedFiles: Array<{
      url: string;
      secureUrl: string;
      publicId: string;
      fileName: string;
      fileType: string;
      fileSize: number;
    }> = [];

    if (files && files.length > 0) {
      for (const file of files) {
        try {
          // Attachments are downloaded rather than rendered, so they are stored
          // byte for byte - a worksheet has to come back out as the file the
          // teacher uploaded.
          const stored = await this.storageService.saveRawFile(file, 'news-attachments');
          uploadedFiles.push({
            url: stored.url,
            secureUrl: stored.secureUrl,
            publicId: stored.publicId,
            fileName: file.originalname,
            fileType: file.mimetype,
            fileSize: file.size,
          });
        } catch (error) {
          console.error('Error uploading file:', error);
          throw new BadRequestException(`Failed to upload file: ${file.originalname}`);
        }
      }
    }

    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    await collection.updateOne(
      { _id: objectId },
      {
        $push: { attachments: { $each: uploadedFiles } } as any,
        $set: { updatedAt: new Date() },
      },
    );

    // Clear related caches
    await this.cacheService.delPattern('news:list:*');
    await this.cacheService.delPattern('news:type:*');
    await this.cacheService.del(`news:single:${id.toString()}`);
    await this.cacheService.del('news:types');

    return await this.findByIdForAdmin(id.toString());
  }

  async updateImage(id: string, file: Express.Multer.File | undefined, imageData: { alt?: string; caption?: string }) {
    const post = await this.findByIdForAdmin(id);
    if (!post || !post.success) {
      throw new NotFoundException('News post not found');
    }

    const postData = post.data as any;
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Update image metadata
    if (imageData.alt !== undefined) {
      updateData['image.alt'] = imageData.alt;
    }
    if (imageData.caption !== undefined) {
      updateData['image.caption'] = imageData.caption;
    }

    // Upload new image if provided
    if (file) {
      const previousPublicId = postData?.image?.publicId;

      try {
        const stored = await this.storageService.saveImage(file, 'news');
        updateData['image.url'] = stored.secureUrl;
        updateData['image.publicId'] = stored.publicId;
        updateData['image.width'] = stored.width;
        updateData['image.height'] = stored.height;
      } catch (error) {
        this.logger.error(`Cover image replacement failed: ${(error as Error)?.message ?? error}`);
        throw error instanceof BadRequestException
          ? error
          : new BadRequestException('Η εικόνα δεν μπόρεσε να αποθηκευτεί');
      }

      // The old file is only unlinked once the new one is safely on disk, and
      // only when the digest actually changed - re-saving the same photo
      // resolves to the same path, which would otherwise delete what was just
      // written.
      if (previousPublicId && previousPublicId !== updateData['image.publicId']) {
        await this.storageService.delete(previousPublicId);
      }
    }

    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    const result = await collection.findOneAndUpdate(
      { _id: objectId },
      { $set: updateData },
      { returnDocument: 'after' },
    );

    // Clear related caches
    await this.cacheService.delPattern('news:list:*');
    await this.cacheService.delPattern('news:type:*');
    await this.cacheService.del(`news:single:${id}`);
    await this.cacheService.del('news:types');

    return {
      success: true,
      data: result,
      message: 'Image updated successfully',
    };
  }

  async deleteFile(id: string | ObjectId, filePublicId: string) {
    const post = await this.findByIdForAdmin(id.toString());
    if (!post || !post.success) {
      throw new NotFoundException('News post not found');
    }

    const postData = post.data as any;
    const file = postData.attachments?.find((f: any) => f.publicId === filePublicId);
    if (!file) {
      throw new NotFoundException('File not found');
    }

    await this.storageService.delete(filePublicId);

    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    await collection.updateOne(
      { _id: objectId },
      {
        $pull: { attachments: { publicId: filePublicId } } as any,
        $set: { updatedAt: new Date() },
      },
    );

    // Clear related caches
    await this.cacheService.delPattern('news:list:*');
    await this.cacheService.delPattern('news:type:*');
    await this.cacheService.del(`news:single:${id.toString()}`);
    await this.cacheService.del('news:types');

    return await this.findByIdForAdmin(id.toString());
  }

  /**
   * Stores a single cover image on this host and hands back its URL, so the
   * admin panel can attach a file to a post that does not exist yet.
   *
   * The file is resized, stripped of metadata and re-encoded once, here - never
   * per request. What lands on disk is what nginx will hand out unchanged for
   * the rest of its life.
   */
  async uploadCoverImage(file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('Δεν επιλέχθηκε αρχείο εικόνας');
    }

    try {
      const stored = await this.storageService.saveImage(file, 'news');

      return {
        success: true,
        data: {
          url: stored.secureUrl,
          publicId: stored.publicId,
          width: stored.width,
          height: stored.height,
          bytes: stored.bytes,
        },
      };
    } catch (error: any) {
      // A rejected file is the administrator's problem and says so; anything
      // else is this host's problem - a full disk, a broken mount - and its
      // message is logged rather than returned.
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Cover image storage failed: ${error?.message ?? error}`);
      throw new ServiceUnavailableException(
        'Η αποθήκευση της εικόνας απέτυχε. Δοκιμάστε ξανά σε λίγο.',
      );
    }
  }
}

