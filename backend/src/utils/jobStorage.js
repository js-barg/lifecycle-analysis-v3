// backend/src/utils/jobStorage.js

// In-memory storage for job data
// In production, replace with database storage
const jobs = new Map();

module.exports = {
  // Store a job
  set: (jobId, data) => {
    jobs.set(jobId, data);
    return true;
  },

  // Retrieve a job
  get: (jobId) => {
    return jobs.get(jobId) || null;
  },

  // Delete a job
  delete: (jobId) => {
    return jobs.delete(jobId);
  },

  // Check if job exists
  has: (jobId) => {
    return jobs.has(jobId);
  },

  // Get all jobs (for filter management)
  getAll: () => {
    return Array.from(jobs.values());
  },

  // Clear all jobs (for testing)
  clear: () => {
    jobs.clear();
  }
};