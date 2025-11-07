// backend/src/utils/jobStorage.js

/**
 * Shared in-memory job storage for all phases
 * In production, this should be replaced with a database
 */
class JobStorage {
  constructor() {
    this.jobs = {};
    this.cleanupInterval = null;
    this.startCleanup();
  }

  // Store a job
  set(jobId, data) {
    this.jobs[jobId] = {
      ...data,
      timestamp: data.timestamp || new Date(),
      lastAccessed: new Date()
    };
    return this.jobs[jobId];
  }

  // Retrieve a job
  get(jobId) {
    if (this.jobs[jobId]) {
      this.jobs[jobId].lastAccessed = new Date();
      return this.jobs[jobId];
    }
    return null;
  }

  // Check if job exists
  has(jobId) {
    return jobId in this.jobs;
  }

  // Delete a job
  delete(jobId) {
    delete this.jobs[jobId];
  }

  // Get all jobs for a customer
  getByCustomer(customerName) {
    return Object.values(this.jobs).filter(
      job => job.customerName === customerName
    );
  }

  // Get Phase 1 job that corresponds to a Phase 2 job
  getPhase1ForPhase2(phase2JobId) {
    const phase2Job = this.get(phase2JobId);
    if (phase2Job && phase2Job.phase1Reference) {
      return this.get(phase2Job.phase1Reference);
    }
    return null;
  }

  // Clean up old jobs
  cleanup(maxAgeHours = 1) {
    const now = new Date();
    const maxAge = maxAgeHours * 60 * 60 * 1000;
    
    Object.keys(this.jobs).forEach(jobId => {
      const job = this.jobs[jobId];
      if (job.timestamp && (now - job.timestamp > maxAge)) {
        console.log(`Cleaning up old job: ${jobId}`);
        this.delete(jobId);
      }
    });
  }

  // Start automatic cleanup
  startCleanup(intervalMinutes = 30) {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, intervalMinutes * 60 * 1000);
  }

  // Stop automatic cleanup
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Get storage statistics
  getStats() {
    const jobs = Object.values(this.jobs);
    return {
      totalJobs: jobs.length,
      phase1Jobs: jobs.filter(j => j.data && !j.phase1Reference).length,
      phase2Jobs: jobs.filter(j => j.phase1Reference).length,
      oldestJob: jobs.reduce((oldest, job) => 
        (!oldest || job.timestamp < oldest.timestamp) ? job : oldest, null
      ),
      newestJob: jobs.reduce((newest, job) => 
        (!newest || job.timestamp > newest.timestamp) ? job : newest, null
      )
    };
  }
}

// Create singleton instance
const jobStorage = new JobStorage();

module.exports = jobStorage;