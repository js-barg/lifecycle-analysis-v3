// lifecycleStatisticsCalculator.js
// Comprehensive statistics calculation for lifecycle reports

class LifecycleStatisticsCalculator {
  /**
   * Calculate all statistics for the report
   */
  async calculateAll(data) {
    const { products, jobInfo, categoryStats, manufacturerStats } = data;
    const currentDate = new Date();
    
    const statistics = {
      // Basic counts
      totalProducts: products.length,
      totalQuantity: products.reduce((sum, p) => sum + (p.total_quantity || 0), 0),
      uniqueManufacturers: new Set(products.map(p => p.manufacturer)).size,
      uniqueCategories: new Set(products.map(p => p.product_category)).size,
      
      // Lifecycle status distribution
      lifecycleDistribution: {
        current: products.filter(p => p.lifecycle_status === 'Current').length,
        endOfSale: products.filter(p => p.lifecycle_status === 'End of Sale').length,
        endOfSupport: products.filter(p => p.lifecycle_status === 'End of Support').length,
        endOfLife: products.filter(p => p.lifecycle_status === 'EOL' || p.lifecycle_status === 'End of Life').length,
        unknown: products.filter(p => !p.lifecycle_status || p.lifecycle_status === 'Unknown').length
      },
      
      // Risk distribution
      riskDistribution: {
        critical: products.filter(p => p.risk_level === 'critical').length,
        high: products.filter(p => p.risk_level === 'high').length,
        medium: products.filter(p => p.risk_level === 'medium').length,
        low: products.filter(p => p.risk_level === 'low').length,
        none: products.filter(p => p.risk_level === 'none' || !p.risk_level).length
      },
      
      // EOL timeline
      eolTimeline: {
        alreadyEOL: 0,
        within6Months: 0,
        within12Months: 0,
        within24Months: 0,
        beyond24Months: 0,
        noEOLDate: 0
      },
      
      // Support coverage
      supportCoverage: {
        fullyCovered: products.filter(p => p.support_coverage_percentage >= 100).length,
        partiallyCovered: products.filter(p => p.support_coverage_percentage > 0 && p.support_coverage_percentage < 100).length,
        notCovered: products.filter(p => !p.support_coverage_percentage || p.support_coverage_percentage === 0).length,
        averageCoverage: this.calculateAverage(products, 'support_coverage_percentage')
      },
      
      // AI enhancement stats
      aiEnhancement: {
        enhanced: products.filter(p => p.ai_enhanced === true).length,
        notEnhanced: products.filter(p => p.ai_enhanced !== true).length,
        percentageEnhanced: 0
      },
      
      // Confidence scores
      confidenceAnalysis: {
        high: products.filter(p => p.overall_confidence >= 80).length,
        medium: products.filter(p => p.overall_confidence >= 60 && p.overall_confidence < 80).length,
        low: products.filter(p => p.overall_confidence < 60).length,
        average: this.calculateAverage(products, 'overall_confidence'),
        requiresReview: products.filter(p => p.requires_review === true).length
      },
      
      // Date field completeness
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
      
      // Financial impact (estimated)
      financialMetrics: {
        estimatedTotalValue: 0,
        valueAtRisk: 0,
        criticalValue: 0,
        replacementBudget: 0
      },
      
      // Top insights
      topInsights: [],
      
      // Category breakdown
      categoryBreakdown: categoryStats || [],
      
      // Manufacturer breakdown
      manufacturerBreakdown: manufacturerStats || [],
      
      // Critical products list (top 10)
      criticalProducts: products
        .filter(p => p.risk_level === 'critical')
        .sort((a, b) => b.total_quantity - a.total_quantity)
        .slice(0, 10)
        .map(p => ({
          productId: p.product_id,
          description: p.description,
          quantity: p.total_quantity,
          eolDate: p.last_day_of_support_date,
          daysUntilEOL: this.calculateDaysUntilDate(p.last_day_of_support_date)
        })),
      
      // Products needing attention
      attentionRequired: {
        noEOLDate: products.filter(p => !p.last_day_of_support_date).length,
        lowConfidence: products.filter(p => p.overall_confidence < 50).length,
        noCategory: products.filter(p => !p.product_category).length,
        noManufacturer: products.filter(p => !p.manufacturer).length
      }
    };
    
    // Calculate EOL timeline
    products.forEach(product => {
      if (!product.last_day_of_support_date) {
        statistics.eolTimeline.noEOLDate++;
      } else {
        const eolDate = new Date(product.last_day_of_support_date);
        const monthsUntilEOL = (eolDate - currentDate) / (1000 * 60 * 60 * 24 * 30);
        
        if (monthsUntilEOL < 0) {
          statistics.eolTimeline.alreadyEOL++;
        } else if (monthsUntilEOL <= 6) {
          statistics.eolTimeline.within6Months++;
        } else if (monthsUntilEOL <= 12) {
          statistics.eolTimeline.within12Months++;
        } else if (monthsUntilEOL <= 24) {
          statistics.eolTimeline.within24Months++;
        } else {
          statistics.eolTimeline.beyond24Months++;
        }
      }
    });
    
    // Calculate financial metrics (using placeholder values)
    const avgProductValue = 1000; // Placeholder - should come from actual data
    statistics.financialMetrics.estimatedTotalValue = statistics.totalQuantity * avgProductValue;
    
    const atRiskProducts = products.filter(p => 
      p.risk_level === 'critical' || p.risk_level === 'high'
    );
    statistics.financialMetrics.valueAtRisk = atRiskProducts.reduce(
      (sum, p) => sum + (p.total_quantity * avgProductValue), 0
    );
    
    const criticalProducts = products.filter(p => p.risk_level === 'critical');
    statistics.financialMetrics.criticalValue = criticalProducts.reduce(
      (sum, p) => sum + (p.total_quantity * avgProductValue), 0
    );
    
    statistics.financialMetrics.replacementBudget = statistics.financialMetrics.valueAtRisk * 1.3;
    
    // Calculate percentages
    statistics.aiEnhancement.percentageEnhanced = 
      (statistics.aiEnhancement.enhanced / statistics.totalProducts * 100).toFixed(1);
    
    // Add percentages for easy display
    statistics.percentages = {
      criticalRisk: ((statistics.riskDistribution.critical / statistics.totalProducts) * 100).toFixed(1),
      highRisk: ((statistics.riskDistribution.high / statistics.totalProducts) * 100).toFixed(1),
      currentProducts: ((statistics.lifecycleDistribution.current / statistics.totalProducts) * 100).toFixed(1),
      eolProducts: ((statistics.lifecycleDistribution.endOfLife / statistics.totalProducts) * 100).toFixed(1),
      aiEnhanced: statistics.aiEnhancement.percentageEnhanced,
      fullyCovered: ((statistics.supportCoverage.fullyCovered / statistics.totalProducts) * 100).toFixed(1)
    };
    
    // Add summary scores
    statistics.overallHealthScore = this.calculateHealthScore(statistics);
    statistics.riskScore = this.calculateRiskScore(statistics);
    statistics.dataQualityScore = this.calculateDataQualityScore(statistics);

    // Generate top insights
    statistics.topInsights = this.generateInsights(statistics, products);
    
    // Aliases for backward compatibility
    statistics.productsAtEOL = statistics.lifecycleDistribution.endOfLife;
    statistics.criticalRiskCount = statistics.riskDistribution.critical;
    statistics.highRiskCount = statistics.riskDistribution.high;
    
    return statistics;
  }
  
