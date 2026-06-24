export interface News {
  _id?: string;
  title: string;
  slug?: string;
  content: string;
  excerpt?: string;
  author?: {
    name: string;
    image?: string;
  };
  category?: string;
  tags?: string[];
  image?: {
    url: string;
    alt?: string;
    caption?: string;
    publicId?: string;
  };
  publishDate?: Date;
  publishedAt?: Date;
  readTime?: string;
  status?: string;
  type?: string;
  eventDate?: Date;
  location?: string;
  featured?: boolean;
  attachments?: Array<{
    url: string;
    secureUrl: string;
    publicId: string;
    fileName: string;
    fileType: string;
    fileSize: number;
  }>;
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
  };
  views?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
