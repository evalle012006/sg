import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { bookingRequestFormActions } from '../store/bookingRequestFormSlice';

export function useAutofillDetection() {
  const dispatch = useDispatch();
  const currentPage = useSelector(state => state.bookingRequestForm.currentPage);
  const processedPageIdRef = useRef(null);
  const eventListenersRef = useRef([]);
  
  useEffect(() => {
    if (!currentPage || typeof window === 'undefined') return;
    
    // Skip if we've already processed this page
    if (processedPageIdRef.current === currentPage.id) {
      return;
    }
    
    // Mark this page as being processed
    const currentPageId = currentPage.id;
    processedPageIdRef.current = currentPageId;
    
    // Create field mapping specific to this page only
    const fieldMapping = {};
    
    // Helper to safely add a mapping
    const addMapping = (key, data) => {
      if (key && typeof key === 'string') {
        fieldMapping[key] = data;
      }
    };
    
    // Map fields on this page only
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
          pageId: currentPageId
        };
        
        // Map all possible field identifiers
        addMapping(question.id, fieldData);
        addMapping(question.question, fieldData);
        addMapping(`${question.id}-index`, fieldData);
        addMapping(`${question.question}-index`, fieldData);
      });
    });
    
    // Set of already processed fields to prevent duplicates
    const processedFields = new Set();
    
    // Process a single autofill value
    const processAutofillValue = (fieldId, value) => {
      const uniqueKey = `${fieldId}:${value}`;
      if (processedFields.has(uniqueKey)) return;
      if (!fieldMapping[fieldId]) return;
      
      processedFields.add(uniqueKey);
      const fieldData = fieldMapping[fieldId];
      
      // Update in Redux
      dispatch(bookingRequestFormActions.updateSingleField({
        sectionIndex: fieldData.sectionIndex,
        questionIndex: fieldData.questionIndex,
        value: value,
        pageId: currentPageId
      }));
    };
    
    // Enhanced: Check for already filled fields
    const initialCheck = () => {
      const pageContainer = document.querySelector('.min-h-screen.flex.flex-col');
      if (!pageContainer) return;
      
      const inputs = pageContainer.querySelectorAll('input:not([type="hidden"])');
      inputs.forEach(input => {
        const fieldId = input.name || input.id;
        if (fieldId && input.value && fieldMapping[fieldId]) {
          processAutofillValue(fieldId, input.value);
        }
      });
    };
    
    // NEW: Add event listeners to all inputs for Edge compatibility
    const attachEventListeners = () => {
      const pageContainer = document.querySelector('.min-h-screen.flex.flex-col');
      if (!pageContainer) return;
      
      const inputs = pageContainer.querySelectorAll('input:not([type="hidden"])');
      
      inputs.forEach(input => {
        const fieldId = input.name || input.id;
        if (!fieldId || !fieldMapping[fieldId]) return;
        
        // Focus handler - triggers when user clicks autofilled field in Edge
        const handleFocus = () => {
          setTimeout(() => {
            if (input.value) {
              processAutofillValue(fieldId, input.value);
            }
          }, 50);
        };
        
        // Input handler - triggers on any input change
        const handleInput = () => {
          if (input.value) {
            processAutofillValue(fieldId, input.value);
          }
        };
        
        // Change handler - backup detection
        const handleChange = () => {
          if (input.value) {
            processAutofillValue(fieldId, input.value);
          }
        };
        
        input.addEventListener('focus', handleFocus);
        input.addEventListener('input', handleInput);
        input.addEventListener('change', handleChange);
        
        // Store listeners for cleanup
        eventListenersRef.current.push({
          element: input,
          handlers: { handleFocus, handleInput, handleChange }
        });
      });
    };
    
    // Run checks at multiple intervals to catch Edge autofill
    const timeout1 = setTimeout(initialCheck, 200);
    const timeout2 = setTimeout(initialCheck, 500);
    const timeout3 = setTimeout(initialCheck, 1000);
    const timeout4 = setTimeout(initialCheck, 2000); // Extra for Edge
    
    // Attach event listeners after a short delay
    const listenerTimeout = setTimeout(attachEventListeners, 300);
    
    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
      clearTimeout(timeout4);
      clearTimeout(listenerTimeout);
      
      // Clean up event listeners
      eventListenersRef.current.forEach(({ element, handlers }) => {
        element.removeEventListener('focus', handlers.handleFocus);
        element.removeEventListener('input', handlers.handleInput);
        element.removeEventListener('change', handlers.handleChange);
      });
      eventListenersRef.current = [];
      
      // Only reset if navigating away from this page
      if (processedPageIdRef.current === currentPageId) {
        processedPageIdRef.current = null;
      }
    };
  }, [currentPage, dispatch]);
}