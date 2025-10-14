const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  slug: {
    type: String,
    required: [true, 'Slug is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  excerpt: {
    type: String,
    required: [true, 'Excerpt is required'],
    maxlength: [500, 'Excerpt cannot exceed 500 characters']
  },
  content: {
    type: String,
    required: [true, 'Content is required']
  },
  author: {
    name: {
      type: String,
      required: [true, 'Author name is required'],
      trim: true
    },
    image: {
      type: String,
      default: ''
    }
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['Συμβουλές', 'Ψυχολογία', 'Μελέτη', 'Οργάνωση', 'Τεχνολογία', 'Οικογένεια', 'Γενικά']
  },
  tags: [{
    type: String,
    trim: true
  }],
  image: {
    url: {
      type: String,
      required: [true, 'Image URL is required']
    },
    alt: {
      type: String,
      default: ''
    },
    caption: {
      type: String,
      default: ''
    }
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  publishDate: {
    type: Date,
    default: Date.now
  },
  readTime: {
    type: String,
    default: '5 λεπτά'
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  featured: {
    type: Boolean,
    default: false
  },
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for reading time calculation
blogSchema.virtual('calculatedReadTime').get(function() {
  const wordsPerMinute = 200;
  const wordCount = this.content.split(/\s+/).length;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  return `${minutes} λεπτά`;
});

// Pre-save middleware to generate slug
blogSchema.pre('save', function(next) {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }
  next();
});

// Index for better query performance
blogSchema.index({ status: 1, publishDate: -1 });
blogSchema.index({ category: 1 });
blogSchema.index({ tags: 1 });
// slug already has unique: true, so no need for explicit index

module.exports = mongoose.model('Blog', blogSchema);
