const mongoose = require('mongoose');

const examMaterialSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  grade: {
    type: String,
    required: true,
    trim: true
  },
  year: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['exam', 'solution', 'practice', 'theory', 'notes'],
    required: true
  },
  accessLevel: {
    type: String,
    enum: ['basic', 'premium', 'vip'],
    default: 'basic'
  },
  filePath: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number, // in bytes
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  lockReason: {
    type: String,
    trim: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  uploadedByName: {
    type: String,
    required: true
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  lastDownloaded: {
    type: Date
  },
  metadata: {
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium'
    },
    duration: {
      type: Number, // in minutes
      default: 120
    },
    questions: {
      type: Number,
      default: 0
    },
    points: {
      type: Number,
      default: 0
    }
  },
  accessPermissions: {
    students: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student'
    }],
    grades: [{
      type: String
    }],
    subjects: [{
      type: String
    }],
    timeRestrictions: {
      startDate: Date,
      endDate: Date,
      timeSlots: [{
        day: String,
        startTime: String,
        endTime: String
      }]
    }
  },
  version: {
    type: Number,
    default: 1
  },
  previousVersions: [{
    filePath: String,
    fileName: String,
    uploadedAt: Date,
    uploadedBy: String
  }]
}, {
  timestamps: true
});

// Indexes for better performance
examMaterialSchema.index({ subject: 1, grade: 1, year: 1 });
examMaterialSchema.index({ type: 1, accessLevel: 1 });
examMaterialSchema.index({ isActive: 1, isLocked: 1 });
examMaterialSchema.index({ uploadedBy: 1 });
examMaterialSchema.index({ tags: 1 });

// Virtual for formatted file size
examMaterialSchema.virtual('formattedFileSize').get(function() {
  const bytes = this.fileSize;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Virtual for download URL
examMaterialSchema.virtual('downloadUrl').get(function() {
  return `/api/exam-materials/download/${this._id}`;
});

// Method to check if student has access
examMaterialSchema.methods.hasStudentAccess = function(student) {
  // Check if material is active and not locked
  if (!this.isActive || this.isLocked) {
    return false;
  }

  // Check access level
  const studentAccessLevel = student.accessLevel || 'basic';
  const accessLevels = ['basic', 'premium', 'vip'];
  const studentLevelIndex = accessLevels.indexOf(studentAccessLevel);
  const materialLevelIndex = accessLevels.indexOf(this.accessLevel);
  
  if (studentLevelIndex < materialLevelIndex) {
    return false;
  }

  // Check specific permissions
  if (this.accessPermissions.students.length > 0) {
    if (!this.accessPermissions.students.includes(student._id)) {
      return false;
    }
  }

  if (this.accessPermissions.grades.length > 0) {
    if (!this.accessPermissions.grades.includes(student.grade)) {
      return false;
    }
  }

  if (this.accessPermissions.subjects.length > 0) {
    const hasSubjectAccess = this.accessPermissions.subjects.some(subject => 
      student.subjects.includes(subject)
    );
    if (!hasSubjectAccess) {
      return false;
    }
  }

  // Check time restrictions
  if (this.accessPermissions.timeRestrictions) {
    const now = new Date();
    const { startDate, endDate } = this.accessPermissions.timeRestrictions;
    
    if (startDate && now < startDate) {
      return false;
    }
    
    if (endDate && now > endDate) {
      return false;
    }
  }

  return true;
};

// Method to increment download count
examMaterialSchema.methods.incrementDownload = function() {
  this.downloadCount += 1;
  this.lastDownloaded = new Date();
  return this.save();
};

// Static method to get materials for student
examMaterialSchema.statics.getForStudent = function(student, filters = {}) {
  const query = {
    isActive: true,
    isLocked: false
  };

  // Add filters
  if (filters.subject) {
    query.subject = filters.subject;
  }
  if (filters.grade) {
    query.grade = filters.grade;
  }
  if (filters.type) {
    query.type = filters.type;
  }
  if (filters.year) {
    query.year = filters.year;
  }

  return this.find(query).sort({ createdAt: -1 });
};

module.exports = mongoose.model('ExamMaterial', examMaterialSchema);
