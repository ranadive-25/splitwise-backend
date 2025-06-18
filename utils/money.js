// Convert rupees to paise (e.g. 12.50 => 1250)
function rupeesToPaise(rupees) {
  return Math.round(parseFloat(rupees) * 100);
}

// Convert paise to rupees (e.g. 1250 => 12.50)
function paiseToRupees(paise) {
  return (parseInt(paise) / 100).toFixed(2);
}

module.exports = {
  rupeesToPaise,
  paiseToRupees
};
