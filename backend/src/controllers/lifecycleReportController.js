// lifecycleReportController.js - FIXED VERSION
// This version fetches year_quantities directly for Excel export
// instead of relying on the orchestrator which doesn't fetch year quantities

const LifecycleReportOrchestrator = require('../services/lifecycleReportOrchestrator');
const LifecycleExcelBuilder = require('../services/lifecycleExcelBuilder');
const LifecycleStatisticsCalculator = require('../services/lifecycleStatisticsCalculator');
const db = require('../database/dbConnection');

const lifecycleReportController = {
  orchestrator: new LifecycleReportOrchestrator(),
  excelBuilder: new LifecycleExcelBuilder(),
  statsCalculator: new LifecycleStatisticsCalculator(),
  
  /**
   * Generate lifecycle report data for on-screen display (JSON)
   * This returns JSON data that the frontend displays in a formatted report view
   */
  async generateLifecycleReport(req, res) {
    const { jobId, eolYearBasis = 'lastDayOfSupport', customerName } = req.body;
    
    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'Job ID is required'
      });
    }
    
    try {
      // Validate job exists
      const jobCheck = await db.query(
        'SELECT job_id, customer_name FROM phase3_jobs WHERE job_id = $1',
        [jobId]
      );
      
      if (jobCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Phase 3 job not found'
        });
      }
      
      const actualCustomerName = customerName || jobCheck.rows[0].customer_name || 'Organization';
      
      // Fetch all Phase 3 analysis data
      const analysisQuery = await db.query(
        `SELECT * FROM phase3_analysis 
         WHERE job_id = $1 
         ORDER BY total_quantity DESC`,
        [jobId]
      );
      
      const products = analysisQuery.rows;
      
      if (products.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No products found for analysis'
        });
      }
      
      // Fetch year quantities for timeline
      const yearDistributionQuery = await db.query(
        `WITH year_data AS (
          SELECT 
            UPPER(TRIM(product_id)) as product_id,
            EXTRACT(YEAR FROM COALESCE(purchase_date, ship_date))::text as purchase_year,
            SUM(quantity) as quantity
          FROM raw_inventory
          WHERE job_id = $1
          AND COALESCE(purchase_date, ship_date) IS NOT NULL
          GROUP BY UPPER(TRIM(product_id)), EXTRACT(YEAR FROM COALESCE(purchase_date, ship_date))
        )
        SELECT 
          product_id,
          json_object_agg(purchase_year, quantity) as year_quantities
        FROM year_data
        GROUP BY product_id`,
        [jobId]
      );

      console.log('Year distribution found:', yearDistributionQuery.rows.length, 'products');
      
      // Create a map of year quantities by product
      const yearQuantityMap = new Map();
      yearDistributionQuery.rows.forEach(item => {
        yearQuantityMap.set(item.product_id.toUpperCase(), item.year_quantities);
      });
      
      // Merge year quantities into products
      const productsWithYearData = products.map(product => ({
        ...product,
        year_quantities: yearQuantityMap.get(product.product_id.toUpperCase()) || {}
      }));
      
      
      // Fetch category statistics with risk analysis
      const categoryStatsQuery = await db.query(
        `SELECT 
          product_category,
          COUNT(DISTINCT product_id) as product_count,
          SUM(total_quantity) as total_quantity,
          SUM(CASE WHEN risk_level = 'critical' THEN 1 ELSE 0 END) as critical_count,
          SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END) as high_count,
          SUM(CASE WHEN risk_level = 'medium' THEN 1 ELSE 0 END) as medium_count,
          SUM(CASE WHEN risk_level = 'low' THEN 1 ELSE 0 END) as low_count,
          SUM(CASE WHEN lifecycle_status = 'EOL' OR lifecycle_status = 'End of Life' THEN 1 ELSE 0 END) as eol_count,
          ROUND(AVG(overall_confidence)) as avg_confidence
        FROM phase3_analysis
        WHERE job_id = $1 AND product_category IS NOT NULL
        GROUP BY product_category
        ORDER BY total_quantity DESC
        LIMIT 20`,
        [jobId]
      );
      
      // Fetch manufacturer statistics with risk analysis
      const manufacturerStatsQuery = await db.query(
        `SELECT 
          manufacturer,
          COUNT(DISTINCT product_id) as product_count,
          SUM(total_quantity) as total_quantity,
          SUM(CASE WHEN risk_level = 'critical' THEN 1 ELSE 0 END) as critical_count,
          SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END) as high_count,
          SUM(CASE WHEN risk_level = 'medium' THEN 1 ELSE 0 END) as medium_count,
          SUM(CASE WHEN risk_level = 'low' THEN 1 ELSE 0 END) as low_count,
          SUM(CASE WHEN lifecycle_status = 'EOL' OR lifecycle_status = 'End of Life' THEN 1 ELSE 0 END) as eol_count,
          SUM(CASE WHEN ai_enhanced = true THEN 1 ELSE 0 END) as ai_enhanced_count,
          ROUND(AVG(overall_confidence)) as avg_confidence
        FROM phase3_analysis
        WHERE job_id = $1 AND manufacturer IS NOT NULL
        GROUP BY manufacturer
        ORDER BY total_quantity DESC
        LIMIT 20`,
        [jobId]
      );

      // Calculate comprehensive statistics
      const statistics = this.calculateStatistics(productsWithYearData, eolYearBasis);
      
      // Generate risk analysis
      const riskAnalysis = this.analyzeRisk(productsWithYearData, eolYearBasis);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(productsWithYearData, statistics, riskAnalysis);
      
      // Get top insights
      const topInsights = this.generateInsights(statistics, productsWithYearData);
      
      // Structure response for on-screen display
      // Structure response for on-screen display
      res.json({
        success: true,
        report: {  // <-- Wrap in 'report' object
          jobId,
          customerName: actualCustomerName,
          generated: new Date().toISOString(),
          eolBasis: eolYearBasis,
          products: productsWithYearData,
          statistics: {
            ...statistics,
            categoryBreakdown: categoryStatsQuery.rows,
            manufacturerBreakdown: manufacturerStatsQuery.rows,
            topInsights
          },
          riskAnalysis,
          recommendations,
          yearDistribution: Object.fromEntries(yearQuantityMap)
        }
      });

      return; // Add return here
      
      res.json(reportData);
      
    } catch (error) {
      console.error('Report generation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate report',
        details: error.message
      });
    }
  },
  
  /**
   * FIXED: Export lifecycle report as Excel
   * This version fetches year_quantities directly instead of using the orchestrator
   */
  async exportLifecycleReportExcel(req, res) {
    const { jobId, eolYearBasis = 'lastDayOfSupport', customerName } = req.body;
    
    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'Job ID is required'
      });
    }
    
    try {
      // Validate job exists
      const jobCheck = await db.query(
        'SELECT job_id, customer_name FROM phase3_jobs WHERE job_id = $1',
        [jobId]
      );
      
      if (jobCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Phase 3 job not found'
        });
      }
      
      const actualCustomerName = customerName || jobCheck.rows[0].customer_name || 'Organization';
      
      console.log('Excel Export - Starting for job:', jobId);
      
      // Step 1: Fetch all Phase 3 analysis data
      const productsQuery = await db.query(
        `SELECT 
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
          p3.requires_review
        FROM phase3_analysis p3
        WHERE p3.job_id = $1
        ORDER BY p3.risk_level DESC, p3.total_quantity DESC`,
        [jobId]
      );
      
      const products = productsQuery.rows;
      console.log('Excel Export - Found products:', products.length);
      
      // Step 2: CRITICAL - Fetch year quantities from raw_inventory
      const yearDistributionQuery = await db.query(
        `WITH year_data AS (
          SELECT 
            UPPER(TRIM(product_id)) as product_id,
            EXTRACT(YEAR FROM COALESCE(purchase_date, ship_date))::text as purchase_year,
            SUM(quantity) as quantity
          FROM raw_inventory
          WHERE job_id = $1
          AND COALESCE(purchase_date, ship_date) IS NOT NULL
          GROUP BY UPPER(TRIM(product_id)), EXTRACT(YEAR FROM COALESCE(purchase_date, ship_date))
        )
        SELECT 
          product_id,
          json_object_agg(purchase_year, quantity) as year_quantities
        FROM year_data
        GROUP BY product_id`,
        [jobId]
      );
      
      console.log('Excel Export - Year distribution found:', yearDistributionQuery.rows.length, 'products');
      
      // Create a map of year quantities by product
      const yearQuantityMap = new Map();
      yearDistributionQuery.rows.forEach(item => {
        console.log(`Product ${item.product_id}:`, item.year_quantities);
        yearQuantityMap.set(item.product_id.toUpperCase(), item.year_quantities);
      });
      
      // Step 3: Merge year quantities into products
      const productsWithYearData = products.map(product => {
        const yearData = yearQuantityMap.get(product.product_id.toUpperCase()) || {};
        console.log(`Adding year_quantities to ${product.product_id}:`, yearData);
        return {
          ...product,
          year_quantities: yearData  // THIS IS THE KEY FIX!
        };
      });
      
      // Step 4: Fetch category statistics
      const categoryStatsQuery = await db.query(
        `SELECT 
          product_category,
          COUNT(DISTINCT product_id) as product_count,
          SUM(total_quantity) as total_quantity
        FROM phase3_analysis
        WHERE job_id = $1 AND product_category IS NOT NULL
        GROUP BY product_category
        ORDER BY total_quantity DESC
        LIMIT 20`,
        [jobId]
      );
      
      // Step 5: Fetch manufacturer statistics
      const manufacturerStatsQuery = await db.query(
        `SELECT 
          manufacturer,
          COUNT(DISTINCT product_id) as product_count,
          SUM(total_quantity) as total_quantity
        FROM phase3_analysis
        WHERE job_id = $1 AND manufacturer IS NOT NULL
        GROUP BY manufacturer
        ORDER BY total_quantity DESC
        LIMIT 20`,
        [jobId]
      );
      
      // Step 6: Prepare complete data object
      const data = {
        products: productsWithYearData,  // Now includes year_quantities!
        jobInfo: jobCheck.rows[0],
        categoryStats: categoryStatsQuery.rows,
        manufacturerStats: manufacturerStatsQuery.rows
      };
      
      // Step 7: Calculate statistics
      const statistics = await this.statsCalculator.calculateAll(data);
      
      // Step 8: Generate risk analysis
      const riskAnalysis = this.analyzeRiskForExcel(productsWithYearData);
      
      // Step 9: Generate recommendations
      const recommendations = this.generateRecommendations(productsWithYearData, statistics, riskAnalysis);
      
      // Step 10: Create Excel workbook directly
      const reportData = {
        data: data,  // Contains products WITH year_quantities
        statistics: statistics,
        charts: {},  // Charts will be generated by Excel builder
        riskAnalysis: riskAnalysis,
        recommendations: recommendations,
        options: {
          customerName: actualCustomerName,
          eolYearBasis: eolYearBasis
        }
      };
      
      // Use Excel builder to create workbook
      const workbook = await this.excelBuilder.buildComprehensiveReport(reportData);
      
      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      
      // Send Excel file as response
      const filename = `Lifecycle_Report_${actualCustomerName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
      
      console.log('Excel Export - Completed successfully');
      
    } catch (error) {
      console.error('Excel export error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export Excel',
        details: error.message
      });
    }
  },
  
  /**
   * Risk analysis specifically for Excel export
   */
  analyzeRiskForExcel(products) {
    const riskAnalysis = {
      summary: {
        critical: [],
        high: [],
        medium: [],
        low: [],
        none: []
      },
      timeline: {
        next6Months: [],
        next12Months: [],
        next24Months: []
      },
      financialImpact: {
        totalAtRisk: 0,
        criticalValue: 0,
        replacementCost: 0
      }
    };
    
    const currentDate = new Date();
    const avgProductValue = 1000; // Placeholder
    
    products.forEach(product => {
      // Categorize by risk level
      const riskLevel = product.risk_level || 'none';
      if (riskAnalysis.summary[riskLevel]) {
        riskAnalysis.summary[riskLevel].push(product);
      }
      
      // Timeline analysis
      if (product.last_day_of_support_date) {
        const ldosDate = new Date(product.last_day_of_support_date);
        const monthsUntil = (ldosDate - currentDate) / (1000 * 60 * 60 * 24 * 30);
        
        if (monthsUntil > 0 && monthsUntil <= 6) {
          riskAnalysis.timeline.next6Months.push(product);
        } else if (monthsUntil > 6 && monthsUntil <= 12) {
          riskAnalysis.timeline.next12Months.push(product);
        } else if (monthsUntil > 12 && monthsUntil <= 24) {
          riskAnalysis.timeline.next24Months.push(product);
        }
      }
      
      // Financial impact
      const value = product.total_quantity * avgProductValue;
      if (riskLevel === 'critical' || riskLevel === 'high') {
        riskAnalysis.financialImpact.totalAtRisk += value;
      }
      if (riskLevel === 'critical') {
        riskAnalysis.financialImpact.criticalValue += value;
      }
    });
    
    riskAnalysis.financialImpact.replacementCost = riskAnalysis.financialImpact.totalAtRisk * 1.3;
    
    return riskAnalysis;
  },
  
  /**
   * Calculate comprehensive statistics for the report
   */
  calculateStatistics(products, eolYearBasis) {
    const totalProducts = products.length;
    const totalQuantity = products.reduce((sum, p) => sum + (p.total_quantity || 0), 0);
    
    // Count products by risk level
    const criticalRiskCount = products.filter(p => p.risk_level === 'critical').length;
    const highRiskCount = products.filter(p => p.risk_level === 'high').length;
    const mediumRiskCount = products.filter(p => p.risk_level === 'medium').length;
    const lowRiskCount = products.filter(p => p.risk_level === 'low').length;
    const noRiskCount = products.filter(p => p.risk_level === 'none' || !p.risk_level).length;
    
    // Calculate percentages
    const criticalRiskPercentage = Math.round((criticalRiskCount / totalProducts) * 100);
    const highRiskPercentage = Math.round((highRiskCount / totalProducts) * 100);
    const mediumRiskPercentage = Math.round((mediumRiskCount / totalProducts) * 100);
    const lowRiskPercentage = Math.round((lowRiskCount / totalProducts) * 100);
    
    // Count products by lifecycle status
    const currentCount = products.filter(p => p.lifecycle_status === 'Current').length;
    const approachingEOLCount = products.filter(p => p.lifecycle_status === 'Approaching EOL').length;
    const eolCount = products.filter(p => p.lifecycle_status === 'EOL').length;
    const eolProductsPercentage = Math.round((eolCount / totalProducts) * 100);
    
    // AI enhancement metrics
    const aiEnhancedCount = products.filter(p => p.ai_enhanced).length;
    const aiEnhancedPercentage = Math.round((aiEnhancedCount / totalProducts) * 100);
    
    // Support coverage metrics
    const coveredProducts = products.filter(p => p.support_coverage_percentage > 0);
    const uncoveredCount = totalProducts - coveredProducts.length;
    const uncoveredPercentage = Math.round((uncoveredCount / totalProducts) * 100);
    
    // Calculate average confidence
    const avgConfidence = Math.round(
      products.reduce((sum, p) => sum + (p.overall_confidence || 0), 0) / totalProducts
    );
    
    // Calculate health score (0-100)
    let healthScore = 100;
    healthScore -= (criticalRiskPercentage * 2);
    healthScore -= (highRiskPercentage * 1);
    healthScore -= (eolProductsPercentage * 1.5);
    healthScore -= (uncoveredPercentage * 0.5);
    healthScore += (aiEnhancedPercentage * 0.1);
    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));
    
    // Calculate risk score (higher = worse)
    let riskScore = 0;
    riskScore += (criticalRiskPercentage * 2);
    riskScore += (highRiskPercentage * 1.5);
    riskScore += (mediumRiskPercentage * 0.5);
    riskScore += (eolProductsPercentage * 1);
    riskScore = Math.min(100, Math.round(riskScore));
    
    // Data quality score
    const dataQualityScore = Math.round(
      (avgConfidence * 0.5) + (aiEnhancedPercentage * 0.5)
    );
    
    return {
      totalProducts,
      totalQuantity,
      criticalRiskCount,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
      noRiskCount,
      criticalRiskPercentage,
      highRiskPercentage,
      mediumRiskPercentage,
      lowRiskPercentage,
      currentCount,
      approachingEOLCount,
      eolCount,
      eolProductsPercentage,
      aiEnhancedCount,
      aiEnhancedPercentage,
      uncoveredCount,
      uncoveredPercentage,
      avgConfidence,
      healthScore,
      riskScore,
      dataQualityScore,
      uniqueManufacturers: new Set(products.map(p => p.manufacturer)).size,
      uniqueCategories: new Set(products.map(p => p.product_category)).size,
      percentages: {
        criticalRisk: criticalRiskPercentage.toFixed(1),
        highRisk: highRiskPercentage.toFixed(1),
        currentProducts: ((currentCount / totalProducts) * 100).toFixed(1),
        eolProducts: eolProductsPercentage.toFixed(1),
        aiEnhanced: aiEnhancedPercentage.toFixed(1),
        fullyCovered: ((coveredProducts.length / totalProducts) * 100).toFixed(1)
      },
      // Additional fields expected by Excel builder
      productsAtEOL: eolCount,
      riskDistribution: {
        critical: criticalRiskCount,
        high: highRiskCount,
        medium: mediumRiskCount,
        low: lowRiskCount,
        none: noRiskCount
      },
      lifecycleDistribution: {
        current: currentCount,
        endOfSale: products.filter(p => p.lifecycle_status === 'End of Sale').length,
        endOfSupport: products.filter(p => p.lifecycle_status === 'End of Support').length,
        endOfLife: eolCount,
        unknown: products.filter(p => !p.lifecycle_status || p.lifecycle_status === 'Unknown').length
      },
      eolTimeline: {
        alreadyEOL: products.filter(p => {
          if (!p.last_day_of_support_date) return false;
          return new Date(p.last_day_of_support_date) < new Date();
        }).length,
        within6Months: products.filter(p => {
          if (!p.last_day_of_support_date) return false;
          const months = (new Date(p.last_day_of_support_date) - new Date()) / (1000 * 60 * 60 * 24 * 30);
          return months >= 0 && months <= 6;
        }).length,
        within12Months: products.filter(p => {
          if (!p.last_day_of_support_date) return false;
          const months = (new Date(p.last_day_of_support_date) - new Date()) / (1000 * 60 * 60 * 24 * 30);
          return months > 6 && months <= 12;
        }).length,
        within24Months: products.filter(p => {
          if (!p.last_day_of_support_date) return false;
          const months = (new Date(p.last_day_of_support_date) - new Date()) / (1000 * 60 * 60 * 24 * 30);
          return months > 12 && months <= 24;
        }).length,
        beyond24Months: products.filter(p => {
          if (!p.last_day_of_support_date) return false;
          const months = (new Date(p.last_day_of_support_date) - new Date()) / (1000 * 60 * 60 * 24 * 30);
          return months > 24;
        }).length,
        noEOLDate: products.filter(p => !p.last_day_of_support_date).length
      },
      supportCoverage: {
        fullyCovered: coveredProducts.filter(p => p.support_coverage_percentage >= 100).length,
        partiallyCovered: coveredProducts.filter(p => p.support_coverage_percentage > 0 && p.support_coverage_percentage < 100).length,
        notCovered: uncoveredCount,
        averageCoverage: Math.round(products.reduce((sum, p) => sum + (p.support_coverage_percentage || 0), 0) / totalProducts)
      },
      aiEnhancement: {
        enhanced: aiEnhancedCount,
        notEnhanced: totalProducts - aiEnhancedCount,
        percentageEnhanced: aiEnhancedPercentage.toFixed(1)
      },
      confidenceAnalysis: {
        high: products.filter(p => p.overall_confidence >= 80).length,
        medium: products.filter(p => p.overall_confidence >= 60 && p.overall_confidence < 80).length,
        low: products.filter(p => p.overall_confidence < 60).length,
        average: avgConfidence,
        requiresReview: products.filter(p => p.requires_review === true).length
      },
      dataCompleteness: {
        withEndOfSale: products.filter(p => p.end_of_sale_date).length,
        withEndOfSupport: products.filter(p => p.last_day_of_support_date).length,
        withAllDates: products.filter(p => 
          p.end_of_sale_date && 
          p.end_of_sw_maintenance_date && 
          p.end_of_sw_vulnerability_maintenance_date && 
          p.last_day_of_support_date
        ).length,
        missingAllDates: products.filter(p => 
          !p.end_of_sale_date && 
          !p.end_of_sw_maintenance_date && 
          !p.end_of_sw_vulnerability_maintenance_date && 
          !p.last_day_of_support_date
        ).length
      },
      financialMetrics: {
        estimatedTotalValue: totalQuantity * 1000,
        valueAtRisk: products.filter(p => p.risk_level === 'critical' || p.risk_level === 'high')
          .reduce((sum, p) => sum + (p.total_quantity * 1000), 0),
        criticalValue: products.filter(p => p.risk_level === 'critical')
          .reduce((sum, p) => sum + (p.total_quantity * 1000), 0),
        replacementBudget: 0
      },
      topInsights: [],
      overallHealthScore: healthScore
    };
  },
  
  /**
   * Analyze risk for products
   */
  analyzeRisk(products, eolYearBasis) {
    const currentDate = new Date();
    const riskAnalysis = {
      criticalRisk: [],
      highRisk: [],
      mediumRisk: [],
      lowRisk: [],
      noRisk: []
    };
    
    products.forEach(product => {
      const riskLevel = product.risk_level || 'none';
      
      switch (riskLevel) {
        case 'critical':
          riskAnalysis.criticalRisk.push(product);
          break;
        case 'high':
          riskAnalysis.highRisk.push(product);
          break;
        case 'medium':
          riskAnalysis.mediumRisk.push(product);
          break;
        case 'low':
          riskAnalysis.lowRisk.push(product);
          break;
        default:
          riskAnalysis.noRisk.push(product);
      }
    });
    
    return riskAnalysis;
  },
  
  /**
   * Generate actionable recommendations
   */
  generateRecommendations(products, statistics, riskAnalysis) {
    const recommendations = {
      immediate: [],
      shortTerm: [],
      longTerm: [],
      strategic: []
    };
    
    // Immediate actions for critical risk products
    if (statistics.criticalRiskCount > 0) {
      recommendations.immediate.push({
        priority: 'CRITICAL',
        title: 'Replace End-of-Life Products',
        description: `${statistics.criticalRiskCount} products are at critical risk and require immediate replacement.`,
        products: products.filter(p => p.risk_level === 'critical').slice(0, 5).map(p => p.product_id)
      });
    }
    
    // Short-term actions for high risk products
    if (statistics.highRiskCount > 0) {
      recommendations.shortTerm.push({
        priority: 'HIGH',
        title: 'Plan Migration for High-Risk Products',
        description: `${statistics.highRiskCount} products are at high risk and should be migrated within 3-6 months.`,
        products: products.filter(p => p.risk_level === 'high').slice(0, 5).map(p => p.product_id)
      });
    }
    
    // Long-term planning
    if (statistics.mediumRiskCount > 0) {
      recommendations.longTerm.push({
        priority: 'MEDIUM',
        title: 'Schedule Review for Medium-Risk Products',
        description: `${statistics.mediumRiskCount} products require review and planning within the next 6-12 months.`
      });
    }
    
    // Strategic recommendations
    if (statistics.aiEnhancedPercentage < 50) {
      recommendations.strategic.push({
        priority: 'LOW',
        title: 'Improve Data Quality',
        description: 'Consider manual verification for products with low confidence scores to improve data accuracy.'
      });
    }
    
    return recommendations;
  },
  
  /**
   * Generate top insights
   */
  generateInsights(statistics, products) {
    const insights = [];
    
    if (statistics.criticalRiskCount > 0) {
      insights.push({
        type: 'critical',
        title: 'Immediate Action Required',
        message: `${statistics.criticalRiskCount} products (${statistics.criticalRiskPercentage}%) are at critical risk and require immediate replacement`,
        priority: 1
      });
    }
    
    if (statistics.productsAtEOL > 0) {
      insights.push({
        type: 'warning',
        title: 'Products Past End of Life',
        message: `${statistics.productsAtEOL} products have already reached End of Life and are no longer supported`,
        priority: 2
      });
    }
    
    if (statistics.uncoveredCount > statistics.totalProducts * 0.2) {
      insights.push({
        type: 'warning',
        title: 'Support Coverage Gap',
        message: `${statistics.uncoveredCount} products (${statistics.uncoveredPercentage}%) have no support coverage`,
        priority: 3
      });
    }
    
    if (statistics.aiEnhancedPercentage > 80) {
      insights.push({
        type: 'success',
        title: 'Strong AI Enhancement',
        message: `${statistics.aiEnhancedPercentage}% of products were successfully enhanced with AI research`,
        priority: 5
      });
    }
    
    return insights;
  }
};

module.exports = lifecycleReportController;