function classifyProduct(row) {
  const searchString = `${row.product_id || ''} ${row.description || ''}`.toLowerCase();
  
  if (searchString.includes('switch')) return 'Networking - Switch';
  if (searchString.includes('router')) return 'Networking - Router';
  if (searchString.includes('firewall')) return 'Security - Firewall';
  if (searchString.includes('server')) return 'Server - Rack';
  if (searchString.includes('storage')) return 'Storage - SAN';
  if (searchString.includes('software')) return 'Software - Application';
  if (searchString.includes('vmware') || searchString.includes('virtual')) return 'Virtualization';
  
  return 'Uncategorized';
}

function getCategoryConfidence(row, category) {
  return category !== 'Uncategorized' ? 70 : 0;
}

module.exports = {
  classifyProduct,
  getCategoryConfidence
};