// lifecycleReportOrchestrator.js
// Main orchestrator for comprehensive lifecycle report generation

const db = require('../database/dbConnection');
const ExcelJS = require('exceljs');
const LifecycleStatisticsCalculator = require('./lifecycleStatisticsCalculator');
const LifecycleChartGenerator = require('./lifecycleChartGenerator');
const LifecycleExcelBuilder = require('./lifecycleExcelBuilder');
const { v4: uuidv4 } = require('uuid');

class LifecycleReportOrchestrator {
  constructor() {
    this.statsCalculator = new LifecycleStatisticsCalculator();
    this.chartGenerator = new LifecycleChartGenerator();
    this.excelBuilder = new LifecycleExcelBuilder();
    this.progressCallbacks = new Map();
  }

  /**
   * Generate unique report ID 
   */
  generateReportId() {

  // Generate a proper UUID for the report
  return uuidv4();
  }
  /**
   * Main entry point for report generation
   */
  async generateReport(jobId, options = {}) {
    const reportId = this.generateReportId();
    const startTime = Date.now();
    
    try {
      // Initialize report record
      await this.createReportRecord(reportId, jobId, options);
      
      // Step 1: Fetch all necessary data
      await this.updateProgress(reportId, 10, 'Fetching data...');
      const data = await this.fetchComprehensiveData(jobId);
      
      if (!data.products || data.products.length === 0) {
        throw new Error('No products found for report generation');
      }
      
      // Step 2: Calculate comprehensive statistics
      await this.updateProgress(reportId, 25, 'Calculating statistics...');
      const statistics = await this.statsCalculator.calculateAll(data);
      
      // Step 3: Generate charts
      await this.updateProgress(reportId, 40, 'Generating visualizations...');
      const charts = await this.chartGenerator.generateAllCharts(data, statistics);
      
      // Step 4: Build risk analysis
      await this.updateProgress(reportId, 55, 'Analyzing risks...');
      const riskAnalysis = await this.analyzeRisks(data);
      
      // Step 5: Generate recommendations
      await this.updateProgress(reportId, 70, 'Generating recommendations...');
      const recommendations = await this.generateRecommendations(data, statistics, riskAnalysis);
      
      // Step 6: Create Excel workbook
      await this.updateProgress(reportId, 85, 'Building Excel report...');
      const workbook = await this.excelBuilder.buildComprehensiveReport({
        reportId,
        jobId,
        data,
        statistics,
        charts,
        riskAnalysis,
        recommendations,
        options
      });
      
      // Step 7: Save and finalize
      await this.updateProgress(reportId, 95, 'Finalizing report...');
      const buffer = await workbook.xlsx.writeBuffer();
      
      // Update report record with completion
      await this.completeReportRecord(reportId, {
        fileSize: buffer.length,
        statistics,
        generationTime: Date.now() - startTime
      });
      
      await this.updateProgress(reportId, 100, 'Report completed');
      
      return {
        reportId,
        buffer,
        statistics,
        filename: this.generateFilename(options.customerName)
      };
      
    } catch (error) {
      console.error('Report generation failed:', error);
      await this.failReportRecord(reportId, error.message);
      throw error;
    }
  }

