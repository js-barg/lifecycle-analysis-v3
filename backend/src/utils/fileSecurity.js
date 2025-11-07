const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('../config/logger');

/**
 * Security checks for uploaded files
 */
class FileSecurity {
  
  /**
   * Validate file before processing
   */
  static async validateFile(filePath, originalName) {
    try {
      const stats = await fs.stat(filePath);
      
      // Check file size
      const maxSize = (parseInt(process.env.MAX_FILE_SIZE_MB) || 50) * 1024 * 1024;
      if (stats.size > maxSize) {
        throw new Error(`File size exceeds limit of ${process.env.MAX_FILE_SIZE_MB}MB`);
      }
      
      // Check file extension
      const ext = path.extname(originalName).toLowerCase();
      const allowedExtensions = (process.env.ALLOWED_FILE_TYPES || '.xlsx,.xls,.xlsb,.csv').split(',');
      
      if (!allowedExtensions.includes(ext)) {
        throw new Error(`File type ${ext} not allowed. Allowed types: ${allowedExtensions.join(', ')}`);
      }
      
      // Check for suspicious patterns in filename
      const suspiciousPatterns = [
        /\.\./,  // Directory traversal
        /[<>:"|?*]/,  // Invalid characters
        /^\./, // Hidden files
        /\0/,  // Null bytes
      ];
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(originalName)) {
          throw new Error('Filename contains invalid characters');
        }
      }
      
      // Validate file is readable
      await fs.access(filePath, fs.constants.R_OK);
      
      // Check actual file type by reading first bytes (magic numbers)
      const fileBuffer = await fs.readFile(filePath, { encoding: null, flag: 'r' });
      const fileSignature = fileBuffer.toString('hex', 0, 8).toUpperCase();
      
      // Common file signatures
      const signatures = {
        'xlsx': ['504B0304', '504B0506', '504B0708'], // ZIP-based format
        'xls': ['D0CF11E0A1B11AE1'], // OLE2 format
        'csv': null // Text file, no specific signature
      };
      
      if (ext !== '.csv') {
        let validSignature = false;
        const expectedSigs = signatures[ext.substring(1)] || signatures['xlsx'];
        
        for (const sig of expectedSigs) {
          if (fileSignature.startsWith(sig)) {
            validSignature = true;
            break;
          }
        }
        
        if (!validSignature && ext !== '.csv') {
          logger.warn(`File signature mismatch for ${originalName}. Expected Excel, got ${fileSignature}`);
          // Don't throw error, just log warning - some valid Excel files may have different signatures
        }
      }
      
      return true;
      
    } catch (error) {
      logger.error('File validation error:', error);
      throw error;
    }
  }
  
  /**
   * Generate secure filename with UUID
   */
  static generateSecureFilename(originalName) {
    const ext = path.extname(originalName).toLowerCase();
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(16).toString('hex');
    return `upload_${timestamp}_${randomBytes}${ext}`;
  }
  
  /**
   * Sanitize data from file to prevent injection attacks
   */
  static sanitizeData(data) {
    if (typeof data === 'string') {
      // Remove potential SQL injection patterns
      data = data.replace(/['";\\]/g, '');
      
      // Remove potential script tags
      data = data.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      
      // Limit string length
      if (data.length > 5000) {
        data = data.substring(0, 5000);
      }
    }
    
    return data;
  }
  
  /**
   * Sanitize entire row of data
   */
  static sanitizeRow(row) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(row)) {
      // Sanitize key
      const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '');
      
      // Sanitize value
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = this.sanitizeData(value);
      } else if (typeof value === 'number') {
        // Validate numbers are within reasonable ranges
        if (!isNaN(value) && isFinite(value)) {
          sanitized[sanitizedKey] = value;
        } else {
          sanitized[sanitizedKey] = 0;
        }
      } else if (value === null || value === undefined) {
        sanitized[sanitizedKey] = null;
      } else if (value instanceof Date) {
        sanitized[sanitizedKey] = value.toISOString().split('T')[0];
      } else {
        sanitized[sanitizedKey] = String(value).substring(0, 1000);
      }
    }
    
    return sanitized;
  }
  
  /**
   * Create quarantine directory for suspicious files
   */
  static async quarantineFile(filePath, reason) {
    try {
      const quarantineDir = path.join(process.env.UPLOAD_TEMP_DIR || './uploads', 'quarantine');
      await fs.mkdir(quarantineDir, { recursive: true });
      
      const filename = path.basename(filePath);
      const quarantinePath = path.join(quarantineDir, `QUARANTINE_${Date.now()}_${filename}`);
      
      await fs.rename(filePath, quarantinePath);
      
      logger.warn(`File quarantined: ${filename}, Reason: ${reason}`);
      
      // Create quarantine log
      const logEntry = {
        originalPath: filePath,
        quarantinePath,
        reason,
        timestamp: new Date().toISOString()
      };
      
      const logFile = path.join(quarantineDir, 'quarantine.log');
      await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');
      
      return quarantinePath;
      
    } catch (error) {
      logger.error('Failed to quarantine file:', error);
      // If quarantine fails, delete the file
      await fs.unlink(filePath).catch(() => {});
      throw error;
    }
  }
  
  /**
   * Clean up old uploaded files
   */
  static async cleanupOldFiles(uploadDir, maxAgeHours = 24) {
    try {
      const files = await fs.readdir(uploadDir);
      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000;
      
      for (const file of files) {
        if (file === 'quarantine') continue; // Skip quarantine directory
        
        const filePath = path.join(uploadDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
          logger.info(`Cleaned up old file: ${file}`);
        }
      }
    } catch (error) {
      logger.error('Cleanup error:', error);
    }
  }
}

module.exports = FileSecurity;