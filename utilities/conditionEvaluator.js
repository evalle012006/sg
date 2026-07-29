// utilities/conditionEvaluator.js

/**
 * Single source of truth for dependency evaluation.
 * Replaces: checkAnswerMatch (bookingRequestForm.js, x2 copies) and
 * checkSingleCondition/checkTextCondition/checkExactMatchCondition (email-trigger-matcher.js)
 */

function calculateAge(dobString) {
  if (!dobString) return null;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

function toComparableDate(value) {
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function toComparableNumber(value) {
  const n = parseFloat(value);
  return isNaN(n) ? null : n;
}

/**
 * @param {string} operator - 'equals' | 'not_equals' | 'contains' | 'greater_than' |
 *   'less_than' | 'before' | 'after' | 'age_less_than' | 'age_greater_than'
 * @param {*} expected - dependency.answer (the stored comparison value)
 * @param {*} actual - the user's actual answer to the dependee question
 */
function evaluateCondition(operator = 'equals', expected, actual) {
  // Preserve existing null/"any answer" semantics exactly as today
  if (expected == null || expected === '') {
    return actual != null && actual !== '';
  }

  switch (operator) {
    case 'equals': {
        if (actual == null && expected == null) return true;
        if (actual == null || expected == null) return false;

        // service-cards object format: { "service-value": { selected: true, subOptions: [...] } }
        let serviceData = actual;
        if (typeof actual === 'string' && actual.startsWith('{') && actual.endsWith('}')) {
            try { serviceData = JSON.parse(actual); } catch { serviceData = null; }
        }
        if (serviceData && typeof serviceData === 'object' && !Array.isArray(serviceData)) {
            if (typeof expected === 'string' && expected.includes(':')) {
            const [serviceValue, optionValue] = expected.split(':');
            const service = serviceData[serviceValue];
            if (optionValue === 'yes') return service?.selected === true;
            if (optionValue === 'no') return !service || service.selected === false;
            return service?.selected === true && !!service.subOptions?.includes(optionValue);
            }
            if (typeof expected === 'string' && serviceData[expected] !== undefined) {
            return serviceData[expected].selected === true;
            }
        }

        if (Array.isArray(actual)) return actual.includes(expected);
        if (typeof actual === 'string') {
            try {
            const parsed = JSON.parse(actual);
            if (Array.isArray(parsed)) return parsed.includes(expected);
            if (typeof parsed === 'object' && parsed !== null) return evaluateCondition('equals', expected, parsed);
            } catch { /* not JSON */ }
        }
        return String(actual).trim().toLowerCase() === String(expected).trim().toLowerCase();
        }

    case 'not_equals':
      return !evaluateCondition('equals', expected, actual);

    case 'contains':
      return String(actual ?? '').toLowerCase().includes(String(expected).toLowerCase());

    case 'greater_than': {
      const a = toComparableNumber(actual), e = toComparableNumber(expected);
      return a != null && e != null && a > e;
    }

    case 'less_than': {
      const a = toComparableNumber(actual), e = toComparableNumber(expected);
      return a != null && e != null && a < e;
    }

    case 'before': {
      const a = toComparableDate(actual), e = toComparableDate(expected);
      return a != null && e != null && a < e;
    }

    case 'after': {
      const a = toComparableDate(actual), e = toComparableDate(expected);
      return a != null && e != null && a > e;
    }

    case 'age_less_than': {
      const age = calculateAge(actual);
      const threshold = toComparableNumber(expected);
      return age != null && threshold != null && age < threshold;
    }

    case 'age_greater_than': {
      const age = calculateAge(actual);
      const threshold = toComparableNumber(expected);
      return age != null && threshold != null && age >= threshold;
    }

    default:
      // Unknown operator string in the DB shouldn't silently hide/show wrong — fail safe to legacy equals
      return evaluateCondition('equals', expected, actual);
  }
}

export { evaluateCondition, calculateAge };