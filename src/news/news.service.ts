import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CacheService } from '../cache/cache.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { ObjectId } from 'mongodb';
import { NewsType } from './dto/create-news.dto';

@Injectable()
export class NewsService {
  private readonly COLLECTION_NAME = 'news';
  private readonly CACHE_DURATION = {
    NEWS_LIST: 300, // 5 minutes
    NEWS_SINGLE: 600, // 10 minutes
    NEWS_TYPES: 1800, // 30 minutes
  };

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cacheService: CacheService,
    private readonly cloudinaryService: CloudinaryService,
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

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  private calculateReadTime(content: string): string {
    const wordsPerMinute = 200;
    const wordCount = content.split(/\s+/).length;
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    return `${minutes} λεπτά`;
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
    let cursor = collection.find(filter).sort({ publishDate: -1 }).skip(skip).limit(limit);
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
      .sort({ publishDate: -1 })
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

  async create(data: any) {
    const collection = this.getCollection();

    // Generate slug if not provided
    if (!data.slug && data.title) {
      data.slug = this.generateSlug(data.title);
    }

    // Calculate read time if not provided
    if (!data.readTime && data.content) {
      data.readTime = this.calculateReadTime(data.content);
    }

    // Set publish date if not provided
    if (!data.publishDate) {
      data.publishDate = new Date();
    }

    const result = await collection.insertOne(data);
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

    // Generate slug if title is being updated
    if (data.title && !data.slug) {
      data.slug = this.generateSlug(data.title);
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
    const post = await this.findById(id.toString());
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
          const cloudinaryResult = await this.cloudinaryService.uploadFile(
            file,
            'news',
          );
          uploadedFiles.push({
            url: cloudinaryResult.url,
            secureUrl: cloudinaryResult.secureUrl,
            publicId: cloudinaryResult.publicId,
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

    return await this.findById(id.toString());
  }

  async deleteFile(id: string | ObjectId, filePublicId: string) {
    const post = await this.findById(id.toString());
    if (!post || !post.success) {
      throw new NotFoundException('News post not found');
    }

    const postData = post.data as any;
    const file = postData.attachments?.find((f: any) => f.publicId === filePublicId);
    if (!file) {
      throw new NotFoundException('File not found');
    }

    try {
      await this.cloudinaryService.deleteFile(filePublicId);
    } catch (error) {
      console.error('Error deleting file from Cloudinary:', error);
    }

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

    return await this.findById(id.toString());
  }
}