  /**
   * Calculate average of a field
   */
  calculateAverage(items, field) {
    if (!items || items.length === 0) return 0;
    const sum = items.reduce((total, item) => total + (item[field] || 0), 0);
    return Math.round(sum / items.length);
  }
  
  /**
   * Calculate days until a date
   */
  calculateDaysUntilDate(dateString) {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  /**
   * Generate actionable insights
   */
  generateInsights(statistics, products) {
    const insights = [];
    
    // Critical risk insight
    if (statistics.riskDistribution.critical > 0) {
      insights.push({
        type: 'critical',
        title: 'Immediate Action Required',
        message: `${statistics.riskDistribution.critical} products (${statistics.percentages.criticalRisk}%) are at critical risk and require immediate replacement`,
        priority: 1
      });
    }
    
    // EOL insight
    if (statistics.eolTimeline.alreadyEOL > 0) {
      insights.push({
        type: 'warning',
        title: 'Products Past End of Life',
        message: `${statistics.eolTimeline.alreadyEOL} products have already reached End of Life and are no longer supported`,
        priority: 2
      });
    }
    
    // Support coverage insight
    if (statistics.supportCoverage.notCovered > statistics.totalProducts * 0.2) {
      insights.push({
        type: 'warning',
        title: 'Support Coverage Gap',
        message: `${statistics.supportCoverage.notCovered} products (${(statistics.supportCoverage.notCovered / statistics.totalProducts * 100).toFixed(1)}%) have no support coverage`,
        priority: 3
      });
    }
    
    // Data quality insight
    if (statistics.confidenceAnalysis.low > statistics.totalProducts * 0.3) {
      insights.push({
        type: 'info',
        title: 'Data Quality Improvement Needed',
        message: `${statistics.confidenceAnalysis.low} products have low confidence scores and may need manual verification`,
        priority: 4
      });
    }
    
    // AI enhancement success
    if (statistics.aiEnhancement.percentageEnhanced > 80) {
      insights.push({
        type: 'success',
        title: 'Strong AI Enhancement',
        message: `${statistics.aiEnhancement.percentageEnhanced}% of products were successfully enhanced with AI research`,
        priority: 5
      });
    }
    
    return insights.slice(0, 5); // Return top 5 insights
  }
  
  /**
   * Calculate overall health score (0-100)
   */
  calculateHealthScore(statistics) {
    let score = 100;
    
    // Deduct for risk levels
    score -= (statistics.percentages.criticalRisk * 2);
    score -= (statistics.percentages.highRisk * 1);
    
    // Deduct for EOL products
    score -= (statistics.percentages.eolProducts * 1.5);
    
    // Deduct for poor support coverage
    const uncoveredPercentage = (statistics.supportCoverage.notCovered / statistics.totalProducts * 100);
    score -= (uncoveredPercentage * 0.5);
    
    // Bonus for AI enhancement
    score += (statistics.aiEnhancement.percentageEnhanced * 0.1);
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }
  
  /**
   * Calculate risk score (0-100, higher is worse)
   */
  calculateRiskScore(statistics) {
    let score = 0;
    
    // Add risk based on distribution
    score += statistics.percentages.criticalRisk * 2;
    score += statistics.percentages.highRisk * 1.5;
    score += (statistics.riskDistribution.medium / statistics.totalProducts * 100) * 0.5;
    
    // Add risk for EOL timeline
    score += (statistics.eolTimeline.alreadyEOL / statistics.totalProducts * 100) * 2;
    score += (statistics.eolTimeline.within6Months / statistics.totalProducts * 100) * 1.5;
    
    return Math.min(100, Math.round(score));
  }
  
  /**
   * Calculate data quality score (0-100)
   */
  calculateDataQualityScore(statistics) {
    let score = 0;
    
    // Points for AI enhancement
    score += statistics.aiEnhancement.percentageEnhanced * 0.3;
    
    // Points for confidence levels
    score += (statistics.confidenceAnalysis.high / statistics.totalProducts * 100) * 0.4;
    score += (statistics.confidenceAnalysis.medium / statistics.totalProducts * 100) * 0.2;
    
    // Points for data completeness
    score += (statistics.dataCompleteness.withAllDates / statistics.totalProducts * 100) * 0.3;
    
    return Math.min(100, Math.round(score));
  }
}

module.exports = LifecycleStatisticsCalculator;