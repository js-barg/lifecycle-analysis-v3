// backend/src/controllers/phase3Controller.js

const { v4: uuidv4 } = require('uuid');
const db = require('../database/dbConnection');
const jobStorage = require('../utils/jobStorage');
const googleAIResearchService = require('../services/googleAIResearchService');
const generativeAIResearchService = require('../services/generativeAIResearchService');
const lifecycleAnalysisService = require('../services/lifecycleAnalysisService');
const phase3DataProcessor = require('../services/phase3DataProcessor');
const enhancedDateEstimation = require('../services/enhancedDateEstimation');

// SSE clients for progress updates
const sseClients = new Map();

// Store latest progress for new SSE connections
const latestProgress = {};

// ============================================================================
// HELPER: Parse JSONB from PostgreSQL
// PostgreSQL returns JSONB as objects in node-pg, but handle string case too
// ============================================================================
const parseJsonb = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (e) {
      console.error('Failed to parse JSONB string:', e.message);
      return null;
    }
  }
  // Already a parsed object (node-pg does this automatically for JSONB)
  return value;
};

// ============================================================================
// HELPER: Retrieve Phase 2 Job from Database
// This is the key function for Cloud Run compatibility
// ============================================================================
const getPhase2JobFromDatabase = async (phase2JobId) => {
  console.log('Attempting to retrieve Phase 2 job from database:', phase2JobId);
  
  try {
    // First, verify database connection
    const connTest = await db.query('SELECT NOW() as current_time');
    console.log('✅ Database connected:', connTest.rows[0].current_time);
    
    // Check if table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'phase2_jobs'
      ) as exists
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.error('❌ phase2_jobs table does not exist');
      return { 
        success: false, 
        error: 'phase2_jobs table not found',
        errorType: 'TABLE_MISSING',
        suggestion: 'Run migration: psql $DATABASE_URL -f phase2_jobs_migration.sql'
      };
    }
    
    console.log('✅ phase2_jobs table exists, querying for job...');
    
    // Query for the job
    const result = await db.query(`
      SELECT 
        job_id,
        customer_name,
        phase3_ready,
        phase3_ready_at,
        phase3_filter_name,
        phase3_filtered_items,
        phase3_stats,
        all_items,
        created_at,
        updated_at
      FROM phase2_jobs 
      WHERE job_id = $1
    `, [phase2JobId]);
    
    if (result.rows.length === 0) {
      console.error('❌ Job not found in database:', phase2JobId);
      return { 
        success: false, 
        error: 'Phase 2 job not found in database',
        errorType: 'JOB_NOT_FOUND'
      };
    }
    
    const dbJob = result.rows[0];
    console.log('✅ Found job in database');
    console.log('   customer_name:', dbJob.customer_name);
    console.log('   phase3_ready:', dbJob.phase3_ready);
    console.log('   phase3_filter_name:', dbJob.phase3_filter_name);
    console.log('   updated_at:', dbJob.updated_at);
    
    // Parse JSONB fields
    const phase3FilteredItems = parseJsonb(dbJob.phase3_filtered_items);
    const phase3Stats = parseJsonb(dbJob.phase3_stats);
    const allItems = parseJsonb(dbJob.all_items);
    
    console.log('   filtered items count:', phase3FilteredItems?.length || 0);
    console.log('   all items count:', allItems?.length || 0);
    
    // Reconstruct the phase2Job object in the expected format
    const phase2Job = {
      customerName: dbJob.customer_name,
      phase3Ready: dbJob.phase3_ready,
      phase3ReadyAt: dbJob.phase3_ready_at,
      phase3FilterName: dbJob.phase3_filter_name,
      phase3FilteredItems: phase3FilteredItems || [],
      phase3Stats: phase3Stats || {},
      items: allItems || []
    };
    
    return { success: true, job: phase2Job };
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    console.error('   Error code:', error.code);
    
    // Provide specific error messages based on error type
    if (error.code === 'ECONNREFUSED') {
      return {
        success: false,
        error: 'Database connection refused',
        errorType: 'CONNECTION_REFUSED',
        suggestion: 'Check DATABASE_URL environment variable'
      };
    }
    
    if (error.code === '42P01') { // Table does not exist
      return {
        success: false,
        error: 'phase2_jobs table does not exist',
        errorType: 'TABLE_MISSING',
        suggestion: 'Run migration: psql $DATABASE_URL -f phase2_jobs_migration.sql'
      };
    }
    
    return {
      success: false,
      error: error.message,
      errorType: 'DATABASE_ERROR',
      code: error.code
    };
  }
};

