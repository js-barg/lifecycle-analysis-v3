// lifecycleChartGenerator.js
// Chart generation service for lifecycle reports (simplified for Excel embedding)

class LifecycleChartGenerator {
  /**
   * Generate all charts for the report
   * Note: In a full implementation, this would use chartjs-node-canvas
   * For now, we'll return placeholder data that can be used to create charts in Excel
   */
  async generateAllCharts(data, statistics) {
    const charts = {
      // Chart data that Excel can use to create native charts
      riskDistribution: this.generateRiskDistributionData(statistics),
      lifecycleStatus: this.generateLifecycleStatusData(statistics),
      eolTimeline: this.generateEOLTimelineData(data.products),
      categoryBreakdown: this.generateCategoryData(data.categoryStats),
      manufacturerBreakdown: this.generateManufacturerData(data.manufacturerStats),
      confidenceDistribution: this.generateConfidenceData(statistics),
      supportCoverage: this.generateSupportCoverageData(statistics)
    };
    
    return charts;
  }
  
  /**
   * Generate risk distribution chart data
   */
  generateRiskDistributionData(statistics) {
    return {
      type: 'bar',
      title: 'Risk Level Distribution',
      labels: ['Critical', 'High', 'Medium', 'Low', 'None'],
      data: [
        statistics.riskDistribution.critical,
        statistics.riskDistribution.high,
        statistics.riskDistribution.medium,
        statistics.riskDistribution.low,
        statistics.riskDistribution.none
      ],
      colors: ['#DC3545', '#FD7E14', '#FFC107', '#28A745', '#6C757D']
    };
  }
  
  /**
   * Generate lifecycle status chart data
   */
  generateLifecycleStatusData(statistics) {
    return {
      type: 'pie',
      title: 'Lifecycle Status Distribution',
      labels: ['Current', 'End of Sale', 'End of Support', 'End of Life', 'Unknown'],
      data: [
        statistics.lifecycleDistribution.current,
        statistics.lifecycleDistribution.endOfSale,
        statistics.lifecycleDistribution.endOfSupport,
        statistics.lifecycleDistribution.endOfLife,
        statistics.lifecycleDistribution.unknown
      ],
      colors: ['#10B981', '#FBBF24', '#F97316', '#EF4444', '#6B7280']
    };
  }
  
  /**
   * Generate EOL timeline chart data
   */
  generateEOLTimelineData(products) {
    const timeline = {};
    const currentYear = new Date().getFullYear();
    
    // Group products by EOL year
    products.forEach(product => {
      if (product.last_day_of_support_date) {
        const year = new Date(product.last_day_of_support_date).getFullYear();
        if (year >= currentYear - 2 && year <= currentYear + 5) {
          timeline[year] = (timeline[year] || 0) + 1;
        }
      }
    });
    
    const years = Object.keys(timeline).sort();
    
    return {
      type: 'line',
      title: 'EOL Timeline (Products by Year)',
      labels: years,
      data: years.map(year => timeline[year]),
      colors: ['#EF4444']
    };
  }
  
  /**
   * Generate category breakdown chart data
   */
  generateCategoryData(categoryStats) {
    if (!categoryStats || categoryStats.length === 0) {
      return null;
    }
    
    const top10 = categoryStats.slice(0, 10);
    
    return {
      type: 'bar',
      title: 'Top 10 Categories by Quantity',
      labels: top10.map(c => c.product_category || 'Unknown'),
      data: top10.map(c => c.total_quantity),
      colors: ['#667EEA']
    };
  }
  
  /**
   * Generate manufacturer breakdown chart data
   */
  generateManufacturerData(manufacturerStats) {
    if (!manufacturerStats || manufacturerStats.length === 0) {
      return null;
    }
    
    const top10 = manufacturerStats.slice(0, 10);
    
    return {
      type: 'pie',
      title: 'Top 10 Manufacturers by Quantity',
      labels: top10.map(m => m.manufacturer || 'Unknown'),
      data: top10.map(m => m.total_quantity),
      colors: [
        '#667EEA', '#764BA2', '#F093FB', '#4FACFE',
        '#43E97B', '#FA709A', '#FEE140', '#30CFD0',
        '#A8EDEA', '#FED6E3'
      ]
    };
  }
  
  /**
   * Generate confidence distribution chart data
   */
  generateConfidenceData(statistics) {
    return {
      type: 'bar',
      title: 'Confidence Score Distribution',
      labels: ['High (80-100%)', 'Medium (60-79%)', 'Low (<60%)'],
      data: [
        statistics.confidenceAnalysis.high,
        statistics.confidenceAnalysis.medium,
        statistics.confidenceAnalysis.low
      ],
      colors: ['#10B981', '#FFC107', '#DC3545']
    };
  }
  
  /**
   * Generate support coverage chart data
   */
  generateSupportCoverageData(statistics) {
    return {
      type: 'doughnut',
      title: 'Support Coverage Distribution',
      labels: ['Fully Covered', 'Partially Covered', 'Not Covered'],
      data: [
        statistics.supportCoverage.fullyCovered,
        statistics.supportCoverage.partiallyCovered,
        statistics.supportCoverage.notCovered
      ],
      colors: ['#10B981', '#FFC107', '#DC3545']
    };
  }
}

module.exports = LifecycleChartGenerator;