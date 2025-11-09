const { v4: uuidv4 } = require('uuid');
const db = require('../database/dbConnection');
const jobStorage = require('../utils/jobStorage');
const googleAIResearchService = require('../services/googleAIResearchService');
const lifecycleAnalysisService = require('../services/lifecycleAnalysisService');
const phase3DataProcessor = require('../services/phase3DataProcessor');
const enhancedDateEstimation = require('../services/enhancedDateEstimation');

// SSE clients for progress updates
const sseClients = new Map();

// Store latest progress for new SSE connections
const latestProgress = {};

const phase3Controller = {
  async initializePhase3(req, res) {
    const { phase2JobId } = req.body;
    
    try {
      console.log('Phase 3 init request for Phase 2 job:', phase2JobId);
      
      // Verify Phase 2 job exists
      const phase2Job = jobStorage.get(phase2JobId);
      if (!phase2Job) {
        console.error('Phase 2 job not found:', phase2JobId);
        return res.status(404).json({ error: 'Phase 2 job not found' });
      }
      
      console.log('Phase 2 job found, phase3Ready:', phase2Job.phase3Ready);
      
      // Check if Phase 2 is marked as ready
      if (!phase2Job.phase3Ready) {
        console.error('Phase 2 not ready for Phase 3');
        return res.status(400).json({ 
          error: 'Phase 2 not marked as ready for Phase 3. Please click "Ready for Phase 3" button in Phase 2 first.' 
        });
      }
      
      // CRITICAL: Use filtered items, not all items
      const itemsToProcess = phase2Job.phase3FilteredItems || phase2Job.items;
      
      console.log(`Processing ${itemsToProcess.length} filtered items (from ${phase2Job.items.length} total)`);
      if (phase2Job.phase3FilterName) {
        console.log(`Filter applied: ${phase2Job.phase3FilterName}`);
      }
      
      const phase3JobId = uuidv4();
      const customerName = phase2Job.customerName || 'Unknown';
      
      // Create Phase 3 job record with filter context
      await db.query(
        `INSERT INTO phase3_jobs (job_id, phase2_job_id, customer_name, status, product_count, filter_name, filtered_count, original_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          phase3JobId, 
          phase2JobId, 
          customerName, 
          'initialized', 
          0,
          phase2Job.phase3FilterName || 'No filter',
          itemsToProcess.length,
          phase2Job.items.length
        ]
      );
      
      // Extract unique products from FILTERED items only
      const uniqueProducts = new Map();
      
      itemsToProcess.forEach(item => {  // â† Using filtered items here
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
  
  // Preserve other Phase 2 dates if they exist
  if (item.last_day_support && !existing.last_day_of_support_date) {
    existing.last_day_of_support_date = item.last_day_support;
  }
  if (item.end_of_sw_support && !existing.end_of_sw_maintenance_date) {
    existing.end_of_sw_maintenance_date = item.end_of_sw_support;
  }
  if (item.end_of_sw_vulnerability && !existing.end_of_sw_vulnerability_maintenance_date) {
    existing.end_of_sw_vulnerability_maintenance_date = item.end_of_sw_vulnerability;
  }
  // Also preserve date_introduced and end_of_life_date
  if (item.date_introduced && !existing.date_introduced) {
    existing.date_introduced = item.date_introduced;
  }
  if (item.end_of_life && !existing.end_of_life_date) {
    existing.end_of_life_date = item.end_of_life;
  }
} else {
  uniqueProducts.set(productId, {
    product_id: productId,
    manufacturer: item.mfg || item.manufacturer || null,
    product_category: item.category || null,
    product_type: item.type || null,
    description: item.description || null,
    total_quantity: parseInt(item.qty) || 0,
    job_id: phase3JobId,
    // PRESERVE PHASE 2 DATES
    end_of_sale_date: item.end_of_sale || null,
    last_day_of_support_date: item.last_day_support || null,
    end_of_sw_maintenance_date: item.end_of_sw_support || null,
    end_of_sw_vulnerability_maintenance_date: item.end_of_sw_vulnerability || null,
    date_introduced: item.date_introduced || null,
    end_of_life_date: item.end_of_life || null
  });
}
        
        // Store raw inventory for year distribution
        if (item.ship_date || item.purchase_date) {
          db.query(
            `INSERT INTO raw_inventory (job_id, product_id, quantity, ship_date, purchase_date)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              phase3JobId,
              productId,
              parseInt(item.qty) || 0,
              item.ship_date || null,
              item.purchase_date || item.ship_date || null
            ]
          ).catch(err => console.error('Raw inventory insert error:', err));
        }
      });
      
      // Insert unique products into phase3_analysis
      let insertedCount = 0;
      for (const [productId, product] of uniqueProducts) {
        try {
          await db.query(
  `INSERT INTO phase3_analysis 
   (job_id, product_id, manufacturer, product_category, product_type, description, 
    total_quantity, end_of_sale_date, last_day_of_support_date, 
    end_of_sw_maintenance_date, end_of_sw_vulnerability_maintenance_date)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
   ON CONFLICT (job_id, product_id) 
   DO UPDATE SET 
     total_quantity = phase3_analysis.total_quantity + EXCLUDED.total_quantity,
     -- Only update dates if they don't already exist
     end_of_sale_date = COALESCE(phase3_analysis.end_of_sale_date, EXCLUDED.end_of_sale_date),
     last_day_of_support_date = COALESCE(phase3_analysis.last_day_of_support_date, EXCLUDED.last_day_of_support_date),
     end_of_sw_maintenance_date = COALESCE(phase3_analysis.end_of_sw_maintenance_date, EXCLUDED.end_of_sw_maintenance_date),
     end_of_sw_vulnerability_maintenance_date = COALESCE(phase3_analysis.end_of_sw_vulnerability_maintenance_date, EXCLUDED.end_of_sw_vulnerability_maintenance_date),
     updated_at = NOW()`,
  [
    product.job_id,
    product.product_id,
    product.manufacturer,
    product.product_category,
    product.product_type,
    product.description,
    product.total_quantity,
    this.formatDateForDB(product.end_of_sale_date),
    this.formatDateForDB(product.last_day_of_support_date),
    this.formatDateForDB(product.end_of_sw_maintenance_date),
    this.formatDateForDB(product.end_of_sw_vulnerability_maintenance_date)
  ]
);
          insertedCount++;
        } catch (err) {
          console.error(`Failed to insert product ${productId}:`, err);
        }
      }
      
      // Update job with product count
      await db.query(
        `UPDATE phase3_jobs SET product_count = $1, status = 'ready' WHERE job_id = $2`,
        [insertedCount, phase3JobId]
      );
      
      console.log(`Phase 3 initialized with ${insertedCount} unique products from ${itemsToProcess.length} filtered items`);
      
      res.json({
        success: true,
        phase3JobId,
        productCount: insertedCount,
        customerName,
        filterApplied: phase2Job.phase3FilterName || 'None',
        filteredItems: itemsToProcess.length,
        originalItems: phase2Job.items.length
      });
      
    } catch (error) {
      console.error('Phase 3 initialization error:', error);
      res.status(500).json({ 
        error: 'Failed to initialize Phase 3',
        details: error.message 
      });
    }
  },
  


  // ENHANCED runAIResearch method with real-time updates
  async runAIResearch(req, res) {
    const { jobId, useCache = true } = req.body;  // ADD useCache parameter
    // ADD: Cache statistics tracking
    let cacheStats = {
      hits: 0,
      misses: 0,
      enabled: useCache,
      totalTime: 0,
      avgCacheTime: 0,
      avgFreshTime: 0
    };
    
    console.log(`Starting Phase 3 research for job: ${jobId}`);
    console.log(`Cache ${useCache ? 'ENABLED' : 'DISABLED'} for this research session`); // ADD this log
  
    const controller = this; // Store reference to controller for sendProgressUpdate
    
    try {
      console.log(`Starting Phase 3 AI research for job: ${jobId}`);
      
      
      // Fetch products from Phase 3 analysis
      const phase3Query = `
        SELECT 
          product_id,
          description,
          manufacturer,
          product_category,
          product_type,
          total_quantity
        FROM phase3_analysis
        WHERE job_id = $1
        ORDER BY total_quantity DESC
      `;
      
      const phase3Result = await db.query(phase3Query, [jobId]); // USE db NOT pool
      const products = phase3Result.rows;
      
      if (products.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No products found in Phase 3 analysis'
        });
      }
      
      console.log(`Found ${products.length} products to research`);
      
      // Update job status
      await db.query(
        `UPDATE phase3_jobs SET status = 'researching' WHERE job_id = $1`,
        [jobId]
      );
      
      const results = [];
      let successCount = 0;
      let failureCount = 0;
      let processedCount = 0;
      let datesFoundCount = 0; // NEW: Track products with dates found
      const updateHistory = []; // NEW: Track update history
      
      // IMPORTANT: Send initial progress with enhanced fields
      console.log('Sending initial progress update...');
      controller.sendProgressUpdate(jobId, {
        total: products.length,
        processed: 0,
        successful: 0,
        failed: 0,
        datesFound: 0, // NEW
        current: 0,
        currentProduct: 'Starting...',
        researchingProduct: null, // NEW
        message: `Starting research for ${products.length} products`,
        updateHistory: [] // NEW
      });
      
      // Process each product
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const productNumber = i + 1;
        
        // ENHANCED: Send update BEFORE researching with researchingProduct field
        console.log(`🔍 Starting research for ${product.product_id} (${productNumber}/${products.length})`);
        
        controller.sendProgressUpdate(jobId, {
          total: products.length,
          processed: processedCount,
          successful: successCount,
          failed: failureCount,
          datesFound: datesFoundCount,
          current: productNumber,
          currentProduct: product.product_id,
          researchingProduct: product.product_id, // NEW: Mark as currently researching
          message: `Researching ${product.product_id} (${productNumber} of ${products.length})`,
          updateHistory: [...updateHistory].slice(-5) // Keep last 5 updates
        });
        
    try {
            const startTime = Date.now();  // Track time
            
            // Perform AI research - with cache control
            let rawResearchResult;
            
            if (useCache) {
              // Use cached version
              rawResearchResult = await this.performResearchWithCache({
                product_id: product.product_id,
                manufacturer: product.manufacturer,
                description: product.description,
                product_category: product.product_category
              });
              
              // Update cache statistics
              if (rawResearchResult.fromCache) {
                cacheStats.hits++;
                console.log(`📦 Cache hit for ${product.product_id}`);
              } else {
                cacheStats.misses++;
                console.log(`🔍 Fresh research for ${product.product_id} (cache miss)`);
              }
            } else {
              // Skip cache entirely - go straight to AI research
              console.log(`🔍 Fresh research for ${product.product_id} (cache disabled)`);
              const googleAIResearchService = require('../services/googleAIResearchService');
              rawResearchResult = await googleAIResearchService.performResearch({
                product_id: product.product_id,
                manufacturer: product.manufacturer,
                description: product.description,
                product_category: product.product_category
              });
              cacheStats.misses++;  // Count as miss when cache disabled
            }
            
            // Track timing
            const researchTime = Date.now() - startTime;
            cacheStats.totalTime += researchTime;
            
            // Process the result
            const processedResults = phase3DataProcessor.processForReport([{
              ...product,
              ...rawResearchResult,
              job_id: jobId
            }]);
            
            const processedResult = processedResults[0];
            
            // Store the result using the fixed method
            const estimatedResult = enhancedDateEstimation.estimateMissingDates(processedResult);
            await controller.storePhase3Result(estimatedResult);
            
            results.push(processedResult);
            successCount++;
            processedCount++;
            
            // Count if dates were found
            const foundDates = {
              end_of_sale: !!processedResult.end_of_sale_date,
              end_of_sw_maintenance: !!processedResult.end_of_sw_maintenance_date,
              end_of_sw_vulnerability: !!processedResult.end_of_sw_vulnerability_maintenance_date,
              last_day_of_support: !!processedResult.last_day_of_support_date
            };
            
            const datesFoundForProduct = Object.values(foundDates).filter(v => v).length;
            if (datesFoundForProduct > 0) {
              datesFoundCount++;
            }
            
            console.log(`✅ Successfully researched ${product.product_id} - Found ${datesFoundForProduct} dates`);
            
            // Add to update history
            const updateEntry = {
              product_id: product.product_id,
              success: true,
              datesFound: datesFoundForProduct,
              timestamp: new Date().toISOString()
            };
            updateHistory.push(updateEntry);
            
            // Send success update with complete product data
            controller.sendProgressUpdate(jobId, {
              total: products.length,
              processed: processedCount,
              successful: successCount,
              failed: failureCount,
              datesFound: datesFoundCount,
              current: productNumber,
              currentProduct: product.product_id,
              researchingProduct: null,
              message: `Completed ${product.product_id} (${processedCount} done, ${datesFoundCount} with dates)`,
              updateHistory: [...updateHistory].slice(-5),
              // Include cache statistics
              cacheStats: {
                hits: cacheStats.hits,
                misses: cacheStats.misses,
                enabled: cacheStats.enabled,
                hitRate: cacheStats.hits > 0 ? 
                  Math.round((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100) : 0,
                avgTimeMs: processedCount > 0 ? Math.round(cacheStats.totalTime / processedCount) : 0
              },
              // Include the updated product data
              updatedProduct: {
                product_id: processedResult.product_id,
                end_of_sale_date: processedResult.end_of_sale_date,
                end_of_sw_maintenance_date: processedResult.end_of_sw_maintenance_date,
                end_of_sw_vulnerability_maintenance_date: processedResult.end_of_sw_vulnerability_maintenance_date,
                last_day_of_support_date: processedResult.last_day_of_support_date,
                end_of_life_date: processedResult.end_of_life_date,
                date_introduced: processedResult.date_introduced,
                lifecycle_status: processedResult.lifecycle_status,
                risk_level: processedResult.risk_level,
                ai_enhanced: true,
                overall_confidence: processedResult.overall_confidence,
                lifecycle_confidence: processedResult.lifecycle_confidence,
                requires_review: processedResult.requires_review,
                data_sources: processedResult.data_sources,
                foundDates: foundDates
              }
            });
            
          } catch (error) {
        // Error handling stays the same (line 441 onwards)
          console.error(`âŒ Failed to research ${product.product_id}:`, error.message);
          failureCount++;
          processedCount++;
          
          // Try to store failed result
          try {
            const failedResult = {
              ...product,
              job_id: jobId,
              overall_confidence: 0,
              lifecycle_confidence: 0,
              manufacturer_confidence: 0,
              category_confidence: 0,
              lifecycle_status: 'Unknown',
              risk_level: 'medium',
              requires_review: true,
              ai_enhanced: false,
              data_sources: { vendor_site: 0, third_party: 0, manual_entry: 0 }
            };
            
            await controller.storePhase3Result(failedResult);
          } catch (storeError) {
            console.error(`Failed to store error result for ${product.product_id}:`, storeError.message);
          }
          
          // NEW: Add to update history
          const updateEntry = {
            product_id: product.product_id,
            success: false,
            datesFound: 0,
            error: error.message,
            timestamp: new Date().toISOString()
          };
          updateHistory.push(updateEntry);
          
          // ENHANCED: Send failure update with failed product indicator
          controller.sendProgressUpdate(jobId, {
            total: products.length,
            processed: processedCount,
            successful: successCount,
            failed: failureCount,
            datesFound: datesFoundCount,
            current: productNumber,
            currentProduct: product.product_id,
            researchingProduct: null,
            message: `Failed ${product.product_id} - continuing...`,
            updateHistory: [...updateHistory].slice(-5),
            // NEW: Include failed product info
            failedProduct: {
              product_id: product.product_id,
              error: error.message
            }
          });
        }
      }
      
      // Calculate average confidence
      const avgConfidence = results.length > 0 
        ? Math.round(results.reduce((sum, r) => sum + (r.overall_confidence || 0), 0) / results.length)
        : 0;
      
      // Update job statistics - USE db NOT pool
      await db.query(
        `UPDATE phase3_jobs 
         SET status = 'research_complete',
             products_researched = $2,
             products_enhanced = $3,
             products_no_data_found = $4,
             avg_confidence_score = $5,
             completed_at = NOW()
         WHERE job_id = $1`,
        [jobId, products.length, successCount, failureCount, avgConfidence]
      );
      
      // ENHANCED: Send final progress with complete statistics
      controller.sendProgressUpdate(jobId, {
        total: products.length,
        processed: products.length,
        successful: successCount,
        failed: failureCount,
        datesFound: datesFoundCount,
        current: products.length,
        currentProduct: 'Complete',
        researchingProduct: null,
        message: `Research completed: ${successCount} successful, ${failureCount} failed, ${datesFoundCount} products with dates`,
        updateHistory: [...updateHistory].slice(-5),
        completed: true // NEW: Mark as completed
      });
      
      // ENHANCED: Ensure SSE message is flushed before continuing
      // Give SSE clients time to receive the completion message
      const clients = sseClients.get(jobId);
      if (clients && clients.size > 0) {
        console.log(`Flushing SSE completion message to ${clients.size} client(s)`);
        
        // Send a dedicated completion event
        const completionData = JSON.stringify({
          type: 'RESEARCH_COMPLETE',
          completed: true,
          total: products.length,
          processed: products.length,
          successful: successCount,
          failed: failureCount,
          datesFound: datesFoundCount,
          message: 'Research completed successfully'
        });
        
        // Send completion message to all clients
        clients.forEach(client => {
          try {
            client.write(`data: ${completionData}\n\n`);
            // Force flush if possible
            if (client.flush) client.flush();
          } catch (error) {
            console.error('Failed to send completion message:', error);
          }
        });
        
        // Add a small delay to ensure message delivery
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('SSE completion message sent and flushed');
      }

      // Update job status to completed in database
      try {
        await db.query(
          'UPDATE phase3_jobs SET status = $1, processed_products = $2, successful_products = $3, failed_products = $4, completed_at = NOW() WHERE job_id = $5',
          ['completed', processedCount, successCount, failureCount, jobId]
        );
        console.log(`Database updated: Job ${jobId} marked as completed`);
      } catch (updateError) {
        console.error('Failed to update job status:', updateError);
        // Don't fail the whole operation if status update fails
      }
      
      console.log(`✅ AI research completed for job ${jobId}`);
      console.log(`   Processed: ${processedCount}, Successful: ${successCount}, Failed: ${failureCount}`);
      console.log(`   Products with dates found: ${datesFoundCount}`);
      
      // ENHANCED: Add another small delay before sending HTTP response
      // This ensures SSE messages are delivered before the HTTP connection changes
      await new Promise(resolve => setTimeout(resolve, 200));
      
      res.json({
        success: true,
        message: 'AI research completed successfully',
        stats: {
          total: products.length,
          successful: successCount,
          failed: failureCount,
          datesFound: datesFoundCount,
          avgConfidence
        }
      });
      
    } catch (error) {
      console.error('AI research error:', error);
      
      // Update job status to failed - USE db NOT pool
      try {
        await db.query(
          `UPDATE phase3_jobs 
           SET status = 'research_failed',
               error_message = $2
           WHERE job_id = $1`,
          [jobId, error.message]
        );
      } catch (updateError) {
        console.error('Failed to update job status:', updateError);
      }
      
      res.status(500).json({
        success: false,
        error: 'AI research failed',
        details: error.message
      });
    }
  },

  async performResearchWithCache(product) {
  const aiResearchCache = require('../services/aiResearchCacheService');
  
  // Try cache first
  try {
    const cached = await aiResearchCache.getCachedResearch(
      product.manufacturer, 
      product.product_id
    );
    
    if (cached && !cached.isExpired) {
      console.log(`ðŸ“¦ Cache hit: ${product.product_id}`);
      return {
        ...product,
        date_introduced: cached.date_introduced,
        end_of_sale_date: cached.end_of_sale_date,
        end_of_sw_maintenance_date: cached.end_of_sw_maintenance_date,
        end_of_sw_vulnerability_maintenance_date: cached.end_of_sw_vulnerability_maintenance_date,
        last_day_of_support_date: cached.last_day_of_support_date,
        dates_found: 1,
        data_sources: cached.data_sources,
        overall_confidence: (cached.confidence_score || 90) + 2,
        fromCache: true  // Mark as from cache
      };
    }
  } catch(e) { /* ignore cache errors */ }
  
  // No cache - normal research
  const result = await googleAIResearchService.performResearch(product);
  
  // Save to cache
  if (result?.dates_found > 0) {
    aiResearchCache.saveToCache({...result, ...product}).catch(e => {});
  }
  
  return {
    ...result,
    fromCache: false  // Mark as fresh
  };
},
  
  // Internal method for isolated product research
  async runAIResearchInternal(products, jobId) {
    console.log(`ðŸš€ Starting AI research for ${products.length} products in job ${jobId}`);
    
    const results = [];
    let processedCount = 0;
    let successCount = 0;
    let failureCount = 0;
    let datesFoundCount = 0;
    const updateHistory = [];
    
    // Send initial progress
    this.sendProgressUpdate(jobId, {
      total: products.length,
      processed: 0,
      successful: 0,
      failed: 0,
      datesFound: 0,
      current: 0,
      currentProduct: 'Starting...',
      message: `Starting research for ${products.length} products`,
      updateHistory: []
    });
    
    // Process each product
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const productNumber = i + 1;
      
      // Send update before researching
      console.log(`ðŸ” Starting research for ${product.product_id} (${productNumber}/${products.length})`);
      
      this.sendProgressUpdate(jobId, {
        total: products.length,
        processed: processedCount,
        successful: successCount,
        failed: failureCount,
        datesFound: datesFoundCount,
        current: productNumber,
        currentProduct: product.product_id,
        researchingProduct: product.product_id,
        message: `Researching ${product.product_id} (${productNumber} of ${products.length})`,
        updateHistory: [...updateHistory].slice(-5)
      });
      
      try {
        // Perform AI research
        const rawResearchResult = await googleAIResearchService.performResearch({
          product_id: product.product_id,
          manufacturer: product.manufacturer,
          description: product.description,
          product_category: product.product_category
        });
        
        // Process the result
        const processedResults = phase3DataProcessor.processForReport([{
          ...product,
          ...rawResearchResult,
          job_id: jobId
        }]);
        const processedResult = processedResults[0];

        // Calculate missing dates for any product that has at least one date
if (processedResult.end_of_sale_date || processedResult.last_day_of_support_date) {
  
  // If we have LDOS but no EOS, calculate EOS (like MR74)
  if (processedResult.last_day_of_support_date && !processedResult.end_of_sale_date) {
    const ldos = new Date(processedResult.last_day_of_support_date);
    const eos = new Date(ldos);
    eos.setFullYear(eos.getFullYear() - 5);
    processedResult.end_of_sale_date = eos.toISOString().split('T')[0];
    console.log(`ðŸ“… Calculated EOS from LDOS: ${processedResult.end_of_sale_date}`);
  }
  
  // If we have EOS, calculate other missing dates
  if (processedResult.end_of_sale_date) {
    const eos = new Date(processedResult.end_of_sale_date);
    
    if (!processedResult.end_of_sw_maintenance_date) {
      const swMaint = new Date(eos);
      swMaint.setFullYear(swMaint.getFullYear() + 3);
      processedResult.end_of_sw_maintenance_date = swMaint.toISOString().split('T')[0];
    }
    
    if (!processedResult.end_of_sw_vulnerability_maintenance_date) {
      const swVuln = new Date(eos);
      swVuln.setFullYear(swVuln.getFullYear() + 4);
      processedResult.end_of_sw_vulnerability_maintenance_date = swVuln.toISOString().split('T')[0];
      processedResult.lifecycle_confidence = Math.max(processedResult.lifecycle_confidence || 0, 85);
    }
    
    if (!processedResult.last_day_of_support_date) {
      const ldos = new Date(eos);
      ldos.setFullYear(ldos.getFullYear() + 5);
      processedResult.last_day_of_support_date = ldos.toISOString().split('T')[0];
    }
  }
  
  console.log(`ðŸ“Š Dates after calculation: EOS=${processedResult.end_of_sale_date}, LDOS=${processedResult.last_day_of_support_date}`);
}
        
        // Store the result
        await this.storePhase3Result(processedResult);
        
        results.push(processedResult);
        successCount++;
        processedCount++;
        
        // Count dates found
        const foundDates = {
          end_of_sale: !!processedResult.end_of_sale_date,
          end_of_sw_maintenance: !!processedResult.end_of_sw_maintenance_date,
          end_of_sw_vulnerability: !!processedResult.end_of_sw_vulnerability_maintenance_date,
          last_day_of_support: !!processedResult.last_day_of_support_date
        };
        
        const datesFoundForProduct = Object.values(foundDates).filter(v => v).length;
        if (datesFoundForProduct > 0) {
          datesFoundCount++;
        }
        
        console.log(`âœ… Successfully researched ${product.product_id} - Found ${datesFoundForProduct} dates`);
        
        // Update history
        updateHistory.push({
          product_id: product.product_id,
          success: true,
          datesFound: datesFoundForProduct,
          timestamp: new Date().toISOString()
        });
        
        // Send success update
        this.sendProgressUpdate(jobId, {
          total: products.length,
          processed: processedCount,
          successful: successCount,
          failed: failureCount,
          datesFound: datesFoundCount,
          current: productNumber,
          currentProduct: product.product_id,
          researchingProduct: null,
          message: `Completed ${product.product_id} (${processedCount} done, ${datesFoundCount} with dates)`,
          updateHistory: [...updateHistory].slice(-5),
          updatedProduct: {
            product_id: processedResult.product_id,
            end_of_sale_date: processedResult.end_of_sale_date,
            end_of_sw_maintenance_date: processedResult.end_of_sw_maintenance_date,
            end_of_sw_vulnerability_maintenance_date: processedResult.end_of_sw_vulnerability_maintenance_date,
            last_day_of_support_date: processedResult.last_day_of_support_date,
            end_of_life_date: processedResult.end_of_life_date,
            date_introduced: processedResult.date_introduced,
            lifecycle_status: processedResult.lifecycle_status,
            risk_level: processedResult.risk_level,
            ai_enhanced: true,
            overall_confidence: processedResult.overall_confidence,
            lifecycle_confidence: processedResult.lifecycle_confidence,
            requires_review: processedResult.requires_review,
            data_sources: processedResult.data_sources,
            foundDates: foundDates
          }
        });
        
      } catch (error) {
        console.error(`âŒ Failed to research ${product.product_id}:`, error.message);
        failureCount++;
        processedCount++;
        
        // Try to store failed result
        try {
          const failedResult = {
            ...product,
            job_id: jobId,
            overall_confidence: 0,
            lifecycle_confidence: 0,
            manufacturer_confidence: 0,
            category_confidence: 0,
            lifecycle_status: 'Unknown',
            risk_level: 'medium',
            requires_review: true,
            ai_enhanced: false,
            data_sources: { vendor_site: 0, third_party: 0, manual_entry: 0 }
          };
          
          await this.storePhase3Result(failedResult);
        } catch (storeError) {
          console.error(`Failed to store error result for ${product.product_id}:`, storeError.message);
        }
        
        // Update history
        updateHistory.push({
          product_id: product.product_id,
          success: false,
          datesFound: 0,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        // Send failure update
        this.sendProgressUpdate(jobId, {
          total: products.length,
          processed: processedCount,
          successful: successCount,
          failed: failureCount,
          datesFound: datesFoundCount,
          current: productNumber,
          currentProduct: product.product_id,
          researchingProduct: null,
          message: `Failed ${product.product_id} - continuing...`,
          updateHistory: [...updateHistory].slice(-5),
          failedProduct: {
            product_id: product.product_id,
            error: error.message
          }
        });
      }
    }
    
    // Send final completion update
    this.sendProgressUpdate(jobId, {
      total: products.length,
      processed: processedCount,
      successful: successCount,
      failed: failureCount,
      datesFound: datesFoundCount,
      current: products.length,
      currentProduct: 'Complete',
      researchingProduct: null,
      message: `Research completed: ${successCount} successful, ${failureCount} failed, ${datesFoundCount} products with dates`,
      updateHistory: [...updateHistory].slice(-5),
      completed: true
    });
    
    console.log(`âœ… AI research completed for job ${jobId}`);
    console.log(`   Processed: ${processedCount}, Successful: ${successCount}, Failed: ${failureCount}`);
    console.log(`   Products with dates found: ${datesFoundCount}`);
    
    return results;
  },

  // Store Phase 3 result in database
  async storePhase3Result(result) {
    const query = `
      INSERT INTO phase3_analysis (
        -- Core identifiers
        job_id,
        product_id,
        
        -- Product information
        description,
        manufacturer,
        product_category,
        total_quantity,
        total_value,
        
        -- Lifecycle dates
        end_of_sale_date,
        end_of_sw_maintenance_date,
        end_of_life_date,
        last_day_of_support_date,
        end_of_sw_vulnerability_maintenance_date,
        date_introduced,
        
        -- Status fields
        lifecycle_status,
        risk_level,
        is_current_product,
        
        -- Confidence scores
        overall_confidence,
        lifecycle_confidence,
        manufacturer_confidence,
        category_confidence,
        
        -- Phase 3 flags
        ai_enhanced,
        requires_review,
        
        -- Data sources
        data_sources,
        
        -- Timestamps
        created_at,
        updated_at
      ) VALUES (
        -- Values placeholders
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW(), NOW()
      )
      ON CONFLICT (job_id, product_id) 
      DO UPDATE SET
        description = EXCLUDED.description,
        manufacturer = EXCLUDED.manufacturer,
        product_category = EXCLUDED.product_category,
        total_quantity = EXCLUDED.total_quantity,
        total_value = EXCLUDED.total_value,
        -- Only update dates if AI enhancement was successful AND new date exists
        -- Otherwise preserve existing date from Phase 2
        end_of_sale_date = CASE 
          WHEN EXCLUDED.ai_enhanced = true AND EXCLUDED.end_of_sale_date IS NOT NULL 
          THEN EXCLUDED.end_of_sale_date 
          ELSE phase3_analysis.end_of_sale_date 
        END,
        end_of_sw_maintenance_date = CASE 
          WHEN EXCLUDED.ai_enhanced = true AND EXCLUDED.end_of_sw_maintenance_date IS NOT NULL 
          THEN EXCLUDED.end_of_sw_maintenance_date 
          ELSE phase3_analysis.end_of_sw_maintenance_date 
        END,
        end_of_life_date = CASE 
          WHEN EXCLUDED.ai_enhanced = true AND EXCLUDED.end_of_life_date IS NOT NULL 
          THEN EXCLUDED.end_of_life_date 
          ELSE phase3_analysis.end_of_life_date 
        END,
        last_day_of_support_date = CASE 
          WHEN EXCLUDED.ai_enhanced = true AND EXCLUDED.last_day_of_support_date IS NOT NULL 
          THEN EXCLUDED.last_day_of_support_date 
          ELSE phase3_analysis.last_day_of_support_date 
        END,
        end_of_sw_vulnerability_maintenance_date = CASE 
          WHEN EXCLUDED.ai_enhanced = true AND EXCLUDED.end_of_sw_vulnerability_maintenance_date IS NOT NULL 
          THEN EXCLUDED.end_of_sw_vulnerability_maintenance_date 
          ELSE phase3_analysis.end_of_sw_vulnerability_maintenance_date 
        END,
        date_introduced = CASE 
          WHEN EXCLUDED.ai_enhanced = true AND EXCLUDED.date_introduced IS NOT NULL 
          THEN EXCLUDED.date_introduced 
          ELSE phase3_analysis.date_introduced 
        END,
        lifecycle_status = EXCLUDED.lifecycle_status,
        risk_level = EXCLUDED.risk_level,
        is_current_product = EXCLUDED.is_current_product,
        overall_confidence = EXCLUDED.overall_confidence,
        lifecycle_confidence = EXCLUDED.lifecycle_confidence,
        ai_enhanced = EXCLUDED.ai_enhanced,
        requires_review = EXCLUDED.requires_review,
        data_sources = EXCLUDED.data_sources,
        updated_at = NOW()
    `;
    
    // Prepare the values array
    const values = [
      // $1-$3: Core identifiers
      result.job_id,
      result.product_id,
      
      // $4-$8: Product information
      result.description || '',
      result.manufacturer || '',
      result.product_category || 'Uncategorized',
      result.total_quantity || 0,
      result.total_value || 0,
      
      // $9-$14: Lifecycle dates (handle various date formats)
      this.formatDateForDB(result.end_of_sale_date),
      this.formatDateForDB(result.end_of_sw_maintenance_date),
      this.formatDateForDB(result.end_of_life_date || result.last_day_of_support_date), // EOL often equals LDOS
      this.formatDateForDB(result.last_day_of_support_date || result.last_day_support_date), // Handle both field names
      this.formatDateForDB(result.end_of_sw_vulnerability_maintenance_date),
      this.formatDateForDB(result.date_introduced),
      
      // $15-$17: Status fields
      result.lifecycle_status || 'Unknown',
      result.risk_level || 'none',
      result.is_current_product === true,
      
      // $17-$20: Confidence scores
      parseFloat(result.overall_confidence) || 0,
      parseFloat(result.lifecycle_confidence) || 0,
      parseFloat(result.manufacturer_confidence) || 0,
      parseFloat(result.category_confidence) || 0,
      
      // $21-$22: Phase 3 flags
      result.ai_enhanced === true,
      result.requires_review === true,
      
      // $23: Data sources (handle both object and array formats)
      this.formatDataSourcesForDB(result.data_sources)
    ];
    
    try {
      await db.query(query, values);
      console.log(`âœ… Stored Phase 3 result for ${result.product_id}`);
    } catch (error) {
      console.error(`âŒ Failed to store Phase 3 result for ${result.product_id}:`, error.message);
      throw error;
    }
  },

  /**
   * Helper method: Format date for database
   */
  formatDateForDB(dateValue) {
    if (!dateValue) return null;
    
    try {
      // Handle various date formats
      if (typeof dateValue === 'string') {
        // Already in YYYY-MM-DD format
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
          return dateValue;
        }
        
        // Parse and format
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
        }
      }
      
      if (dateValue instanceof Date) {
        return dateValue.toISOString().split('T')[0];
      }
      
      return null;
    } catch (error) {
      console.error(`Date formatting error for ${dateValue}:`, error.message);
      return null;
    }
  },

  /**
   * Helper method: Format data sources for database
   */
  formatDataSourcesForDB(dataSources) {
    if (!dataSources) {
      return JSON.stringify({ vendor_site: 0, third_party: 0, manual_entry: 0 });
    }
    
    // If it's already a string, return it
    if (typeof dataSources === 'string') {
      return dataSources;
    }
    
    // If it's an array or object, stringify it
    try {
      return JSON.stringify(dataSources);
    } catch (error) {
      console.error('Failed to stringify data sources:', error);
      return JSON.stringify({ vendor_site: 0, third_party: 0, manual_entry: 0 });
    }
  },

  
  // Get research progress via SSE
  getResearchProgress(req, res) {
    const { jobId } = req.params;
    
    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    
    // Store client
    if (!sseClients.has(jobId)) {
      sseClients.set(jobId, new Set());
    }
    sseClients.get(jobId).add(res);
    
    // Send initial status or latest progress if available
    const initialData = latestProgress[jobId] || { 
      total: 0, 
      processed: 0, 
      successful: 0, 
      failed: 0,
      datesFound: 0,
      current: 0,
      currentProduct: 'Waiting...',
      updateHistory: []
    };
    
    res.write(`data: ${JSON.stringify(initialData)}\n\n`);
    
    // Clean up on disconnect
    req.on('close', () => {
      const clients = sseClients.get(jobId);
      if (clients) {
        clients.delete(res);
        if (clients.size === 0) {
          sseClients.delete(jobId);
          delete latestProgress[jobId]; // Clean up stored progress
        }
      }
    });
  },
  
  // ENHANCED: Send progress update to SSE clients
