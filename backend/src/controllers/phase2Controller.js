// backend/src/controllers/phase2Controller.js
const { v4: uuidv4 } = require('uuid');
const Papa = require('papaparse');
const ExcelJS = require('exceljs');
const jobStorage = require('../utils/jobStorage');
const globalFilterService = require('../services/globalFilterService');
const manufacturerIdentifier = require('../utils/manufacturerIdentifier');

// Calculate risk score based on all EOL dates
const calculateRiskScore = (item) => {
  let score = 0;
  const today = new Date();

  // Helper function to check if date is past
  const isPastDate = (dateStr) => {
    if (!dateStr || dateStr === '-') return false;
    try {
      const date = new Date(dateStr);
      return !isNaN(date.getTime()) && date < today;
    } catch {
      return false;
    }
  };

  // Helper function to calculate days until date
  const daysUntil = (dateStr) => {
    if (!dateStr || dateStr === '-') return null;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      return Math.floor((date - today) / (1000 * 60 * 60 * 24));
    } catch {
      return null;
    }
  };

  // Support Coverage (40 points)
  if (item.support_coverage === 'Expired') {
    score += 40;
  }

  // End of Sale (15 points)
  if (isPastDate(item.end_of_sale)) {
    score += 15;
  }

  // Last Day Support (20 points)
  const ldosDays = daysUntil(item.last_day_support);
  if (isPastDate(item.last_day_support)) {
    score += 20;
  } else if (ldosDays !== null && ldosDays < 90) {
    score += 15;
  } else if (ldosDays !== null && ldosDays < 180) {
    score += 10;
  }

  // SW Support (15 points)
  if (isPastDate(item.end_of_sw_support)) {
    score += 15;
  } else {
    const swDays = daysUntil(item.end_of_sw_support);
    if (swDays !== null && swDays < 90) {
      score += 10;
    } else if (swDays !== null && swDays < 180) {
      score += 5;
    }
  }

  // SW Vulnerability (10 points)
  if (isPastDate(item.end_of_sw_vulnerability)) {
    score += 10;
  } else {
    const vulnDays = daysUntil(item.end_of_sw_vulnerability);
    if (vulnDays !== null && vulnDays < 90) {
      score += 7;
    } else if (vulnDays !== null && vulnDays < 180) {
      score += 3;
    }
  }

  return {
    score,
    level: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low'
  };
};

// Calculate data completeness percentage
const calculateDataCompleteness = (items) => {
  const fields = [
    'mfg', 'category', 'asset_type', 'type', 'product_id', 
    'description', 'ship_date', 'qty', 'support_coverage',
    'end_of_sale', 'last_day_support', 'end_of_sw_support', 
    'end_of_sw_vulnerability'
  ];

  let totalFields = items.length * fields.length;
  let filledFields = 0;

  items.forEach(item => {
    fields.forEach(field => {
      if (item[field] && item[field] !== '-' && item[field] !== '') {
        filledFields++;
      }
    });
  });

  return totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
};

