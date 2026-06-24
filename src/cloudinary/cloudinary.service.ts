import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  /**
   * Retry utility with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      initialDelay = 1000,
      maxDelay = 30000,
      backoffMultiplier = 2,
    } = options;

    let lastError: any;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Check if we should retry this error
        if (!this.shouldRetry(error) || attempt === maxRetries) {
          throw error;
        }

        this.logger.warn(
          `Cloudinary operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`,
          (error as Error)?.message || String(error)
        );

        // Wait with exponential backoff
        await this.sleep(delay);
        delay = Math.min(delay * backoffMultiplier, maxDelay);
      }
    }

    throw lastError;
  }

  /**
   * Determine if an error is retryable
   */
  private shouldRetry(error: any): boolean {
    // Retry on network errors
    if (!error.response) {
      return true;
    }

    // Retry on 5xx errors
    if (error.http_code && error.http_code >= 500) {
      return true;
    }

    // Retry on timeout
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
      return true;
    }

    // Don't retry on 4xx client errors
    return false;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Upload file with retry logic
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'panhellenic-archive',
  ): Promise<{ url: string; publicId: string; secureUrl: string }> {
    return this.retryWithBackoff(async () => {
      return new Promise((resolve, reject) => {
        // Determine resource type based on file MIME type
        const isPdf = file.mimetype === 'application/pdf';
        const isDocument = [
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ].includes(file.mimetype);
        
        const resourceType = isPdf || isDocument ? 'raw' : 'auto';
        
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: resourceType,
            type: 'upload',
            access_mode: 'public',
            allowed_formats: ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
            timeout: 60000, // 60 second timeout
          },
          (error, result) => {
            if (error) {
              this.logger.error('Cloudinary upload error:', error);
              reject(error);
            } else {
              resolve({
                url: result.url,
                publicId: result.public_id,
                secureUrl: result.secure_url,
              });
            }
          },
        );

        // Convert buffer to stream
        const readableStream = new Readable();
        readableStream.push(file.buffer);
        readableStream.push(null);
        
        // Handle stream errors
        readableStream.on('error', (error) => {
          this.logger.error('Stream error during upload:', error);
          reject(error);
        });

        uploadStream.on('error', (error) => {
          this.logger.error('Upload stream error:', error);
          reject(error);
        });

        readableStream.pipe(uploadStream);
      });
    }, { maxRetries: 3, initialDelay: 1000 });
  }

  /**
   * Delete file with retry logic
   */
  async deleteFile(publicId: string, resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto'): Promise<void> {
    return this.retryWithBackoff(async () => {
      try {
        const result = await cloudinary.uploader.destroy(publicId, {
          resource_type: resourceType,
        });
        
        if (result.result !== 'ok' && result.result !== 'not found') {
          throw new InternalServerErrorException(`Failed to delete file: ${result.result}`);
        }
        
        this.logger.log(`File deleted successfully: ${publicId}`);
      } catch (error) {
        this.logger.error('Error deleting file from Cloudinary:', error);
        throw error;
      }
    }, { maxRetries: 2, initialDelay: 500 });
  }

  /**
   * Upload buffer with retry logic
   */
  async uploadBuffer(
    buffer: Buffer,
    folder: string = 'panhellenic-archive',
    resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto',
  ): Promise<{ url: string; publicId: string; secureUrl: string }> {
    return this.retryWithBackoff(async () => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: resourceType,
            timeout: 60000,
          },
          (error, result) => {
            if (error) {
              this.logger.error('Cloudinary buffer upload error:', error);
              reject(error);
            } else {
              resolve({
                url: result.url,
                publicId: result.public_id,
                secureUrl: result.secure_url,
              });
            }
          },
        );

        const readableStream = new Readable();
        readableStream.push(buffer);
        readableStream.push(null);
        
        readableStream.on('error', (error) => {
          this.logger.error('Stream error during buffer upload:', error);
          reject(error);
        });

        uploadStream.on('error', (error) => {
          this.logger.error('Buffer upload stream error:', error);
          reject(error);
        });

        readableStream.pipe(uploadStream);
      });
    }, { maxRetries: 3, initialDelay: 1000 });
  }

  /**
   * Get a secure URL for a Cloudinary resource
   */
  async getSecureUrl(publicId: string, resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto'): Promise<string> {
    try {
      const url = cloudinary.url(publicId, {
        resource_type: resourceType,
        secure: true,
        type: 'upload',
      });
      return url;
    } catch (error) {
      this.logger.error('Error generating secure URL:', error);
      throw error;
    }
  }

  /**
   * Get the URL for a Cloudinary resource
   */
  getFileUrl(publicId: string, resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto'): string {
    return cloudinary.url(publicId, {
      resource_type: resourceType,
      secure: true,
      type: 'upload',
    });
  }

  /**
   * Health check for Cloudinary service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to ping Cloudinary API
      await cloudinary.api.ping();
      return true;
    } catch (error) {
      this.logger.error('Cloudinary health check failed:', error);
      return false;
    }
  }
}

