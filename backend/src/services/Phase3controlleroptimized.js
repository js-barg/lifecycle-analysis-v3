/**
 * Optimized Phase 3 Controller
 * Integrates optimized search and enhanced date estimation
 * 
 * Key improvements:
 * - Uses optimized search service for 60-70% faster research
 * - Applies comprehensive date estimation after research
 * - Tracks estimated vs found dates in metadata
 * - Updates confidence scores based on estimation
 */

const pool = require('../database/dbConnection');
const phase3DataProcessor = require('../services/phase3DataProcessor');
const enhancedDateEstimation = require('../services/enhancedDateEstimation');
const jobStorage = require('../services/jobStorage');

// Choose which search service to use based on configuration
const USE_OPTIMIZED_SEARCH = process.env.USE_OPTIMIZED_SEARCH !== 'false'; // Default to true
const searchService = USE_OPTIMIZED_SEARCH 
  ? require('../services/optimizedSearchService') 
  : require('../services/googleAIResearchService');

class OptimizedPhase3Controller {
  constructor() {
    this.activeJobs = new Map();
    console.log(`🚀 Phase 3 Controller initialized with ${USE_OPTIMIZED_SEARCH ? 'OPTIMIZED' : 'STANDARD'} search service`);
  }

  /**
   * Initialize Phase 3 with selected products from Phase 2
   */
  async initializePhase3(req, res) {
    const client = await pool.connect();
    
    try {
      const { jobId, selectedProductIds } = req.body;
      
      console.log(`Initializing Phase 3 for job ${jobId} with ${selectedProductIds.length} products`);
      
      // Get Phase 2 products
      const phase2Query = `
        SELECT * FROM phase2_analysis
        WHERE job_id = $1 AND product_id = ANY($2::text[])
      `;
      
      const phase2Result = await client.query(phase2Query, [jobId, selectedProductIds]);
      
      if (phase2Result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No products found in Phase 2 for the specified job'
        });
      }
      
      // Clear any existing Phase 3 data for this job
      await client.query('DELETE FROM phase3_analysis WHERE job_id = $1', [jobId]);
      
      // Initialize Phase 3 records
      const insertQuery = `
        INSERT INTO phase3_analysis (
          job_id, product_id, manufacturer, product_category, product_type,
          description, total_quantity, lifecycle_status, risk_level,
          is_current_product, ai_enhanced, requires_review
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `;
      
      for (const product of phase2Result.rows) {
        await client.query(insertQuery, [
          jobId,
          product.product_id,
          product.manufacturer,
          product.product_category,
          product.product_type,
          product.description,
          product.total_quantity,
          'Pending Research',
          'Unknown',
          false,
          false,
          true
        ]);
      }
      
      console.log(`Phase 3 initialized with ${phase2Result.rows.length} products`);
      
