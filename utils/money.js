// Convert rupees to paise (e.g. 12.50 => 1250)
function rupeesToPaise(rupees) {
  const value = parseFloat(rupees);
  if (isNaN(value)) return 0;
  return Math.round(value * 100);
}

// Convert paise to rupees (e.g. 1250 => 12.50)
function paiseToRupees(paise) {
  const value = parseInt(paise);
  if (isNaN(value)) return '0.00';
  return (value / 100).toFixed(2);
}

module.exports = {
  rupeesToPaise,
  paiseToRupees
};