// PURPOSE: Add explicit flushing capability

  sendProgressUpdate(jobId, progress) {
    const clients = sseClients.get(jobId);
    
    // Store latest progress for new connections
    latestProgress[jobId] = progress;
    
    // Log to console so you can see progress even if SSE isn't working
    console.log(`📊 Progress: ${progress.message || `${progress.processed}/${progress.total}`}`);
    
    if (!clients || clients.size === 0) {
      console.log('No SSE clients connected for job:', jobId);
      return;
    }
    
    const data = JSON.stringify(progress);
    clients.forEach(client => {
      try {
        client.write(`data: ${data}\n\n`);
        // ENHANCED: Attempt to flush the stream if the method exists
        if (client.flush && typeof client.flush === 'function') {
          client.flush();
        }
      } catch (error) {
        console.error('Failed to send SSE update:', error);
      }
    });
    
    // ENHANCED: Log when sending completion
    if (progress.completed) {
      console.log(`📍 COMPLETION MESSAGE SENT via SSE for job ${jobId}`);
    }
  },
  
  // NEW: Send immediate date update notification
  sendDateUpdateNotification(jobId, productId, dates) {
    const clients = sseClients.get(jobId) || [];
    const message = JSON.stringify({
      type: 'date_update',
      product_id: productId,
      dates: dates,
      timestamp: new Date().toISOString()
    });
    
    clients.forEach(client => {
      try {
        client.write(`data: ${message}\n\n`);
      } catch (error) {
        console.error(`Failed to send date update notification:`, error);
      }
    });
  },
  
  // Get Phase 3 results
  async getResults(req, res) {
    const { jobId } = req.params;
    
    try {
      // Get job info
      const jobResult = await db.query(
        `SELECT * FROM phase3_jobs WHERE job_id = $1`,
        [jobId]
      );
      
      if (jobResult.rows.length === 0) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      // Get analyzed products
      const productsResult = await db.query(
        `SELECT * FROM phase3_analysis 
         WHERE job_id = $1 
         ORDER BY total_quantity DESC`,
        [jobId]
      );

      const processedProducts = phase3DataProcessor.processForReport(productsResult.rows);
      
      const stats = {
        totalProducts: productsResult.rows.length,
        aiEnhanced: productsResult.rows.filter(p => p.ai_enhanced).length,
        currentProducts: productsResult.rows.filter(p => p.is_current_product).length,
        avgConfidence: Math.round(
          productsResult.rows.reduce((sum, p) => sum + (p.overall_confidence || 0), 0) / 
          productsResult.rows.length
        ),
        datesFound: productsResult.rows.filter(p => 
          p.end_of_sale_date || 
          p.last_day_of_support_date || 
          p.end_of_sw_maintenance_date
        ).length
      };
      
      res.json({
        job: jobResult.rows[0],
        products: processedProducts,
        stats
      });
      
    } catch (error) {
      console.error('Get results error:', error);
      res.status(500).json({
        error: 'Failed to get results',
        details: error.message
      });
    }
  },

  // Simple export of Phase 3 results to Excel
  async exportPhase3Results(req, res) {
    const { jobId } = req.body;
    const ExcelJS = require('exceljs');
    
    try {
      // Get Phase 3 results from database - same as getResults endpoint
      const productsResult = await db.query(
        `SELECT * FROM phase3_analysis 
         WHERE job_id = $1 
         ORDER BY total_quantity DESC`,
        [jobId]
      );
      
      if (productsResult.rows.length === 0) {
        return res.status(404).json({ error: 'No Phase 3 results found' });
      }
      
      // Process products same way as getResults does (if phase3DataProcessor is available)
      const products = phase3DataProcessor ? 
        phase3DataProcessor.processForReport(productsResult.rows) : 
        productsResult.rows;
      
      // Create workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Phase 3 Results');
      
      // Define columns - exactly matching the frontend display
      const columns = [
        { header: 'Product ID', key: 'product_id', width: 20 },
        { header: 'Description', key: 'description', width: 40 },
        { header: 'Manufacturer', key: 'manufacturer', width: 20 },
        { header: 'Category', key: 'product_category', width: 25 },
        { header: 'Qty', key: 'total_quantity', width: 10 },
        { header: 'Status', key: 'lifecycle_status', width: 15 },
        { header: 'Risk', key: 'risk_level', width: 12 },
        { header: 'End of Sale', key: 'end_of_sale_date', width: 15 },
        { header: 'End of SW Maint', key: 'end_of_sw_maintenance_date', width: 15 },
        { header: 'End of SW Vuln', key: 'end_of_sw_vulnerability_maintenance_date', width: 15 },
        { header: 'Last Day Support', key: 'last_day_of_support_date', width: 15 },
        { header: 'Confidence', key: 'overall_confidence', width: 12 },
        { header: 'AI Enhanced', key: 'ai_enhanced', width: 12 },
        { header: 'Product Family', key: 'product_family', width: 20 },
        { header: 'Support Coverage %', key: 'support_coverage_percentage', width: 18 },
        { header: 'Is Current', key: 'is_current_product', width: 10 },
        { header: 'Data Quality', key: 'data_quality_score', width: 12 }
      ];
      
      worksheet.columns = columns;
      
      // Style the header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF6B46C1' } // Purple color to match frontend
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 20;
      
      // Helper function to format dates
      const formatDate = (date) => {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit' 
        });
      };
      
      // Add data rows
      products.forEach(product => {
        const row = worksheet.addRow({
          product_id: product.product_id,
          description: product.description || '',
          manufacturer: product.manufacturer || '-',
          product_category: product.product_category || '-',
          total_quantity: product.total_quantity || 0,
          lifecycle_status: product.lifecycle_status || 'Unknown',
          risk_level: product.risk_level || 'none',
          end_of_sale_date: formatDate(product.end_of_sale_date),
          end_of_sw_maintenance_date: formatDate(product.end_of_sw_maintenance_date),
          end_of_sw_vulnerability_maintenance_date: formatDate(product.end_of_sw_vulnerability_maintenance_date),
          last_day_of_support_date: formatDate(product.last_day_of_support_date),
          overall_confidence: product.overall_confidence || 0,
          ai_enhanced: product.ai_enhanced ? 'Yes' : 'No',
          product_family: product.product_family || '',
          support_coverage_percentage: product.support_coverage_percentage || 0,
          is_current_product: product.is_current_product ? 'Yes' : 'No',
          data_quality_score: product.data_quality_score || 0
        });
        
        // Apply color coding based on risk level
        const riskCell = row.getCell('risk_level');
        if (product.risk_level === 'critical') {
          riskCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFEF4444' } // Red
          };
          riskCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        } else if (product.risk_level === 'high') {
          riskCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFBBF24' } // Yellow
          };
          riskCell.font = { bold: true };
        } else if (product.risk_level === 'medium') {
          riskCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFB923C' } // Orange
          };
        }
        
        // Color code lifecycle status
        const statusCell = row.getCell('lifecycle_status');
        if (product.lifecycle_status === 'EOL') {
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFEF4444' } // Red
          };
          statusCell.font = { color: { argb: 'FFFFFFFF' } };
        } else if (product.lifecycle_status === 'Approaching EOL') {
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFBBF24' } // Yellow
          };
        } else if (product.lifecycle_status === 'Current') {
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF10B981' } // Green
          };
          statusCell.font = { color: { argb: 'FFFFFFFF' } };
        }
        
        // Highlight high confidence scores
        const confidenceCell = row.getCell('overall_confidence');
        if (product.overall_confidence >= 80) {
          confidenceCell.font = { color: { argb: 'FF10B981' }, bold: true }; // Green
        } else if (product.overall_confidence >= 60) {
          confidenceCell.font = { color: { argb: 'FFFB923C' }, bold: true }; // Orange
        } else if (product.overall_confidence < 60) {
          confidenceCell.font = { color: { argb: 'FFEF4444' }, bold: true }; // Red
        }
        
        // Highlight AI enhanced products
        if (product.ai_enhanced) {
          row.getCell('ai_enhanced').font = { color: { argb: 'FF6B46C1' }, bold: true }; // Purple
        }
      });
      
      // Add borders to all cells
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });
      
      // Freeze the header row
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];
      
      // Add autofilter
      worksheet.autoFilter = {
        from: 'A1',
        to: `Q${products.length + 1}`
      };
      
      // Generate filename
      const filename = `phase3_results_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Send file
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      await workbook.xlsx.write(res);
      res.end();
      
    } catch (error) {
      console.error('Phase 3 export error:', error);
      res.status(500).json({
        error: 'Failed to export Phase 3 results',
        details: error.message
      });
    }
  }

};

module.exports = phase3Controller;