  /**
   * Fetch comprehensive data for report
   */
  async fetchComprehensiveData(jobId) {
    const queries = {
      // Main Phase 3 analysis data with aggregation
      products: `
        SELECT 
          p3.*,
          p3.total_quantity,
          p3.end_of_sale_date,
          p3.end_of_sw_maintenance_date,
          p3.end_of_sw_vulnerability_maintenance_date,
          p3.last_day_of_support_date,
          p3.lifecycle_status,
          p3.risk_level,
          p3.overall_confidence,
          p3.ai_enhanced,
          p3.data_sources,
          p3.support_coverage_percent AS support_coverage_percentage,
          p3.manufacturer,
          p3.product_category,
          p3.description,
          p3.is_current_product,
          p3.requires_review,
          EXTRACT(YEAR FROM p3.end_of_sale_date) as end_of_sale_year,
          EXTRACT(YEAR FROM p3.last_day_of_support_date) as last_day_of_support_year,
          CASE 
            WHEN p3.last_day_of_support_date < CURRENT_DATE THEN 'Past EOL'
            WHEN p3.last_day_of_support_date < CURRENT_DATE + INTERVAL '6 months' THEN 'Critical'
            WHEN p3.last_day_of_support_date < CURRENT_DATE + INTERVAL '1 year' THEN 'High'
            WHEN p3.last_day_of_support_date < CURRENT_DATE + INTERVAL '2 years' THEN 'Medium'
            ELSE 'Low'
          END as calculated_risk
        FROM phase3_analysis p3
        WHERE p3.job_id = $1
        ORDER BY p3.risk_level DESC, p3.total_quantity DESC
      `,
      
      // Job metadata
      jobInfo: `
        SELECT 
          j.*,
          (SELECT COUNT(*) FROM phase3_analysis WHERE job_id = j.job_id) as total_products,
          (SELECT SUM(total_quantity) FROM phase3_analysis WHERE job_id = j.job_id) as total_items
        FROM phase3_jobs j
        WHERE j.job_id = $1
      `,
      
      // Year distribution for timeline view
      yearDistribution: `
        WITH year_data AS (
          SELECT 
            UPPER(TRIM(product_id)) as product_id,
            EXTRACT(YEAR FROM COALESCE(purchase_date, ship_date)) as purchase_year,
            SUM(quantity) as quantity
          FROM raw_inventory
          WHERE job_id IN (SELECT phase2_job_id FROM phase3_jobs WHERE job_id = $1)
            AND COALESCE(purchase_date, ship_date) IS NOT NULL
          GROUP BY UPPER(TRIM(product_id)), EXTRACT(YEAR FROM COALESCE(purchase_date, ship_date))
        )
        SELECT 
          product_id,
          json_object_agg(purchase_year::text, quantity) as year_quantities
        FROM year_data
        GROUP BY product_id
      `,
      
      // Category summary
      categoryStats: `
        SELECT 
          product_category,
          COUNT(*) as product_count,
          SUM(total_quantity) as total_quantity,
          COUNT(CASE WHEN risk_level = 'critical' THEN 1 END) as critical_count,
          COUNT(CASE WHEN risk_level = 'high' THEN 1 END) as high_count,
          AVG(overall_confidence) as avg_confidence
        FROM phase3_analysis
        WHERE job_id = $1
        GROUP BY product_category
        ORDER BY total_quantity DESC
      `,
      
      // Manufacturer summary
      manufacturerStats: `
        SELECT 
          manufacturer,
          COUNT(*) as product_count,
          SUM(total_quantity) as total_quantity,
          COUNT(CASE WHEN lifecycle_status = 'EOL' THEN 1 END) as eol_count,
          COUNT(CASE WHEN ai_enhanced = true THEN 1 END) as ai_enhanced_count,
          AVG(overall_confidence) as avg_confidence
        FROM phase3_analysis
        WHERE job_id = $1
        GROUP BY manufacturer
        ORDER BY total_quantity DESC
      `
    };
    
    const results = {};
    for (const [key, query] of Object.entries(queries)) {
      const result = await db.query(query, [jobId]);
      results[key] = result.rows;
    }
    
    // Merge year quantities into products
    const yearQuantityMap = new Map();
    results.yearDistribution.forEach(item => {
      yearQuantityMap.set(item.product_id, item.year_quantities);
    });
    
    results.products = results.products.map(product => ({
      ...product,
      year_quantities: yearQuantityMap.get(product.product_id) || {}
    }));
    
    return results;
  }