const phase3Controller = {
  // ============================================================================
  // INITIALIZE PHASE 3 - CLOUD RUN COMPATIBLE
  // ============================================================================
  async initializePhase3(req, res) {
    const { phase2JobId } = req.body;
    
    try {
      console.log('='.repeat(60));
      console.log('Phase 3 initialization request');
      console.log('  phase2JobId:', phase2JobId);
      console.log('  Environment:', process.env.NODE_ENV || 'development');
      console.log('  Cloud Run Revision:', process.env.K_REVISION || 'local');
      console.log('='.repeat(60));
      
      if (!phase2JobId) {
        return res.status(400).json({ error: 'Phase 2 job ID is required' });
      }
      
      let phase2Job = null;
      let dataSource = 'unknown';
      
      // STEP 1: Try in-memory storage first (works for same-instance requests)
      phase2Job = jobStorage.get(phase2JobId);
      
      if (phase2Job) {
        console.log('✅ Found Phase 2 job in memory');
        dataSource = 'memory';
      } else {
        // STEP 2: Retrieve from database (required for Cloud Run cross-instance)
        console.log('⚠️  Phase 2 job not in memory, checking database...');
        
        const dbResult = await getPhase2JobFromDatabase(phase2JobId);
        
        if (!dbResult.success) {
          console.error('❌ Failed to retrieve from database:', dbResult.error);
          
          // Return appropriate error based on type
          if (dbResult.errorType === 'TABLE_MISSING') {
            return res.status(500).json({
              error: 'Database not configured',
              details: dbResult.error,
              suggestion: dbResult.suggestion,
              migrationRequired: true
            });
          }
          
          if (dbResult.errorType === 'JOB_NOT_FOUND') {
            return res.status(404).json({
              error: 'Phase 2 job not found',
              details: 'The job may have expired or was never saved. Please complete Phase 2 again.',
              jobId: phase2JobId
            });
          }
          
          return res.status(500).json({
            error: 'Failed to retrieve Phase 2 job',
            details: dbResult.error,
            errorType: dbResult.errorType
          });
        }
        
        phase2Job = dbResult.job;
        dataSource = 'database';
        console.log('✅ Retrieved Phase 2 job from database');
      }
      
      // STEP 3: Validate the job is ready for Phase 3
      if (!phase2Job.phase3Ready) {
        console.error('❌ Phase 2 not marked as ready for Phase 3');
        return res.status(400).json({ 
          error: 'Phase 2 not ready',
          details: 'Please click "Ready for Phase 3" button in Phase 2 first.',
          phase3Ready: false
        });
      }
      
      // STEP 4: Get the items to process (filtered items if available, otherwise all)
      const itemsToProcess = phase2Job.phase3FilteredItems && phase2Job.phase3FilteredItems.length > 0
        ? phase2Job.phase3FilteredItems
        : phase2Job.items;
      
      if (!itemsToProcess || itemsToProcess.length === 0) {
        console.error('❌ No items to process');
        return res.status(400).json({
          error: 'No items to process',
          details: 'Phase 2 job has no items available for Phase 3 analysis'
        });
      }
      
      console.log(`Processing ${itemsToProcess.length} items`);
      console.log(`  Data source: ${dataSource}`);
      console.log(`  Filter applied: ${phase2Job.phase3FilterName || 'None'}`);
      if (phase2Job.phase3Stats) {
        console.log(`  Filter stats: ${phase2Job.phase3Stats.filtered}/${phase2Job.phase3Stats.original} items`);
      }
      
      // STEP 5: Create Phase 3 job
      const phase3JobId = uuidv4();
      const customerName = phase2Job.customerName || 'Unknown';
      
      // Insert Phase 3 job record
      await db.query(`
        INSERT INTO phase3_jobs (
          job_id, 
          phase2_job_id, 
          customer_name, 
          status, 
          product_count, 
          filter_name, 
          filtered_count, 
          original_count
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        phase3JobId,
        phase2JobId,
        customerName,
        'initialized',
        0,
        phase2Job.phase3FilterName || 'No filter',
        itemsToProcess.length,
        phase2Job.items?.length || itemsToProcess.length
      ]);
      
      console.log('✅ Phase 3 job created:', phase3JobId);
      
      // STEP 6: Extract unique products from filtered items
      const uniqueProducts = new Map();
      
      itemsToProcess.forEach(item => {
        const productId = (item.product_id || '').toUpperCase().trim();
        if (!productId || productId === '-') return;
        
        if (uniqueProducts.has(productId)) {
          const existing = uniqueProducts.get(productId);
          existing.total_quantity += parseInt(item.qty) || 0;
          
          // Preserve the earliest end_of_sale date if multiple exist
          if (item.end_of_sale && (!existing.end_of_sale_date || 
              new Date(item.end_of_sale) < new Date(existing.end_of_sale_date))) {
            existing.end_of_sale_date = item.end_of_sale;
          }
        } else {
          uniqueProducts.set(productId, {
            product_id: productId,
            description: item.description || '',
            manufacturer: item.mfg || '',
            product_category: item.category || item.asset_type || '',
            total_quantity: parseInt(item.qty) || 0,
            end_of_sale_date: item.end_of_sale || null,
            last_day_of_support_date: item.last_day_support || null,
            end_of_sw_maintenance_date: item.end_of_sw_support || null,
            end_of_sw_vulnerability_maintenance_date: item.end_of_sw_vulnerability || null
          });
        }
      });
      
      console.log(`Found ${uniqueProducts.size} unique products`);
      
      // Update job with product count
      await db.query(
        'UPDATE phase3_jobs SET product_count = $1, status = $2 WHERE job_id = $3',
        [uniqueProducts.size, 'ready', phase3JobId]
      );
      
      // Store products for processing
      const products = Array.from(uniqueProducts.values());
      
      // Insert products into phase3_products table
      for (const product of products) {
        try {
          await db.query(`
            INSERT INTO phase3_products (
              job_id, product_id, description, manufacturer, product_category,
              total_quantity, end_of_sale_date, last_day_of_support_date,
              end_of_sw_maintenance_date, end_of_sw_vulnerability_maintenance_date,
              research_status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (job_id, product_id) DO UPDATE SET
              description = EXCLUDED.description,
              manufacturer = EXCLUDED.manufacturer,
              total_quantity = EXCLUDED.total_quantity,
              updated_at = NOW()
          `, [
            phase3JobId,
            product.product_id,
            product.description,
            product.manufacturer,
            product.product_category,
            product.total_quantity,
            product.end_of_sale_date,
            product.last_day_of_support_date,
            product.end_of_sw_maintenance_date,
            product.end_of_sw_vulnerability_maintenance_date,
            'pending'
          ]);
        } catch (insertErr) {
          console.error(`Warning: Could not insert product ${product.product_id}:`, insertErr.message);
        }
      }
      
      // Return success response
      res.json({
        success: true,
        phase3JobId,
        phase2JobId,
        customerName,
        productCount: uniqueProducts.size,
        itemCount: itemsToProcess.length,
        filterApplied: phase2Job.phase3FilterName || null,
        filterStats: phase2Job.phase3Stats || null,
        dataSource,
        status: 'ready',
        message: `Phase 3 initialized with ${uniqueProducts.size} unique products from ${itemsToProcess.length} items`
      });
      
    } catch (error) {
      console.error('❌ Phase 3 initialization error:', error);
      res.status(500).json({
        error: 'Phase 3 initialization failed',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  },

  // ============================================================================
  // GET PHASE 3 STATUS
  // ============================================================================
  async getStatus(req, res) {
    const { jobId } = req.params;
    
    try {
      const result = await db.query(
        'SELECT * FROM phase3_jobs WHERE job_id = $1',
        [jobId]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Phase 3 job not found' });
      }
      
      const job = result.rows[0];
      
      // Get progress stats
      const progressResult = await db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE research_status = 'completed') as completed,
          COUNT(*) FILTER (WHERE research_status = 'failed') as failed,
          COUNT(*) FILTER (WHERE research_status = 'pending') as pending,
          COUNT(*) FILTER (WHERE research_status = 'processing') as processing
        FROM phase3_products 
        WHERE job_id = $1
      `, [jobId]);
      
      const progress = progressResult.rows[0];
      
      res.json({
        jobId: job.job_id,
        phase2JobId: job.phase2_job_id,
        customerName: job.customer_name,
        status: job.status,
        productCount: job.product_count,
        filterName: job.filter_name,
        filteredCount: job.filtered_count,
        originalCount: job.original_count,
        progress: {
          total: parseInt(progress.total),
          completed: parseInt(progress.completed),
          failed: parseInt(progress.failed),
          pending: parseInt(progress.pending),
          processing: parseInt(progress.processing),
          percentage: progress.total > 0 
            ? Math.round((parseInt(progress.completed) / parseInt(progress.total)) * 100) 
            : 0
        },
        createdAt: job.created_at,
        updatedAt: job.updated_at
      });
      
    } catch (error) {
      console.error('Error getting Phase 3 status:', error);
      res.status(500).json({ error: 'Failed to get status', details: error.message });
    }
  },

  // ============================================================================
  // START RESEARCH PROCESSING
  // ============================================================================
  async startResearch(req, res) {
    const { jobId } = req.params;
    
    try {
      // Verify job exists
      const jobResult = await db.query(
        'SELECT * FROM phase3_jobs WHERE job_id = $1',
        [jobId]
      );
      
      if (jobResult.rows.length === 0) {
        return res.status(404).json({ error: 'Phase 3 job not found' });
      }
      
      // Update job status
      await db.query(
        'UPDATE phase3_jobs SET status = $1, updated_at = NOW() WHERE job_id = $2',
        ['processing', jobId]
      );
      
      // Get products to research
      const productsResult = await db.query(`
        SELECT * FROM phase3_products 
        WHERE job_id = $1 AND research_status = 'pending'
        ORDER BY product_id
      `, [jobId]);
      
      console.log(`Starting research for ${productsResult.rows.length} products`);
      
      // Start async research (don't await - let it run in background)
      this.processResearchAsync(jobId, productsResult.rows);
      
      res.json({
        success: true,
        message: 'Research started',
        productsToProcess: productsResult.rows.length
      });
      
    } catch (error) {
      console.error('Error starting research:', error);
      res.status(500).json({ error: 'Failed to start research', details: error.message });
    }
  },

  // Async research processing (runs in background)
  async processResearchAsync(jobId, products) {
    console.log(`Processing ${products.length} products for job ${jobId}`);
    
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      
      try {
        // Update status to processing
        await db.query(
          'UPDATE phase3_products SET research_status = $1 WHERE job_id = $2 AND product_id = $3',
          ['processing', jobId, product.product_id]
        );
        
        // Broadcast progress via SSE
        this.broadcastProgress(jobId, {
          current: i + 1,
          total: products.length,
          productId: product.product_id,
          status: 'processing'
        });
        
        // Perform research (use your existing research services)
        let researchResult = null;
        
        try {
          // Try Google AI Research first
          if (googleAIResearchService && googleAIResearchService.researchProduct) {
            researchResult = await googleAIResearchService.researchProduct(product);
          }
        } catch (researchErr) {
          console.error(`Research failed for ${product.product_id}:`, researchErr.message);
        }
        
        // Update product with research results
        if (researchResult) {
          await db.query(`
            UPDATE phase3_products SET
              lifecycle_status = $1,
              risk_level = $2,
              overall_confidence = $3,
              ai_enhanced = $4,
              research_status = 'completed',
              updated_at = NOW()
            WHERE job_id = $5 AND product_id = $6
          `, [
            researchResult.lifecycleStatus || 'Unknown',
            researchResult.riskLevel || 'none',
            researchResult.confidence || 0,
            true,
            jobId,
            product.product_id
          ]);
        } else {
          // Mark as completed without enhancement
          await db.query(`
            UPDATE phase3_products SET
              research_status = 'completed',
              ai_enhanced = false,
              updated_at = NOW()
            WHERE job_id = $1 AND product_id = $2
          `, [jobId, product.product_id]);
        }
        
      } catch (error) {
        console.error(`Error processing product ${product.product_id}:`, error);
        
        // Mark as failed
        await db.query(`
          UPDATE phase3_products SET
            research_status = 'failed',
            updated_at = NOW()
          WHERE job_id = $1 AND product_id = $2
        `, [jobId, product.product_id]);
      }
      
      // Brief delay between products to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Mark job as completed
    await db.query(
      'UPDATE phase3_jobs SET status = $1, updated_at = NOW() WHERE job_id = $2',
      ['completed', jobId]
    );
    
    // Final progress broadcast
    this.broadcastProgress(jobId, {
      current: products.length,
      total: products.length,
      status: 'completed'
    });
    
    console.log(`Research completed for job ${jobId}`);
  },

  // Broadcast progress to SSE clients
  broadcastProgress(jobId, progress) {
    latestProgress[jobId] = progress;
    
    const clients = sseClients.get(jobId) || [];
    clients.forEach(client => {
      try {
        client.write(`data: ${JSON.stringify(progress)}\n\n`);
      } catch (e) {
        // Client disconnected
      }
    });
  },

  // SSE endpoint for progress updates
  async streamProgress(req, res) {
    const { jobId } = req.params;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    // Add client to list
    if (!sseClients.has(jobId)) {
      sseClients.set(jobId, []);
    }
    sseClients.get(jobId).push(res);
    
    // Send latest progress if available
    if (latestProgress[jobId]) {
      res.write(`data: ${JSON.stringify(latestProgress[jobId])}\n\n`);
    }
    
    // Cleanup on disconnect
    req.on('close', () => {
      const clients = sseClients.get(jobId) || [];
      const index = clients.indexOf(res);
      if (index > -1) {
        clients.splice(index, 1);
      }
    });
  },

  // ============================================================================
  // GET RESULTS
  // ============================================================================
  async getResults(req, res) {
    const { jobId } = req.params;
    
    try {
      // Get job info
      const jobResult = await db.query(
        'SELECT * FROM phase3_jobs WHERE job_id = $1',
        [jobId]
      );
      
      if (jobResult.rows.length === 0) {
        return res.status(404).json({ error: 'Phase 3 job not found' });
      }
      
      // Get products
      const productsResult = await db.query(`
        SELECT * FROM phase3_products 
        WHERE job_id = $1
        ORDER BY risk_level DESC, product_id
      `, [jobId]);
      
      const job = jobResult.rows[0];
      const products = phase3DataProcessor 
        ? phase3DataProcessor.processForReport(productsResult.rows)
        : productsResult.rows;
      
      res.json({
        jobId: job.job_id,
        customerName: job.customer_name,
        status: job.status,
        filterName: job.filter_name,
        filteredCount: job.filtered_count,
        originalCount: job.original_count,
        products,
        summary: {
          total: products.length,
          critical: products.filter(p => p.risk_level === 'critical').length,
          high: products.filter(p => p.risk_level === 'high').length,
          medium: products.filter(p => p.risk_level === 'medium').length,
          low: products.filter(p => p.risk_level === 'low').length,
          none: products.filter(p => p.risk_level === 'none' || !p.risk_level).length,
          aiEnhanced: products.filter(p => p.ai_enhanced).length
        }
      });
      
    } catch (error) {
      console.error('Error getting results:', error);
      res.status(500).json({ error: 'Failed to get results', details: error.message });
    }
  },

  // ============================================================================
  // DEBUG ENDPOINT - Check Phase 2 Job in Database
  // ============================================================================
  async debugPhase2Job(req, res) {
    const { phase2JobId } = req.params;
    
    try {
      const result = await getPhase2JobFromDatabase(phase2JobId);
      
      if (result.success) {
        res.json({
          found: true,
          job: {
            customerName: result.job.customerName,
            phase3Ready: result.job.phase3Ready,
            phase3FilterName: result.job.phase3FilterName,
            filteredItemsCount: result.job.phase3FilteredItems?.length || 0,
            allItemsCount: result.job.items?.length || 0,
            phase3Stats: result.job.phase3Stats
          }
        });
      } else {
        res.status(404).json({
          found: false,
          error: result.error,
          errorType: result.errorType,
          suggestion: result.suggestion
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Debug query failed',
        details: error.message
      });
    }
  }
};

module.exports = phase3Controller;