      res.json({
        success: true,
        message: 'Phase 3 initialized successfully',
        productCount: phase2Result.rows.length,
        products: phase2Result.rows
      });
      
    } catch (error) {
      console.error('Error initializing Phase 3:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to initialize Phase 3'
      });
    } finally {
      client.release();
    }
  }

  /**
   * Run optimized AI research with date estimation
   */
  async runAIResearch(req, res) {
    const controller = this;
    const { jobId } = req.body;
    const client = await pool.connect();
    
    try {
      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      
      // Send initial connection message
      res.write('data: {"status":"connected"}\n\n');
      
      // Store job state
      controller.activeJobs.set(jobId, {
        status: 'running',
        cancelled: false
      });
      
      // Get products for research
      const productsQuery = `
        SELECT * FROM phase3_analysis 
        WHERE job_id = $1 
        ORDER BY product_id
      `;
      
      const productsResult = await client.query(productsQuery, [jobId]);
      const products = productsResult.rows;
      
      console.log(`Starting AI research for ${products.length} products`);
      
      const results = [];
      let processedCount = 0;
      let successCount = 0;
      let datesFoundCount = 0;
      let estimatedDatesCount = 0;
      const updateHistory = [];
      
      // Process each product
      for (const product of products) {
        // Check if job was cancelled
        const jobState = controller.activeJobs.get(jobId);
        if (jobState && jobState.cancelled) {
          console.log(`Job ${jobId} cancelled by user`);
          res.write(`data: ${JSON.stringify({
            status: 'cancelled',
            message: 'Research cancelled by user'
          })}\n\n`);
          break;
        }
        
        processedCount++;
        
        // Send progress update - START of research
        res.write(`data: ${JSON.stringify({
          status: 'researching',
          total: products.length,
          processed: processedCount - 1,
          successful: successCount,
          failed: processedCount - 1 - successCount,
          datesFound: datesFoundCount,
          estimatedDates: estimatedDatesCount,
          current: processedCount,
          currentProduct: product.product_id,
          researchingProduct: product.product_id,
          message: `Researching ${product.product_id} (${processedCount} of ${products.length})`,
          updateHistory: [...updateHistory].slice(-5)
        })}\n\n`);
        
        try {
          // Perform AI research using the appropriate service
          const startTime = Date.now();
          const rawResearchResult = USE_OPTIMIZED_SEARCH 
            ? await searchService.performOptimizedResearch({
                product_id: product.product_id,
                manufacturer: product.manufacturer,
                description: product.description,
                product_category: product.product_category
              })
            : await searchService.performResearch({
                product_id: product.product_id,
                manufacturer: product.manufacturer,
                description: product.description,
                product_category: product.product_category
              });
          
          const researchTime = ((Date.now() - startTime) / 1000).toFixed(1);
          
          // Process the result
          const processedResults = phase3DataProcessor.processForReport([{
            ...product,
            ...rawResearchResult,
            job_id: jobId
          }]);
          let processedResult = processedResults[0];
          
          // NEW: Apply enhanced date estimation
          console.log(`\n📊 Applying date estimation for ${product.product_id}`);
          const estimatedResult = enhancedDateEstimation.estimateMissingDates(processedResult);
          
          // Update processed result with estimated data
          processedResult = estimatedResult;
          
          // Store the result with estimation metadata
          await controller.storePhase3Result(processedResult);
          
          results.push(processedResult);
          successCount++;
          
          // Count dates found and estimated
          const foundDates = {
            end_of_sale: !!rawResearchResult.end_of_sale_date,
            end_of_sw_maintenance: !!rawResearchResult.end_of_sw_maintenance_date,
            end_of_sw_vulnerability: !!rawResearchResult.end_of_sw_vulnerability_maintenance_date,
            last_day_of_support: !!rawResearchResult.last_day_of_support_date
          };
          
          const datesFoundForProduct = Object.values(foundDates).filter(v => v).length;
          if (datesFoundForProduct > 0) {
            datesFoundCount++;
          }
          
          // Count if estimation was applied
          if (processedResult.estimation_metadata && processedResult.estimation_metadata.estimated_dates_count > 0) {
            estimatedDatesCount++;
          }
          
          // Add to update history
          const updateInfo = {
            product_id: product.product_id,
            status: 'success',
            dates_found: datesFoundForProduct,
            dates_estimated: processedResult.estimation_metadata?.estimated_dates_count || 0,
            research_time: researchTime,
            timestamp: new Date().toISOString()
          };
          updateHistory.push(updateInfo);
          
          console.log(`✅ Successfully researched ${product.product_id}`);
          console.log(`   📅 Dates found: ${datesFoundForProduct}, Estimated: ${updateInfo.dates_estimated}`);
          console.log(`   ⏱️ Research time: ${researchTime}s`);
          
          // Send progress update with results
          res.write(`data: ${JSON.stringify({
            status: 'processing',
            total: products.length,
            processed: processedCount,
            successful: successCount,
            failed: processedCount - successCount,
            datesFound: datesFoundCount,
            estimatedDates: estimatedDatesCount,
            current: processedCount,
            currentProduct: product.product_id,
            message: `Completed ${product.product_id} (${processedCount} of ${products.length})`,
            updateHistory: [...updateHistory].slice(-5),
            updatedProduct: {
              product_id: processedResult.product_id,
              end_of_sale_date: processedResult.end_of_sale_date,
              end_of_sw_maintenance_date: processedResult.end_of_sw_maintenance_date,
              end_of_sw_vulnerability_maintenance_date: processedResult.end_of_sw_vulnerability_maintenance_date,
              last_day_of_support_date: processedResult.last_day_of_support_date,
              foundDates: foundDates,
              estimation_metadata: processedResult.estimation_metadata
            }
          })}\n\n`);
          
        } catch (error) {
          console.error(`Research failed for ${product.product_id}:`, error);
          
          // Store failed result
          await controller.storePhase3Result({
            ...product,
            ai_enhanced: false,
            requires_review: true,
            lifecycle_confidence: 0,
            overall_confidence: 0
          });
          
          // Add to update history
          updateHistory.push({
            product_id: product.product_id,
            status: 'failed',
            error: error.message,
            timestamp: new Date().toISOString()
          });
          
          // Send error update
          res.write(`data: ${JSON.stringify({
            status: 'processing',
            total: products.length,
            processed: processedCount,
            successful: successCount,
            failed: processedCount - successCount,
            datesFound: datesFoundCount,
            estimatedDates: estimatedDatesCount,
            current: processedCount,
            currentProduct: product.product_id,
            message: `Failed ${product.product_id} (${processedCount} of ${products.length})`,
            updateHistory: [...updateHistory].slice(-5),
            error: error.message
          })}\n\n`);
        }
      }
      
      // Calculate statistics
      const avgResearchTime = updateHistory
        .filter(u => u.research_time)
        .reduce((sum, u) => sum + parseFloat(u.research_time), 0) / successCount || 0;
      
      const totalEstimatedDates = results
        .filter(r => r.estimation_metadata?.estimated_dates_count > 0)
        .reduce((sum, r) => sum + r.estimation_metadata.estimated_dates_count, 0);
      
      // Send completion message
      res.write(`data: ${JSON.stringify({
        status: 'complete',
        total: products.length,
        processed: processedCount,
        successful: successCount,
        failed: processedCount - successCount,
        datesFound: datesFoundCount,
        estimatedDates: estimatedDatesCount,
        totalEstimatedDateFields: totalEstimatedDates,
        averageResearchTime: avgResearchTime.toFixed(1),
        optimizationUsed: USE_OPTIMIZED_SEARCH,
        message: `Research complete: ${successCount} successful, ${processedCount - successCount} failed`,
        results: results
      })}\n\n`);
      
      res.end();
      
      console.log('\n=== RESEARCH SUMMARY ===');
      console.log(`Total products: ${products.length}`);
      console.log(`Successful: ${successCount}`);
      console.log(`Failed: ${processedCount - successCount}`);
      console.log(`Products with found dates: ${datesFoundCount}`);
      console.log(`Products with estimated dates: ${estimatedDatesCount}`);
      console.log(`Total estimated date fields: ${totalEstimatedDates}`);
      console.log(`Average research time: ${avgResearchTime.toFixed(1)}s`);
      console.log(`Search optimization: ${USE_OPTIMIZED_SEARCH ? 'ENABLED' : 'DISABLED'}`);
      console.log('========================\n');
      
    } catch (error) {
      console.error('Error during AI research:', error);
      res.write(`data: ${JSON.stringify({
        status: 'error',
        error: error.message
      })}\n\n`);
      res.end();
    } finally {
      client.release();
      controller.activeJobs.delete(jobId);
    }
  }

  /**
   * Store Phase 3 result with estimation metadata
   */
  async storePhase3Result(product) {
    const client = await pool.connect();
    
    try {
      // Prepare the update query with estimation metadata
      const updateQuery = `
        UPDATE phase3_analysis SET
          manufacturer = $2,
          product_category = $3,
          product_type = $4,
          description = $5,
          date_introduced = $6,
          end_of_sale_date = $7,
          end_of_sw_maintenance_date = $8,
          end_of_sw_vulnerability_maintenance_date = $9,
          last_day_of_support_date = $10,
          end_of_life_date = $11,
          lifecycle_status = $12,
          risk_level = $13,
          is_current_product = $14,
          lifecycle_confidence = $15,
          overall_confidence = $16,
          ai_enhanced = $17,
          requires_review = $18,
          data_sources = $19,
          estimation_metadata = $20,
          last_updated = CURRENT_TIMESTAMP
        WHERE job_id = $21 AND product_id = $22
      `;
      
      const values = [
        product.job_id,
        product.manufacturer,
        product.product_category,
        product.product_type,
        product.description,
        product.date_introduced,
        product.end_of_sale_date,
        product.end_of_sw_maintenance_date,
        product.end_of_sw_vulnerability_maintenance_date,
        product.last_day_of_support_date,
        product.end_of_life_date || product.last_day_of_support_date,
        product.lifecycle_status,
        product.risk_level,
        product.is_current_product || false,
        product.lifecycle_confidence || 0,
        product.overall_confidence || 0,
        product.ai_enhanced !== false,
        product.requires_review || false,
        JSON.stringify(product.data_sources || {}),
        JSON.stringify(product.estimation_metadata || {}),
        product.job_id,
        product.product_id
      ];
      
      await client.query(updateQuery, values);
      
    } catch (error) {
      console.error('Error storing Phase 3 result:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get Phase 3 results with estimation metadata
   */
  async getPhase3Results(req, res) {
    const { jobId } = req.params;
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT 
          *,
          estimation_metadata::text as estimation_metadata_text,
          data_sources::text as data_sources_text
        FROM phase3_analysis 
        WHERE job_id = $1 
        ORDER BY product_id
      `;
      
      const result = await client.query(query, [jobId]);
      
      // Parse JSON fields
      const products = result.rows.map(row => ({
        ...row,
        estimation_metadata: row.estimation_metadata_text ? JSON.parse(row.estimation_metadata_text) : null,
        data_sources: row.data_sources_text ? JSON.parse(row.data_sources_text) : null
      }));
      
      // Calculate statistics
      const totalProducts = products.length;
      const productsWithDates = products.filter(p => 
        p.end_of_sale_date || p.last_day_of_support_date
      ).length;
      const productsWithEstimation = products.filter(p => 
        p.estimation_metadata?.estimated_dates_count > 0
      ).length;
      const totalEstimatedFields = products.reduce((sum, p) => 
        sum + (p.estimation_metadata?.estimated_dates_count || 0), 0
      );
      
      res.json({
        success: true,
        products: products,
        statistics: {
          total: totalProducts,
          withDates: productsWithDates,
          withEstimation: productsWithEstimation,
          totalEstimatedFields: totalEstimatedFields,
          completeness: totalProducts > 0 ? Math.round((productsWithDates / totalProducts) * 100) : 0
        }
      });
      
    } catch (error) {
      console.error('Error getting Phase 3 results:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve Phase 3 results'
      });
    } finally {
      client.release();
    }
  }

  /**
   * Export Phase 3 results to CSV with estimation indicators
   */
  async exportPhase3Results(req, res) {
    const { jobId } = req.params;
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT * FROM phase3_analysis 
        WHERE job_id = $1 
        ORDER BY product_id
      `;
      
      const result = await client.query(query, [jobId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No Phase 3 results found for this job'
        });
      }
      
      // Create CSV with estimation indicators
      const csvRows = ['Product ID,Manufacturer,Category,Type,Description,Date Introduced,End of Sale,End of SW Maintenance,End of SW Vulnerability,Last Day of Support,End of Life,Lifecycle Status,Risk Level,Current Product,AI Enhanced,Confidence,Estimation Used'];
      
      for (const product of result.rows) {
        const estimationData = product.estimation_metadata ? JSON.parse(product.estimation_metadata) : {};
        const hasEstimation = estimationData.estimated_dates_count > 0;
        
        csvRows.push([
          product.product_id,
          product.manufacturer || '',
          product.product_category || '',
          product.product_type || '',
          `"${(product.description || '').replace(/"/g, '""')}"`,
          product.date_introduced || '',
          product.end_of_sale_date || '',
          product.end_of_sw_maintenance_date || '',
          product.end_of_sw_vulnerability_maintenance_date || '',
          product.last_day_of_support_date || '',
          product.end_of_life_date || '',
          product.lifecycle_status || '',
          product.risk_level || '',
          product.is_current_product ? 'Yes' : 'No',
          product.ai_enhanced ? 'Yes' : 'No',
          `${product.lifecycle_confidence || 0}%`,
          hasEstimation ? 'Yes' : 'No'
        ].join(','));
      }
      
      const csv = csvRows.join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="phase3_results_${jobId}.csv"`);
      res.send(csv);
      
    } catch (error) {
      console.error('Error exporting Phase 3 results:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export Phase 3 results'
      });
    } finally {
      client.release();
    }
  }
}

module.exports = new OptimizedPhase3Controller();