  /**
   * Analyze risks comprehensively
   */
  async analyzeRisks(data) {
    const currentDate = new Date();
    const analysis = {
      summary: {
        critical: [],
        high: [],
        medium: [],
        low: [],
        none: []
      },
      byCategory: {},
      byManufacturer: {},
      financialImpact: {
        totalAtRisk: 0,
        criticalValue: 0,
        replacementCost: 0
      },
      timeline: {
        next6Months: [],
        next12Months: [],
        next24Months: []
      }
    };
    
    // Categorize products by risk
    data.products.forEach(product => {
      const riskLevel = product.risk_level || 'none';
      analysis.summary[riskLevel].push(product);
      
      // Category risk analysis
      if (!analysis.byCategory[product.product_category]) {
        analysis.byCategory[product.product_category] = {
          total: 0,
          critical: 0,
          high: 0,
          atRisk: []
        };
      }
      
      const catAnalysis = analysis.byCategory[product.product_category];
      catAnalysis.total++;
      if (riskLevel === 'critical') catAnalysis.critical++;
      if (riskLevel === 'high') catAnalysis.high++;
      if (riskLevel === 'critical' || riskLevel === 'high') {
        catAnalysis.atRisk.push(product.product_id);
      }
      
      // Timeline analysis
      if (product.last_day_of_support_date) {
        const eolDate = new Date(product.last_day_of_support_date);
        const monthsUntilEOL = (eolDate - currentDate) / (1000 * 60 * 60 * 24 * 30);
        
        if (monthsUntilEOL <= 6) {
          analysis.timeline.next6Months.push(product);
        } else if (monthsUntilEOL <= 12) {
          analysis.timeline.next12Months.push(product);
        } else if (monthsUntilEOL <= 24) {
          analysis.timeline.next24Months.push(product);
        }
      }
      
      // Financial impact estimation
      const estimatedValue = product.total_quantity * 1000; // Placeholder calculation
      if (riskLevel === 'critical' || riskLevel === 'high') {
        analysis.financialImpact.totalAtRisk += estimatedValue;
      }
      if (riskLevel === 'critical') {
        analysis.financialImpact.criticalValue += estimatedValue;
        analysis.financialImpact.replacementCost += estimatedValue * 1.5; // 50% premium for urgent replacement
      }
    });
    
    return analysis;
  }

  /**
   * Generate actionable recommendations
   */
  async generateRecommendations(data, statistics, riskAnalysis) {
    const recommendations = {
      immediate: [],
      shortTerm: [],
      longTerm: [],
      strategic: []
    };
    
    // Immediate actions for critical risks
    if (riskAnalysis.summary.critical.length > 0) {
      recommendations.immediate.push({
        priority: 'CRITICAL',
        title: 'Immediate EOL Product Replacement',
        description: `${riskAnalysis.summary.critical.length} products are at or past End of Life and require immediate attention`,
        products: riskAnalysis.summary.critical.map(p => p.product_id),
        estimatedCost: riskAnalysis.financialImpact.criticalValue,
        timeline: '0-3 months'
      });
    }
    
    // High risk recommendations
    if (riskAnalysis.summary.high.length > 0) {
      recommendations.shortTerm.push({
        priority: 'HIGH',
        title: 'Plan for High-Risk Product Migration',
        description: `${riskAnalysis.summary.high.length} products approaching EOL within 6-12 months`,
        products: riskAnalysis.summary.high.slice(0, 10).map(p => p.product_id),
        timeline: '3-6 months'
      });
    }
    
    // Category-specific recommendations
    Object.entries(riskAnalysis.byCategory).forEach(([category, analysis]) => {
      if (analysis.critical > 0 || analysis.high > 0) {
        const riskPercentage = ((analysis.critical + analysis.high) / analysis.total * 100).toFixed(1);
        recommendations.strategic.push({
          priority: 'MEDIUM',
          title: `${category} Category Risk Assessment`,
          description: `${riskPercentage}% of ${category} products are at high risk`,
          action: `Consider category-wide refresh or standardization strategy`,
          affectedProducts: analysis.atRisk.length
        });
      }
    });
    
    // Data quality recommendations
    const lowConfidenceProducts = data.products.filter(p => p.overall_confidence < 60);
    if (lowConfidenceProducts.length > 0) {
      recommendations.longTerm.push({
        priority: 'LOW',
        title: 'Improve Data Quality',
        description: `${lowConfidenceProducts.length} products have low confidence scores`,
        action: 'Manual verification recommended for accurate lifecycle planning',
        products: lowConfidenceProducts.slice(0, 5).map(p => p.product_id)
      });
    }
    
    // Support coverage recommendations
    const uncoveredProducts = data.products.filter(p => p.support_coverage_percentage < 50);
    if (uncoveredProducts.length > 0) {
      recommendations.shortTerm.push({
        priority: 'MEDIUM',
        title: 'Support Coverage Gaps',
        description: `${uncoveredProducts.length} products have less than 50% support coverage`,
        action: 'Review and update support contracts',
        estimatedRisk: uncoveredProducts.reduce((sum, p) => sum + p.total_quantity, 0) * 500
      });
    }
    
    return recommendations;
  }