// Process Phase 2 Analysis - Transform to Enhanced Inventory
const processPhase2Analysis = async (req, res) => {
  try {
    const { phase1JobId } = req.body;
    
    if (!phase1JobId) {
      return res.status(400).json({ error: 'Phase 1 job ID required' });
    }

    const phase1Job = jobStorage.get(phase1JobId);
    if (!phase1Job) {
      return res.status(404).json({ error: 'Phase 1 data not found' });
    }

    console.log(`Starting Phase 2 Enhanced Inventory for Phase 1 job: ${phase1JobId}`);
    console.log(`Enhancing ${phase1Job.data.length} items`);

    // Ensure all IDs are strings
    const enhancedItems = phase1Job.data.map((item, index) => {
      const riskData = calculateRiskScore(item);
      
      return {
        ...item,
        id: String(item.id || item.ID || item.Id || index + 1),
        end_of_sw_support: item.end_of_sw_support || '-',
        end_of_sw_vulnerability: item.end_of_sw_vulnerability || '-',
        risk_score: riskData.score,
        risk_level: riskData.level,
        last_modified: null,
        modified_by: null
      };
    });

    const summary = {
      totalItems: enhancedItems.length,
      highRiskItems: enhancedItems.filter(item => item.risk_level === 'high').length,
      mediumRiskItems: enhancedItems.filter(item => item.risk_level === 'medium').length,
      lowRiskItems: enhancedItems.filter(item => item.risk_level === 'low').length,
      swSupportExpiring: enhancedItems.filter(item => {
        if (!item.end_of_sw_support || item.end_of_sw_support === '-') return false;
        const days = Math.floor((new Date(item.end_of_sw_support) - new Date()) / (1000 * 60 * 60 * 24));
        return days > 0 && days <= 90;
      }).length,
      swVulnerabilityIssues: enhancedItems.filter(item => {
        if (!item.end_of_sw_vulnerability || item.end_of_sw_vulnerability === '-') return false;
        return new Date(item.end_of_sw_vulnerability) < new Date();
      }).length,
      recentlyModified: 0,
      dataCompleteness: calculateDataCompleteness(enhancedItems)
    };

    const phase2JobId = uuidv4();
    const phase2Job = {
      jobId: phase2JobId,
      phase1Reference: phase1JobId,
      customerName: phase1Job.customerName,
      status: 'completed',
      timestamp: new Date(),
      items: enhancedItems,
      summary,
      savedFilters: [],
      modificationHistory: []
    };

    jobStorage.set(phase2JobId, phase2Job);

    console.log(`Phase 2 Enhanced Inventory complete. Job ID: ${phase2JobId}`);

    res.json({
      jobId: phase2JobId,
      status: 'completed',
      message: 'Phase 2 Enhanced Inventory created successfully',
      summary
    });

  } catch (error) {
    console.error('Phase 2 analysis error:', error);
    res.status(500).json({ 
      error: 'Phase 2 analysis failed', 
      details: error.message 
    });
  }
};

// Update single inventory item
const updateInventoryItem = async (req, res) => {
  const { jobId, itemId } = req.params;
  const { updates } = req.body;

  console.log('Update request received:', { jobId, itemId, updates });

  try {
    const job = jobStorage.get(jobId);
    if (!job) {
      console.error('Job not found:', jobId);
      return res.status(404).json({ error: 'Job not found' });
    }

    const itemIndex = job.items.findIndex(item => 
      String(item.id) === String(itemId)
    );
    
    if (itemIndex === -1) {
      console.error('Item not found:', itemId);
      return res.status(404).json({ error: 'Item not found' });
    }

    // Store previous values for history
    const previousValues = {};
    Object.keys(updates).forEach(key => {
      previousValues[key] = job.items[itemIndex][key];
    });

    // Apply updates
    job.items[itemIndex] = {
      ...job.items[itemIndex],
      ...updates,
      last_modified: new Date().toISOString(),
      modified_by: 'user'
    };

    // Recalculate risk score if any date fields changed
    const dateFields = ['end_of_sale', 'last_day_support', 'end_of_sw_support', 'end_of_sw_vulnerability', 'support_coverage'];
    if (dateFields.some(field => field in updates)) {
      const riskData = calculateRiskScore(job.items[itemIndex]);
      job.items[itemIndex].risk_score = riskData.score;
      job.items[itemIndex].risk_level = riskData.level;
    }

    // Add to modification history
    job.modificationHistory = job.modificationHistory || [];
    job.modificationHistory.push({
      itemId: String(itemId),
      timestamp: new Date().toISOString(),
      updates,
      previousValues,
      user: 'user'
    });

    // Update summary
    job.summary = {
      ...job.summary,
      highRiskItems: job.items.filter(item => item.risk_level === 'high').length,
      mediumRiskItems: job.items.filter(item => item.risk_level === 'medium').length,
      lowRiskItems: job.items.filter(item => item.risk_level === 'low').length,
      recentlyModified: job.modificationHistory.length,
      dataCompleteness: calculateDataCompleteness(job.items)
    };

    jobStorage.set(jobId, job);

    res.json({
      success: true,
      item: job.items[itemIndex],
      summary: job.summary
    });

  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Failed to update item', details: error.message });
  }
};

