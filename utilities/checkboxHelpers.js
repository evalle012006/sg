/**
 * Check if an option label represents a "none" or "not applicable" type selection
 * These options should be mutually exclusive with other selections
 */
export const isNoneTypeOption = (label) => {
  if (!label || typeof label !== 'string') return false;
  
  const normalizedLabel = label.toLowerCase().trim();
  
  // List of patterns that indicate a "none" type option
  const nonePatterns = [
    'not applicable',
    'n/a',
    'none',
    'none of the above',
    'none of these',
    'none of these apply',
    'none of these apply to me',
    'does not apply',
    'do not apply',
    'doesn\'t apply',
    'don\'t apply',
    'no mobility device',  // Specific to your mobility question
    'i don\'t have any',
    'i do not have any',
    'not required',
    'no assistance required',
    'no assistance needed',
  ];
  
  return nonePatterns.some(pattern => 
    normalizedLabel === pattern || 
    normalizedLabel.includes(pattern)
  );
};

/**
 * Process checkbox/multi-select answer to handle "none" type option exclusivity
 * @param {Array} currentAnswer - Current selected options
 * @param {Object} newValue - The new value being selected/deselected { label, value, notAvailableFlag }
 * @param {Array} options - All available options for the field
 * @returns {Array} - Processed answer array with proper exclusivity applied
 */
export const processCheckboxAnswerWithNoneLogic = (currentAnswer, newValue, options) => {
  // Ensure currentAnswer is an array
  let answer = Array.isArray(currentAnswer) ? [...currentAnswer] : [];
  
  const isSelectingNoneType = newValue.notAvailableFlag || isNoneTypeOption(newValue.label);
  
  if (newValue.value) {
    // User is SELECTING an option
    if (isSelectingNoneType) {
      // Selecting a "none" type option - clear all others, keep only this one
      answer = [newValue.label];
    } else {
      // Selecting a regular option - remove any "none" type options first
      answer = answer.filter(existingLabel => {
        // Check if this existing answer is a "none" type
        const option = options?.find(o => o.label === existingLabel);
        const isExistingNoneType = option?.notAvailableFlag || isNoneTypeOption(existingLabel);
        return !isExistingNoneType;
      });
      // Add the new selection
      if (!answer.includes(newValue.label)) {
        answer.push(newValue.label);
      }
    }
  } else {
    // User is DESELECTING an option
    answer = answer.filter(a => a !== newValue.label);
  }
  
  return answer;
};