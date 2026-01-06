import { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { bookingRequestFormActions } from '../store/bookingRequestFormSlice';

/**
 * Enhanced autofill detection hook with improved browser support
 * Works with Chrome, Edge, Firefox, and Safari
 * 
 * CRITICAL: This hook updates Redux AND calls onAutofillDetected callback
 * to ensure parent components (like QuestionPage) can update their local state
 * (like questionInteractions) when autofill happens.
 */
export function useAutofillDetection(options = {}) {
  const {
    onAutofillDetected = null, // Callback when autofill is detected: (fieldId, value, fieldData) => void
    containerSelector = '.min-h-screen.flex.flex-col',
    debounceMs = 100,
  } = options;
  
  const dispatch = useDispatch();
  const currentPage = useSelector(state => state.bookingRequestForm.currentPage);
  const processedPageIdRef = useRef(null);
  const eventListenersRef = useRef([]);
  const observerRef = useRef(null);
  const processedFieldsRef = useRef(new Set());
  const debounceTimerRef = useRef(null);
  // Keep latest callback ref to avoid stale closures
  const onAutofillDetectedRef = useRef(onAutofillDetected);
  
  // Update ref when callback changes
  useEffect(() => {
    onAutofillDetectedRef.current = onAutofillDetected;
  }, [onAutofillDetected]);
  
  // Build field mapping for current page
  const buildFieldMapping = useCallback(() => {
    if (!currentPage) return {};
    
    const fieldMapping = {};
    const currentPageId = currentPage.id;
    
    currentPage.Sections.forEach((section, sectionIndex) => {
      section.Questions.forEach((question, questionIndex) => {
        if (question.hidden) return;
        
        const textCompatibleTypes = ['string', 'text', 'email', 'phone-number', 'year', 'integer', 'number'];
        if (!textCompatibleTypes.includes(question.type)) return;
        
        const fieldData = {
          sectionIndex,
          questionIndex,
          type: question.type,
          question: question.question,
          questionKey: question.question_key,
          pageId: currentPageId,
          questionId: question.id
        };
        
        // Map all possible field identifiers
        const addMapping = (key) => {
          if (key && typeof key === 'string') {
            fieldMapping[key] = fieldData;
          }
        };
        
        // CRITICAL: Input fields use question_id (e.g., 5274) not id (e.g., 84141)
        // Map both to be safe
        addMapping(question.id?.toString());
        addMapping(question.question_id?.toString());
        addMapping(question.question);
        addMapping(question.question_key);
        addMapping(`${question.id}-index`);
        addMapping(`${question.question_id}-index`);  // This is what inputs actually use!
        addMapping(`${question.question}-index`);
        addMapping(`${question.question_key}-index`);
      });
    });
    
    return fieldMapping;
  }, [currentPage]);
  
  useEffect(() => {
    if (!currentPage || typeof window === 'undefined') return;
    
    // Skip if we've already processed this page
    if (processedPageIdRef.current === currentPage.id) {
      return;
    }
    
    const currentPageId = currentPage.id;
    processedPageIdRef.current = currentPageId;
    processedFieldsRef.current = new Set();
    
    const fieldMapping = buildFieldMapping();
    
    // DEBUG: Log the field mapping
    // console.log('🗺️ useAutofillDetection field mapping:', Object.keys(fieldMapping));
    
    // Process a single autofill value with debouncing
    const processAutofillValue = (fieldId, value, source = 'unknown') => {
      const uniqueKey = `${currentPageId}:${fieldId}:${value}`;
      if (processedFieldsRef.current.has(uniqueKey)) return;
      if (!fieldMapping[fieldId]) {
        console.log(`⚠️ Field not in mapping: ${fieldId}`);
        return;
      }
      if (!value || value.trim() === '') return;
      
      processedFieldsRef.current.add(uniqueKey);
      const fieldData = fieldMapping[fieldId];
      
      // console.log(`🔄 Autofill detected [${source}]:`, {
      //   fieldId,
      //   value: value.substring(0, 20) + (value.length > 20 ? '...' : ''),
      //   question: fieldData.question,
      //   type: fieldData.type,
      //   sectionIndex: fieldData.sectionIndex,
      //   questionIndex: fieldData.questionIndex
      // });
      
      // Update in Redux with dirty flag
      dispatch(bookingRequestFormActions.updateSingleField({
        sectionIndex: fieldData.sectionIndex,
        questionIndex: fieldData.questionIndex,
        value: value,
        pageId: currentPageId,
        dirty: true,
        autofilled: true
      }));
      
      // CRITICAL: Call external callback to update parent state (questionInteractions)
      // Use ref to get latest callback and avoid stale closures
      if (onAutofillDetectedRef.current) {
        // console.log(`📞 Calling onAutofillDetected for field: ${fieldId}`, {
        //   sectionIndex: fieldData.sectionIndex,
        //   questionIndex: fieldData.questionIndex
        // });
        onAutofillDetectedRef.current(fieldId, value, fieldData);
      }
    };
    
    // Debounced check for all inputs
    const checkAllInputs = (source) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      debounceTimerRef.current = setTimeout(() => {
        // Try multiple container selectors as fallback
        const selectors = [
          containerSelector,
          '.min-h-screen.flex.flex-col',
          '[class*="booking"]',
          'form',
          '.question-page',
          'main',
          'body'
        ];
        
        let pageContainer = null;
        for (const sel of selectors) {
          pageContainer = document.querySelector(sel);
          if (pageContainer) break;
        }
        
        if (!pageContainer) {
          // console.log('⚠️ No container found with any selector');
          return;
        }
        
        const inputs = pageContainer.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])');
        // console.log(`🔍 Checking ${inputs.length} inputs for autofill [${source}]`);
        
        inputs.forEach(input => {
          const fieldId = input.name || input.id;
          if (!fieldId) {
            // console.log('⚠️ Input without name/id:', input);
            return;
          }
          if (input.value && fieldMapping[fieldId]) {
            processAutofillValue(fieldId, input.value, source);
          } else if (input.value && !fieldMapping[fieldId]) {
            // console.log(`⚠️ Input has value but no mapping: ${fieldId} = "${input.value.substring(0, 20)}"`);
          }
        });
      }, debounceMs);
    };
    
    // METHOD 1: CSS Animation detection (Chrome/Safari)
    const handleAnimationStart = (e) => {
      if (e.animationName === 'onAutoFillStart' || e.animationName === 'autofill') {
        const input = e.target;
        const fieldId = input.name || input.id;
        if (fieldId && input.value) {
          processAutofillValue(fieldId, input.value, 'css-animation');
        }
      }
    };
    
    // METHOD 2: Input event with autofill check
    const handleInput = (e) => {
      const input = e.target;
      // Check if this might be autofill (rapid input without user typing)
      if (input.value && !e.inputType) {
        const fieldId = input.name || input.id;
        if (fieldId && fieldMapping[fieldId]) {
          processAutofillValue(fieldId, input.value, 'input-event');
        }
      }
    };
    
    // METHOD 3: Focus event (Edge compatibility - autofill shows on focus)
    const handleFocus = (e) => {
      const input = e.target;
      // Small delay to let Edge populate the value
      setTimeout(() => {
        const fieldId = input.name || input.id;
        if (fieldId && input.value && fieldMapping[fieldId]) {
          processAutofillValue(fieldId, input.value, 'focus-event');
        }
      }, 50);
    };
    
    // METHOD 4: Change event (backup detection)
    const handleChange = (e) => {
      const input = e.target;
      const fieldId = input.name || input.id;
      if (fieldId && input.value && fieldMapping[fieldId]) {
        // Check if this looks like autofill (value changed without user typing)
        if (!input.dataset.userTyping) {
          processAutofillValue(fieldId, input.value, 'change-event');
        }
      }
    };
    
    // METHOD 5: Keydown tracking to differentiate user typing from autofill
    const handleKeydown = (e) => {
      e.target.dataset.userTyping = 'true';
      // Clear after a short delay
      setTimeout(() => {
        if (e.target) {
          delete e.target.dataset.userTyping;
        }
      }, 100);
    };
    
    // METHOD 6: MutationObserver for value attribute changes (some browsers)
    const setupMutationObserver = () => {
      const pageContainer = document.querySelector(containerSelector);
      if (!pageContainer) return;
      
      observerRef.current = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
            const input = mutation.target;
            const fieldId = input.name || input.id;
            if (fieldId && input.value && fieldMapping[fieldId]) {
              processAutofillValue(fieldId, input.value, 'mutation-observer');
            }
          }
        });
      });
      
      const inputs = pageContainer.querySelectorAll('input:not([type="hidden"])');
      inputs.forEach(input => {
        observerRef.current.observe(input, {
          attributes: true,
          attributeFilter: ['value']
        });
      });
    };
    
    // METHOD 7: Check for :-webkit-autofill pseudo-class (Chrome/Safari/Edge)
    const checkAutofillPseudoClass = () => {
      const pageContainer = document.querySelector(containerSelector);
      if (!pageContainer) return;
      
      try {
        const autofilledInputs = pageContainer.querySelectorAll('input:-webkit-autofill');
        autofilledInputs.forEach(input => {
          const fieldId = input.name || input.id;
          if (fieldId && input.value && fieldMapping[fieldId]) {
            processAutofillValue(fieldId, input.value, 'autofill-pseudo-class');
          }
        });
      } catch (e) {
        // Pseudo-class not supported in this browser
      }
    };
    
    // Attach event listeners to all inputs
    const attachEventListeners = () => {
      const pageContainer = document.querySelector(containerSelector);
      if (!pageContainer) return;
      
      // Document-level animation listener
      document.addEventListener('animationstart', handleAnimationStart);
      
      const inputs = pageContainer.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])');
      
      inputs.forEach(input => {
        const fieldId = input.name || input.id;
        if (!fieldId || !fieldMapping[fieldId]) return;
        
        input.addEventListener('focus', handleFocus);
        input.addEventListener('input', handleInput);
        input.addEventListener('change', handleChange);
        input.addEventListener('keydown', handleKeydown);
        
        eventListenersRef.current.push({
          element: input,
          handlers: { handleFocus, handleInput, handleChange, handleKeydown }
        });
      });
    };
    
    // Add CSS for autofill detection animation
    const addAutofillCSS = () => {
      if (document.getElementById('autofill-detection-styles-enhanced')) return;
      
      const styleEl = document.createElement('style');
      styleEl.id = 'autofill-detection-styles-enhanced';
      styleEl.textContent = `
        @keyframes onAutoFillStart {
          from { opacity: 1; }
          to { opacity: 1; }
        }
        
        @keyframes onAutoFillCancel {
          from { opacity: 1; }
          to { opacity: 1; }
        }
        
        input:-webkit-autofill {
          animation-name: onAutoFillStart !important;
          animation-duration: 0.001s !important;
        }
        
        input:not(:-webkit-autofill) {
          animation-name: onAutoFillCancel !important;
        }
      `;
      document.head.appendChild(styleEl);
    };
    
    // Initialize
    addAutofillCSS();
    
    // Run detection at various intervals to catch different browser behaviors
    const scheduleChecks = () => {
      // Immediate check
      checkAllInputs('initial');
      
      // Staggered checks for different browser timing
      const timeouts = [
        setTimeout(() => checkAllInputs('100ms'), 100),
        setTimeout(() => checkAllInputs('300ms'), 300),
        setTimeout(() => checkAllInputs('500ms'), 500),
        setTimeout(() => checkAllInputs('1000ms'), 1000),
        setTimeout(() => checkAllInputs('2000ms'), 2000), // Edge needs longer
        setTimeout(() => checkAutofillPseudoClass(), 200),
        setTimeout(() => checkAutofillPseudoClass(), 1000),
      ];
      
      return timeouts;
    };
    
    // Setup
    attachEventListeners();
    setupMutationObserver();
    const timeouts = scheduleChecks();
    
    // Cleanup
    return () => {
      // Clear timeouts
      timeouts.forEach(t => clearTimeout(t));
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Remove document listener
      document.removeEventListener('animationstart', handleAnimationStart);
      
      // Clean up event listeners
      eventListenersRef.current.forEach(({ element, handlers }) => {
        if (element) {
          element.removeEventListener('focus', handlers.handleFocus);
          element.removeEventListener('input', handlers.handleInput);
          element.removeEventListener('change', handlers.handleChange);
          element.removeEventListener('keydown', handlers.handleKeydown);
        }
      });
      eventListenersRef.current = [];
      
      // Disconnect observer
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      
      // Only reset if navigating away from this page
      if (processedPageIdRef.current === currentPageId) {
        processedPageIdRef.current = null;
      }
    };
  }, [currentPage, dispatch, buildFieldMapping, containerSelector, debounceMs]);
  
  // Expose a manual trigger for checking autofill
  const triggerAutofillCheck = useCallback(() => {
    const fieldMapping = buildFieldMapping();
    const containerSelector_inner = containerSelector;
    
    const pageContainer = document.querySelector(containerSelector_inner);
    if (!pageContainer || !currentPage) return;
    
    const inputs = pageContainer.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])');
    const autofillValues = {};
    
    inputs.forEach(input => {
      const fieldId = input.name || input.id;
      if (fieldId && input.value && fieldMapping[fieldId]) {
        autofillValues[fieldId] = {
          value: input.value,
          fieldData: fieldMapping[fieldId]
        };
      }
    });
    
    return autofillValues;
  }, [buildFieldMapping, containerSelector, currentPage]);
  
  return { triggerAutofillCheck };
}