// Bulk update multiple items
const bulkUpdateItems = async (req, res) => {
  const { jobId } = req.params;
  const { updates } = req.body;

  try {
    const job = jobStorage.get(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const results = [];
    
    updates.forEach(update => {
      const itemIndex = job.items.findIndex(item => 
        String(item.id) === String(update.itemId)
      );
      
      if (itemIndex !== -1) {
        job.items[itemIndex] = {
          ...job.items[itemIndex],
          ...update.updates,
          last_modified: new Date().toISOString(),
          modified_by: 'user'
        };

        const riskData = calculateRiskScore(job.items[itemIndex]);
        job.items[itemIndex].risk_score = riskData.score;
        job.items[itemIndex].risk_level = riskData.level;

        results.push({ itemId: update.itemId, success: true });
      } else {
        results.push({ itemId: update.itemId, success: false, error: 'Item not found' });
      }
    });

    // Update summary
    job.summary = {
      ...job.summary,
      highRiskItems: job.items.filter(item => item.risk_level === 'high').length,
      mediumRiskItems: job.items.filter(item => item.risk_level === 'medium').length,
      lowRiskItems: job.items.filter(item => item.risk_level === 'low').length,
      dataCompleteness: calculateDataCompleteness(job.items)
    };

    jobStorage.set(jobId, job);

    res.json({
      success: true,
      results,
      summary: job.summary
    });

  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Bulk update failed', details: error.message });
  }
};

// Get Phase 2 Results
const getPhase2Results = async (req, res) => {
  const { jobId } = req.params;
  const job = jobStorage.get(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  res.json({
    jobId: job.jobId,
    phase1Reference: job.phase1Reference,
    customerName: job.customerName,
    items: job.items,
    summary: job.summary,
    savedFilters: job.savedFilters || [],
    timestamp: job.timestamp
  });
};

// Get Phase 2 Status
const getPhase2Status = async (req, res) => {
  const { jobId } = req.params;
  const job = jobStorage.get(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  res.json({
    status: job.status,
    jobId: job.jobId,
    customerName: job.customerName,
    timestamp: job.timestamp,
    summary: job.summary
  });
};

// Get modification history
const getModificationHistory = async (req, res) => {
  const { jobId } = req.params;
  const job = jobStorage.get(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  res.json({
    history: job.modificationHistory || []
  });
};

// Analyze and auto-fill missing fields
const analyzeAndFillFields = async (req, res) => {
  const { jobId } = req.params;
  
  try {
    const job = jobStorage.get(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Define keyword mappings
    const categoryKeywords = {
      'Networking - Switch': ['switch', '24-port', '48-port', 'gigabit', 'ethernet switch', 'poe switch'],
      'Networking - Router': ['router', 'routing', 'bgp', 'ospf', 'wan'],
      'Networking - Firewall': ['firewall', 'security appliance', 'utm', 'threat', 'ids', 'ips'],
      'Networking - Wireless': ['wireless', 'wifi', 'access point', 'ap', 'wlan', '802.11'],
      'Server - Rack': ['server', 'rack server', 'poweredge', 'proliant', 'cpu', 'xeon'],
      'Server - Blade': ['blade', 'blade server', 'chassis', 'enclosure'],
      'Storage - SAN': ['san', 'storage area', 'fiber channel', 'fc', 'storage array'],
      'Storage - NAS': ['nas', 'network attached', 'file storage', 'nfs', 'cifs'],
      'Security - Endpoint': ['endpoint', 'antivirus', 'edr', 'anti-malware'],
      'Infrastructure - UPS': ['ups', 'battery', 'power supply', 'uninterruptible'],
      'Infrastructure - PDU': ['pdu', 'power distribution', 'power strip'],
      'Software - OS': ['windows', 'linux', 'ubuntu', 'redhat', 'centos', 'operating system'],
      'Software - Database': ['database', 'sql', 'oracle', 'mysql', 'postgresql', 'mongodb'],
      'Software - Application': ['application', 'software', 'license', 'subscription']
    };

    const typeKeywords = {
      'Hardware': ['server', 'switch', 'router', 'firewall', 'storage', 'rack', 'ups', 'pdu', 'appliance', 'device', 'equipment'],
      'Software': ['license', 'software', 'application', 'subscription', 'os', 'operating system', 'database', 'antivirus'],
      'Network Equipment': ['switch', 'router', 'firewall', 'wireless', 'access point', 'network', 'ethernet'],
      'Security': ['firewall', 'ids', 'ips', 'antivirus', 'security', 'threat', 'endpoint', 'edr'],
      'Infrastructure': ['ups', 'pdu', 'power', 'rack', 'cable', 'infrastructure']
    };

    const manufacturerKeywords = {
      'Cisco': ['cisco', 'catalyst', 'nexus', 'asa', 'meraki', 'webex'],
      'Dell': ['dell', 'poweredge', 'emc', 'vmax', 'unity'],
      'HP': ['hp', 'hpe', 'hewlett', 'proliant', 'aruba'],
      'Microsoft': ['microsoft', 'windows', 'office', 'azure', 'sql server'],
      'VMware': ['vmware', 'vsphere', 'vcenter', 'esxi', 'vsan'],
      'Fortinet': ['fortinet', 'fortigate', 'fortios'],
      'Palo Alto': ['palo alto', 'pan-os', 'panorama'],
      'Juniper': ['juniper', 'junos', 'srx'],
      'NetApp': ['netapp', 'ontap', 'fas', 'aff'],
      'IBM': ['ibm', 'power', 'aix', 'storwize'],
      'Oracle': ['oracle', 'java', 'weblogic', 'database'],
      'Red Hat': ['red hat', 'redhat', 'rhel', 'openshift'],
      'Citrix': ['citrix', 'xenserver', 'netscaler'],
      'F5': ['f5', 'big-ip', 'ltm', 'asm']
    };

    let updatedCount = 0;
    const updatedItems = job.items.map(item => {
      let wasUpdated = false;
      const description = (item.description || '').toLowerCase();
      const productId = (item.product_id || '').toLowerCase();
      const combinedText = `${description} ${productId}`;

      // Auto-fill category if missing
      if (!item.category || item.category === '-' || item.category === '') {
        for (const [category, keywords] of Object.entries(categoryKeywords)) {
          if (keywords.some(keyword => combinedText.includes(keyword))) {
            item.category = category;
            wasUpdated = true;
            break;
          }
        }
      }

      // Auto-fill type if missing
      if (!item.type || item.type === '-' || item.type === '') {
        for (const [type, keywords] of Object.entries(typeKeywords)) {
          if (keywords.some(keyword => combinedText.includes(keyword))) {
            item.type = type;
            wasUpdated = true;
            break;
          }
        }
      }

      // Auto-fill manufacturer if missing
      if (!item.mfg || item.mfg === '-' || item.mfg === '') {
        const identifiedMfg = manufacturerIdentifier.identifyManufacturer(item);
        if (identifiedMfg !== 'Unknown') {
          item.mfg = identifiedMfg;
          wasUpdated = true;
        }
      }

      // Recalculate risk score if updated
      if (wasUpdated) {
        updatedCount++;
        const riskData = calculateRiskScore(item);
        item.risk_score = riskData.score;
        item.risk_level = riskData.level;
        item.last_modified = new Date().toISOString();
        item.modified_by = 'auto-analyzer';
      }

      return item;
    });

    // Update job with analyzed data
    job.items = updatedItems;
    job.analyzed = true;
    job.analyzedAt = new Date().toISOString();
    job.summary = {
      ...job.summary,
      dataCompleteness: calculateDataCompleteness(updatedItems)
    };

    jobStorage.set(jobId, job);

    res.json({
      success: true,
      analyzed: true,
      updatedCount,
      summary: job.summary
    });

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Analysis failed', details: error.message });
  }
};

// ============================================================================
// SAVE FOR PHASE 3 - CLOUD RUN COMPATIBLE VERSION
// ============================================================================
// This is the CRITICAL function that persists Phase 2 data to PostgreSQL
// so that Phase 3 can read it even on a different Cloud Run instance.
// ============================================================================
const saveForPhase3 = async (req, res) => {
  const { jobId } = req.params;
  const { filteredIds, filterName, totalFiltered, totalOriginal } = req.body;
  
  // Get database connection at the top level
  const db = require('../database/dbConnection');
  
  try {
    console.log('='.repeat(60));
    console.log('saveForPhase3 called');
    console.log('  jobId:', jobId);
    console.log('  filterName:', filterName);
    console.log('  totalFiltered:', totalFiltered);
    console.log('  totalOriginal:', totalOriginal);
    console.log('  filteredIds count:', filteredIds?.length);
    console.log('='.repeat(60));
    
    // Get job from in-memory storage
    const job = jobStorage.get(jobId);
    if (!job) {
      console.error('❌ Job not found in memory:', jobId);
      return res.status(404).json({ error: 'Job not found' });
    }

    // Filter items based on the provided IDs
    const filteredItems = job.items.filter(item => 
      filteredIds.includes(String(item.id))
    );
    
    console.log(`Filtered ${filteredItems.length} items from ${job.items.length} total`);

    // Update in-memory storage (for local dev / same-instance requests)
    job.phase3Ready = true;
    job.phase3ReadyAt = new Date().toISOString();
    job.phase3FilteredItems = filteredItems;
    job.phase3FilterName = filterName;
    job.phase3Stats = {
      filtered: totalFiltered,
      original: totalOriginal,
      filterPercentage: Math.round((totalFiltered / totalOriginal) * 100)
    };
    jobStorage.set(jobId, job);

    // ========================================================================
    // CRITICAL: Save to PostgreSQL for Cloud Run cross-instance compatibility
    // ========================================================================
    try {
      // Test database connection first
      console.log('Testing database connection...');
      const connTest = await db.query('SELECT NOW() as current_time');
      console.log('✅ Database connected:', connTest.rows[0].current_time);
      
      // Check if table exists (don't try to create it - migration should have done that)
      const tableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'phase2_jobs'
        ) as exists
      `);
      
      if (!tableCheck.rows[0].exists) {
        console.error('❌ phase2_jobs table does not exist!');
        console.error('   Run the migration: psql $DATABASE_URL -f phase2_jobs_migration.sql');
        // Don't fail - continue with in-memory storage for local dev
        console.warn('⚠️  Continuing with in-memory storage only (will fail on Cloud Run)');
      } else {
        console.log('✅ phase2_jobs table exists');
        
        // Insert or update the job data
        const upsertResult = await db.query(`
          INSERT INTO phase2_jobs (
            job_id, 
            customer_name, 
            phase3_ready, 
            phase3_ready_at, 
            phase3_filter_name, 
            phase3_filtered_items, 
            phase3_stats, 
            all_items,
            created_by_instance,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          ON CONFLICT (job_id) 
          DO UPDATE SET 
            phase3_ready = EXCLUDED.phase3_ready,
            phase3_ready_at = EXCLUDED.phase3_ready_at,
            phase3_filter_name = EXCLUDED.phase3_filter_name,
            phase3_filtered_items = EXCLUDED.phase3_filtered_items,
            phase3_stats = EXCLUDED.phase3_stats,
            all_items = EXCLUDED.all_items,
            updated_at = NOW()
          RETURNING job_id, updated_at
        `, [
          jobId,
          job.customerName || 'Unknown',
          true,
          new Date().toISOString(),
          filterName || null,
          JSON.stringify(filteredItems),
          JSON.stringify(job.phase3Stats),
          JSON.stringify(job.items),
          process.env.K_REVISION || 'local' // Cloud Run instance identifier
        ]);
        
        console.log('✅ Phase 2 job saved to database');
        console.log('   job_id:', upsertResult.rows[0].job_id);
        console.log('   updated_at:', upsertResult.rows[0].updated_at);
        
        // Verify the data was saved correctly
        const verifyResult = await db.query(`
          SELECT 
            job_id,
            phase3_ready,
            jsonb_array_length(phase3_filtered_items) as filtered_count,
            jsonb_array_length(all_items) as total_count
          FROM phase2_jobs 
          WHERE job_id = $1
        `, [jobId]);
        
        if (verifyResult.rows.length > 0) {
          console.log('✅ Verification successful:');
          console.log('   phase3_ready:', verifyResult.rows[0].phase3_ready);
          console.log('   filtered_count:', verifyResult.rows[0].filtered_count);
          console.log('   total_count:', verifyResult.rows[0].total_count);
        }
      }
    } catch (dbError) {
      // Log detailed error but don't fail the request
      console.error('❌ Database save failed:', dbError.message);
      console.error('   Error code:', dbError.code);
      console.error('   Error detail:', dbError.detail);
      console.error('   Full error:', dbError);
      
      // Return a warning in the response
      return res.json({
        success: true,
        phase3Ready: true,
        itemsForPhase3: filteredItems.length,
        filterApplied: filterName,
        warning: 'Data saved to memory but database save failed. Phase 3 may not work on Cloud Run.',
        dbError: dbError.message
      });
    }

    // Success response
    res.json({
      success: true,
      phase3Ready: true,
      itemsForPhase3: filteredItems.length,
      filterApplied: filterName,
      persistedToDatabase: true
    });

  } catch (error) {
    console.error('❌ saveForPhase3 error:', error);
    res.status(500).json({ 
      error: 'Failed to save for Phase 3',
      details: error.message 
    });
  }
};

// Export Phase 2 Results
const exportPhase2Results = async (req, res) => {
  const { jobId } = req.params;
  const { filterName, exportType = 'all', filteredIds } = req.query;
  
  const job = jobStorage.get(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    
    // Determine which items to export
    let itemsToExport = job.items;
    
    if (exportType === 'filtered' && filteredIds) {
      try {
        const ids = JSON.parse(filteredIds);
        const stringIds = ids.map(id => String(id));
        itemsToExport = job.items.filter(item => 
          stringIds.includes(String(item.id))
        );
      } catch (e) {
        console.error('Failed to parse filtered IDs:', e);
        itemsToExport = job.items;
      }
    } else if (exportType === 'modified') {
      const modifiedIds = new Set(
        (job.modificationHistory || []).map(h => String(h.itemId))
      );
      itemsToExport = job.items.filter(item => 
        modifiedIds.has(String(item.id))
      );
    } else if (exportType === 'high-risk') {
      itemsToExport = job.items.filter(item => item.risk_level === 'high');
    }
    
    // Main inventory sheet
    const inventorySheet = workbook.addWorksheet('Enhanced Inventory');
    inventorySheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Risk Level', key: 'risk_level', width: 12 },
      { header: 'Risk Score', key: 'risk_score', width: 12 },
      { header: 'Manufacturer', key: 'mfg', width: 20 },
      { header: 'Category', key: 'category', width: 25 },
      { header: 'Asset Type', key: 'asset_type', width: 20 },
      { header: 'Type', key: 'type', width: 20 },
      { header: 'Product ID', key: 'product_id', width: 20 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Ship Date', key: 'ship_date', width: 15 },
      { header: 'Quantity', key: 'qty', width: 10 },
      { header: 'Support Coverage', key: 'support_coverage', width: 15 },
      { header: 'End of Sale', key: 'end_of_sale', width: 15 },
      { header: 'Last Support Day', key: 'last_day_support', width: 15 },
      { header: 'End SW Support', key: 'end_of_sw_support', width: 15 },
      { header: 'End SW Vulnerability', key: 'end_of_sw_vulnerability', width: 15 },
      { header: 'Last Modified', key: 'last_modified', width: 20 },
      { header: 'Modified By', key: 'modified_by', width: 15 }
    ];
    
    itemsToExport.forEach(item => {
      const row = inventorySheet.addRow(item);
      
      // Color code based on risk level
      if (item.risk_level === 'high') {
        row.getCell('risk_level').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFEE2E2' }
        };
        row.getCell('risk_level').font = { color: { argb: 'FFDC2626' }, bold: true };
        row.getCell('risk_score').font = { color: { argb: 'FFDC2626' }, bold: true };
      } else if (item.risk_level === 'medium') {
        row.getCell('risk_level').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFEF3C7' }
        };
        row.getCell('risk_level').font = { color: { argb: 'FFD97706' }, bold: true };
        row.getCell('risk_score').font = { color: { argb: 'FFD97706' } };
      } else {
        row.getCell('risk_level').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD1FAE5' }
        };
        row.getCell('risk_level').font = { color: { argb: 'FF059669' } };
      }
      
      // Highlight modified items
      if (item.last_modified) {
        row.getCell('last_modified').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0F2FE' }
        };
      }
    });
    
    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 }
    ];
    
    summarySheet.addRow({ metric: 'Export Date', value: new Date().toISOString().split('T')[0] });
    summarySheet.addRow({ metric: 'Customer', value: job.customerName });
    summarySheet.addRow({ metric: 'Export Type', value: exportType });
    summarySheet.addRow({ metric: 'Filter Applied', value: filterName || 'None' });
    summarySheet.addRow({ metric: 'Total Records in System', value: job.items.length });
    summarySheet.addRow({ metric: 'Exported Records', value: itemsToExport.length });
    summarySheet.addRow({ metric: 'High Risk Items', value: itemsToExport.filter(i => i.risk_level === 'high').length });
    summarySheet.addRow({ metric: 'Medium Risk Items', value: itemsToExport.filter(i => i.risk_level === 'medium').length });
    summarySheet.addRow({ metric: 'Low Risk Items', value: itemsToExport.filter(i => i.risk_level === 'low').length });
    summarySheet.addRow({ metric: 'Data Completeness', value: `${calculateDataCompleteness(itemsToExport)}%` });
    summarySheet.addRow({ metric: 'Analyzed', value: job.analyzed ? 'Yes' : 'No' });
    summarySheet.addRow({ metric: 'Phase 3 Ready', value: job.phase3Ready ? 'Yes' : 'No' });
    
    // Style headers for all sheets
    [inventorySheet, summarySheet].forEach(sheet => {
      if (sheet) {
        sheet.getRow(1).font = { bold: true, color: { argb: 'FF002D62' } };
        sheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE5E7EB' }
        };
        sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'left' };
        sheet.getRow(1).height = 25;
        
        // Add borders
        sheet.eachRow((row, rowNumber) => {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
            };
          });
        });
      }
    });

    const filename = `phase2_enhanced_inventory_${job.customerName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed', details: error.message });
  }
};

// GLOBAL FILTER METHODS - Properly integrated with globalFilterService

// Get all saved global filters
const getSavedFilters = async (req, res) => {
  try {
    console.log('Getting all saved filters...');
    const filters = await globalFilterService.getAllFilters();
    console.log(`Found ${filters.length} filters`);
    res.json({ 
      success: true,
      filters: filters 
    });
  } catch (error) {
    console.error('Error loading filters:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to load filters',
      details: error.message
    });
  }
};

// Save a new global filter
const saveFilter = async (req, res) => {
  try {
    const { name, filters } = req.body;
    
    console.log('Saving filter:', name);
    console.log('Filter config:', JSON.stringify(filters, null, 2));
    
    if (!name || !filters) {
      return res.status(400).json({ 
        success: false,
        error: 'Filter name and configuration are required' 
      });
    }
    
    const result = await globalFilterService.saveFilter(name, filters);
    res.json(result);
  } catch (error) {
    console.error('Error saving filter:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to save filter',
      details: error.message
    });
  }
};

// Load a specific filter by name
const loadFilterByName = async (req, res) => {
  try {
    const { filterName } = req.params;
    console.log('Loading filter:', filterName);
    
    const filter = await globalFilterService.getFilter(decodeURIComponent(filterName));
    
    if (!filter) {
      return res.status(404).json({ 
        success: false,
        error: 'Filter not found' 
      });
    }
    
    // Update usage count
    await globalFilterService.updateFilterUsage(filterName);
    
    res.json({ 
      success: true,
      filter: filter 
    });
  } catch (error) {
    console.error('Error loading filter:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to load filter',
      details: error.message
    });
  }
};

// Delete a global filter
const deleteFilter = async (req, res) => {
  try {
    const { filterName } = req.params;
    console.log('Deleting filter:', filterName);
    
    const result = await globalFilterService.deleteFilter(decodeURIComponent(filterName));
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error deleting filter:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete filter',
      details: error.message
    });
  }
};

module.exports = {
  processPhase2Analysis,
  getPhase2Status,
  getPhase2Results,
  updateInventoryItem,
  bulkUpdateItems,
  getModificationHistory,
  exportPhase2Results,
  analyzeAndFillFields,
  saveForPhase3,
  getSavedFilters,
  saveFilter,
  loadFilterByName,
  deleteFilter
};