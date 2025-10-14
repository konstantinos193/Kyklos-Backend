const mongoose = require('mongoose');

const newsletterSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  name: {
    type: String,
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  subscribedAt: {
    type: Date,
    default: Date.now
  },
  unsubscribedAt: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  source: {
    type: String,
    enum: ['website', 'admin', 'import'],
    default: 'website'
  },
  preferences: {
    categories: [{
      type: String,
      enum: ['Συμβουλές', 'Ψυχολογία', 'Μελέτη', 'Οργάνωση', 'Τεχνολογία', 'Οικογένεια', 'Γενικά']
    }],
    frequency: {
      type: String,
      enum: ['weekly', 'monthly', 'as-needed'],
      default: 'weekly'
    }
  },
  lastEmailSent: {
    type: Date
  },
  emailCount: {
    type: Number,
    default: 0
  },
  bounceCount: {
    type: Number,
    default: 0
  },
  isBounced: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for subscription duration
newsletterSchema.virtual('subscriptionDuration').get(function() {
  if (!this.isActive && this.unsubscribedAt) {
    return Math.floor((this.unsubscribedAt - this.subscribedAt) / (1000 * 60 * 60 * 24));
  }
  return Math.floor((new Date() - this.subscribedAt) / (1000 * 60 * 60 * 24));
});

// Index for better query performance
// email already has unique: true, so no need for explicit index
newsletterSchema.index({ isActive: 1 });
newsletterSchema.index({ subscribedAt: -1 });
newsletterSchema.index({ source: 1 });

module.exports = mongoose.model('Newsletter', newsletterSchema);