  /**
   * Database operations
   */
  async createReportRecord(reportId, jobId, options) {
    const query = `
      INSERT INTO lifecycle_reports (
        report_id,
        job_id,
        report_type,
        customer_name,
        eol_year_basis,
        status,
        progress_percentage,
        current_step,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, 'generating', 0, 'Initializing', NOW())
    `;
    
    await db.query(query, [
      reportId,
      jobId,
      'comprehensive_excel',
      options.customerName || 'Unknown',
      options.eolYearBasis || 'lastDayOfSupport'
    ]);
  }

  async updateProgress(reportId, percentage, step) {
    const query = `
      UPDATE lifecycle_reports
      SET progress_percentage = $2,
          current_step = $3,
          updated_at = NOW()
      WHERE report_id = $1
    `;
    
    await db.query(query, [reportId, percentage, step]);
    
    // Emit progress event if callback registered
    const callback = this.progressCallbacks.get(reportId);
    if (callback) {
      callback({ percentage, step, reportId });
    }
  }

  async completeReportRecord(reportId, data) {
    const query = `
      UPDATE lifecycle_reports
      SET status = 'completed',
          progress_percentage = 100,
          current_step = 'Completed',
          file_size_bytes = $2,
          total_products = $3,
          total_quantity = $4,
          critical_risk_count = $5,
          high_risk_count = $6,
          products_at_eol = $7,
          completed_at = NOW(),
          generation_time_ms = $8
      WHERE report_id = $1
    `;
    
    await db.query(query, [
      reportId,
      data.fileSize,
      data.statistics.totalProducts,
      data.statistics.totalQuantity,
      data.statistics.criticalRiskCount,
      data.statistics.highRiskCount,
      data.statistics.productsAtEOL,
      data.generationTime
    ]);
  }

  async failReportRecord(reportId, error) {
    const query = `
      UPDATE lifecycle_reports
      SET status = 'failed',
          error_message = $2,
          updated_at = NOW()
      WHERE report_id = $1
    `;
    
    await db.query(query, [reportId, error]);
  }

  /**
   * Register progress callback for SSE
   */
  registerProgressCallback(reportId, callback) {
    this.progressCallbacks.set(reportId, callback);
  }

  unregisterProgressCallback(reportId) {
    this.progressCallbacks.delete(reportId);
  }

  /**
   * Generate filename
   */
  generateFilename(customerName) {
    const sanitized = (customerName || 'lifecycle')
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();
    const date = new Date().toISOString().split('T')[0];
    return `${sanitized}_lifecycle_report_${date}.xlsx`;
  }
}

module.exports = LifecycleReportOrchestrator;