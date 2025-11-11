import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'panhellenic-archive',
  ): Promise<{ url: string; publicId: string; secureUrl: string }> {
    return new Promise((resolve, reject) => {
      // Determine resource type based on file MIME type
      // PDFs and other documents should be uploaded as 'raw' to ensure they're viewable in browsers
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
          type: 'upload', // Ensure files are uploaded (not private)
          access_mode: 'public', // Make files publicly accessible
          allowed_formats: ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
        },
        (error, result) => {
          if (error) {
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
      readableStream.pipe(uploadStream);
    });
  }

  async deleteFile(publicId: string, resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto'): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
    } catch (error) {
      console.error('Error deleting file from Cloudinary:', error);
      throw error;
    }
  }

  async uploadBuffer(
    buffer: Buffer,
    folder: string = 'panhellenic-archive',
    resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto',
  ): Promise<{ url: string; publicId: string; secureUrl: string }> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,
        },
        (error, result) => {
          if (error) {
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
      readableStream.pipe(uploadStream);
    });
  }

  /**
   * Get a secure URL for a Cloudinary resource
   * This can be used to access files that might not be publicly accessible
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
      console.error('Error generating secure URL:', error);
      throw error;
    }
  }

  /**
   * Get the URL for a Cloudinary resource
   * This generates a URL that can be used to access the file
   */
  getFileUrl(publicId: string, resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto'): string {
    return cloudinary.url(publicId, {
      resource_type: resourceType,
      secure: true,
      type: 'upload',
    });
  }
}

