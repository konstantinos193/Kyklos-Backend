const mongoose = require('mongoose');

const teacherPermissionSchema = new mongoose.Schema({
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  teacherName: {
    type: String,
    required: true
  },
  examMaterial: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamMaterial',
    required: true
  },
  permissionType: {
    type: String,
    enum: ['view', 'download', 'manage', 'full'],
    default: 'view'
  },
  grantedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  grantedByName: {
    type: String,
    required: true
  },
  grantedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: null // null means no expiration
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    maxlength: 500
  },
  accessLog: [{
    action: {
      type: String,
      enum: ['view', 'download', 'grant', 'revoke', 'modify'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: String
  }]
}, {
  timestamps: true
});

// Indexes for better performance
teacherPermissionSchema.index({ teacher: 1, examMaterial: 1 });
teacherPermissionSchema.index({ examMaterial: 1, isActive: 1 });
teacherPermissionSchema.index({ teacher: 1, isActive: 1 });
teacherPermissionSchema.index({ expiresAt: 1 });

// Method to check if permission is valid
teacherPermissionSchema.methods.isValid = function() {
  if (!this.isActive) {
    return false;
  }
  
  if (this.expiresAt && new Date() > this.expiresAt) {
    return false;
  }
  
  return true;
};

// Method to log access
teacherPermissionSchema.methods.logAccess = function(action, details = '') {
  this.accessLog.push({
    action,
    details,
    timestamp: new Date()
  });
  
  // Keep only last 50 log entries
  if (this.accessLog.length > 50) {
    this.accessLog = this.accessLog.slice(-50);
  }
  
  return this.save();
};

// Static method to get permissions for teacher
teacherPermissionSchema.statics.getForTeacher = function(teacherId, filters = {}) {
  const query = {
    teacher: teacherId,
    isActive: true,
    ...filters
  };
  
  return this.find(query)
    .populate('examMaterial', 'title subject grade year type accessLevel')
    .populate('grantedBy', 'name email')
    .sort({ createdAt: -1 });
};

// Static method to get permissions for exam material
teacherPermissionSchema.statics.getForExamMaterial = function(examMaterialId) {
  return this.find({
    examMaterial: examMaterialId,
    isActive: true
  })
  .populate('teacher', 'name email')
  .populate('grantedBy', 'name email')
  .sort({ createdAt: -1 });
};

// Static method to check if teacher has permission
teacherPermissionSchema.statics.hasPermission = async function(teacherId, examMaterialId, action) {
  const permission = await this.findOne({
    teacher: teacherId,
    examMaterial: examMaterialId,
    isActive: true
  });
  
  if (!permission || !permission.isValid()) {
    return false;
  }
  
  // Check permission level
  const permissionLevels = {
    'view': 1,
    'download': 2,
    'manage': 3,
    'full': 4
  };
  
  const requiredLevel = permissionLevels[action] || 1;
  const userLevel = permissionLevels[permission.permissionType] || 0;
  
  return userLevel >= requiredLevel;
};

module.exports = mongoose.model('TeacherPermission', teacherPermissionSchema);
