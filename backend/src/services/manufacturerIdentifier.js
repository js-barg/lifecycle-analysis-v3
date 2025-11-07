function identifyManufacturer(row) {
  const searchString = `${row.product_id || ''} ${row.description || ''}`.toLowerCase();
  
  if (searchString.includes('cisco')) return 'Cisco';
  if (searchString.includes('hp') || searchString.includes('hewlett')) return 'HPE';
  if (searchString.includes('dell')) return 'Dell';
  if (searchString.includes('microsoft')) return 'Microsoft';
  if (searchString.includes('vmware')) return 'VMware';
  if (searchString.includes('fortinet')) return 'Fortinet';
  if (searchString.includes('palo alto')) return 'Palo Alto';
  
  return 'Unknown';
}

function getManufacturerConfidence(row, manufacturer) {
  return manufacturer !== 'Unknown' ? 75 : 0;
}

module.exports = {
  identifyManufacturer,
  getManufacturerConfidence
};