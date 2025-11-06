import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CacheService } from '../cache/cache.service';
import { ObjectId } from 'mongodb';

@Injectable()
export class BlogService {
  private readonly COLLECTION_NAME = 'blogs';
  private readonly CACHE_DURATION = {
    BLOG_LIST: 300, // 5 minutes
    BLOG_SINGLE: 600, // 10 minutes
    BLOG_CATEGORIES: 1800, // 30 minutes
  };

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cacheService: CacheService,
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
    category?: string;
    search?: string;
    featured?: string;
  }) {
    const { page = 1, limit = 10, category, search, featured } = query;
    const cacheKey = `blog:list:${page}:${limit}:${category || 'all'}:${search || 'none'}:${featured || 'all'}`;

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

    if (category) {
      filter.category = category;
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
    await this.cacheService.set(cacheKey, formattedResult, this.CACHE_DURATION.BLOG_LIST);

    return {
      success: true,
      data: formattedResult.data,
      pagination: formattedResult.pagination,
      cached: false,
      timestamp: new Date().toISOString(),
    };
  }

  async findById(id: string) {
    const cacheKey = `blog:single:${id}`;

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
      throw new NotFoundException('Blog post not found');
    }

    // Cache the result
    await this.cacheService.set(cacheKey, post, this.CACHE_DURATION.BLOG_SINGLE);

    // Increment view count asynchronously
    this.incrementViews(post._id.toString()).catch(() => {});

    return {
      success: true,
      data: post,
      cached: false,
    };
  }

  async getCategories() {
    const cacheKey = 'blog:categories';

    const cachedResult = await this.cacheService.get(cacheKey);
    if (cachedResult) {
      return {
        success: true,
        data: cachedResult,
        cached: true,
      };
    }

    const collection = this.getCollection();
    const categories = await collection.distinct('category', { status: 'published' });

    await this.cacheService.set(cacheKey, categories, this.CACHE_DURATION.BLOG_CATEGORIES);

    return {
      success: true,
      data: categories,
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
    await this.cacheService.delPattern('blog:list:*');
    await this.cacheService.del('blog:categories');

    return {
      success: true,
      data: post,
      message: 'Blog post created successfully',
    };
  }

  async update(id: string, data: any) {
    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) {
      throw new NotFoundException('Invalid blog post ID');
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
      throw new NotFoundException('Blog post not found');
    }

    // Clear related caches
    await this.cacheService.delPattern('blog:list:*');
    await this.cacheService.del(`blog:single:${id}`);
    await this.cacheService.del('blog:categories');

    return {
      success: true,
      data: result,
      message: 'Blog post updated successfully',
    };
  }

  async delete(id: string) {
    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) {
      throw new NotFoundException('Invalid blog post ID');
    }

    const result = await collection.findOneAndDelete({ _id: objectId });

    if (!result) {
      throw new NotFoundException('Blog post not found');
    }

    // Clear related caches
    await this.cacheService.delPattern('blog:list:*');
    await this.cacheService.del(`blog:single:${id}`);
    await this.cacheService.del('blog:categories');

    return {
      success: true,
      message: 'Blog post deleted successfully',
    };
  }

  private async incrementViews(id: string) {
    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) return;

    await collection.updateOne({ _id: objectId }, { $inc: { views: 1 } });
  }
}

