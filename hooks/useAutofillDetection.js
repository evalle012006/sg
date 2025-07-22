import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { bookingRequestFormActions } from '../store/bookingRequestFormSlice';

export function useAutofillDetection() {
  const dispatch = useDispatch();
  const currentPage = useSelector(state => state.bookingRequestForm.currentPage);
  // Track the page we've already processed to prevent re-processing
  const processedPageIdRef = useRef(null);
  
  useEffect(() => {
    if (!currentPage || typeof window === 'undefined') return;
    
    // Skip if we've already processed this page
    if (processedPageIdRef.current === currentPage.id) {
      return;
    }
    
    // Mark this page as being processed
    const currentPageId = currentPage.id;
    processedPageIdRef.current = currentPageId;
    
    // console.log(`Setting up autofill detection for page: ${currentPageId}`);
    
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
        // Only map fields that are visible and are text-compatible
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
        
        // Generate numeric-style IDs seen in logs (73984-index)
        const numericIdBase = 73980; // Approximation based on your logs
        addMapping(`${numericIdBase + questionIndex}-index`, fieldData);
      });
    });
    
    // console.log(`Mapped ${Object.keys(fieldMapping).length} fields for autofill detection`);
    
    // Set of already processed fields to prevent duplicates
    const processedFields = new Set();
    
    // Process a single autofill value
    const processAutofillValue = (fieldId, value) => {
      // Skip if already processed or no mapping
      const uniqueKey = `${fieldId}:${value}`;
      if (processedFields.has(uniqueKey)) return;
      if (!fieldMapping[fieldId]) {
        console.log(`Field not in mapping: ${fieldId}`);
        return;
      }
      
      // Mark as processed
      processedFields.add(uniqueKey);
      
      const fieldData = fieldMapping[fieldId];
      // console.log(`Processing autofill for ${fieldId} => ${fieldData.type} field: ${value}`);
      
      // Update in Redux
      dispatch(bookingRequestFormActions.updateSingleField({
        sectionIndex: fieldData.sectionIndex,
        questionIndex: fieldData.questionIndex,
        value: value,
        pageId: currentPageId // Include page ID to ensure we only update this page
      }));
    };
    
    // One-time check for already filled fields (browser might have filled them)
    const initialCheck = () => {
      // Only look at inputs on the current page in the DOM
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
    
    // Run initial check with a slight delay to allow browser autofill
    const initialCheckTimeout = setTimeout(initialCheck, 200);
    
    // One more check a bit later for slow autofills
    const secondCheckTimeout = setTimeout(initialCheck, 1000);
    
    // No continuous monitoring to prevent issues
    
    return () => {
      clearTimeout(initialCheckTimeout);
      clearTimeout(secondCheckTimeout);
      // Only reset processedPageIdRef if we're navigating away from this page
      if (processedPageIdRef.current === currentPageId) {
        processedPageIdRef.current = null;
      }
    };
  }, [currentPage, dispatch]);
}