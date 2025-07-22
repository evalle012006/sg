import { createSlice } from '@reduxjs/toolkit'
import { set } from 'lodash';

// create a slice 
export const bookingRequestFormSlice = createSlice({
    name: "booking-request-form",
    initialState: {
        data: null,
        questionDependencies: [],
        currentPage: null,
        equipmentChanges: [],
        rooms: [],
        bookingType: null,
        bookingSubmitted: false,
        funder: null,
        isNdisFunded: false,
        checkinDate: null,
        checkoutDate: null,
    },
    reducers: {
        setData: (state, action) => {
            state.data = action.payload;

            const index = state.data.findIndex(p => state.currentPage !== null && p.id === state.currentPage?.id);
            if (index > -1) state.currentPage = state.data[index];
            else state.currentPage = state.data[0];
        },
        setQuestionDependencies: (state, action) => {
            state.questionDependencies = action.payload
        },
        setCurrentPage: (state, action) => {
            const index = state.data.findIndex(p => p.id === action.payload?.id);

            if (index > -1) {
                state.data.map((p, idx) => {
                    if (idx === index) {
                        state.data[idx].active = true;
                        state.data[idx].dirty = true;
                        state.currentPage = state.data[idx];
                    } else {
                        state.data[idx].active = false;
                    }
                });
            }
        },
        updatePageData: (state, action) => {
            const pageIndex = state.data.findIndex(p => p.id === state.currentPage?.id);

            state.data.map((temp, index) => {
                if (index === pageIndex) {

                    state.data[index].Sections = action.payload;
                    state.data[index].dirty = true;
                    state.currentPage.Sections = action.payload;
                }
            });
        },
        updateEquipmentChanges: (state, action) => {
            state.equipmentChanges = action.payload;
        },
        clearEquipmentChanges: (state) => {
            state.equipmentChanges = [];
        },
        setRooms: (state, action) => {
            state.rooms = action.payload;
        },
        setBookingType: (state, action) => {
            state.bookingType = action.payload;
        },
        setBookingSubmitted: (state, action) => {
            state.bookingSubmitted = action.payload;
        },
        setFunder: (state, action) => {
            state.funder = action.payload;
        },
        setIsNdisFunded: (state, action) => {
            state.isNdisFunded = action.payload;
        },
        setCheckinDate: (state, action) => {
            state.checkinDate = action.payload;
        },
        setCheckoutDate: (state, action) => {
            state.checkoutDate = action.payload;
        },
        updateAutofillValues: (state, action) => {
            if (!state.data || !state.currentPage) return;
            
            const autofillValues = action.payload;
            const currentPageIndex = state.data.findIndex(p => p.id === state.currentPage.id);
            
            if (currentPageIndex === -1) return;
            
            // Get a copy of the current page
            const updatedCurrentPage = JSON.parse(JSON.stringify(state.currentPage));
            
            // Update each section and question in the current page
            updatedCurrentPage.Sections = updatedCurrentPage.Sections.map(section => {
                section.Questions = section.Questions.map(question => {
                // Try to match question with autofill values using various identifiers
                const fieldId = `${question.id || question.question}-index`;
                const questionId = question.id || '';
                
                // Check if we have an autofill value for this field
                if (
                    autofillValues[fieldId] || 
                    autofillValues[questionId] || 
                    (question.question && autofillValues[question.question]) ||
                    // Try to match just by the ID number
                    (questionId && autofillValues[questionId.toString()])
                ) {
                    const value = autofillValues[fieldId] || 
                                autofillValues[questionId] || 
                                autofillValues[question.question] ||
                                autofillValues[questionId.toString()];
                    
                    console.log(`Updating question "${question.question}" (${questionId}) with value:`, value);
                    
                    // Update the question
                    question.answer = value;
                    question.dirty = true;
                    
                    // Clear any error if this was a required field
                    if (question.required) {
                    question.error = null;
                    }
                }
                
                return question;
                });
                
                return section;
            });
            
            // Update the page in the state
            state.data[currentPageIndex] = updatedCurrentPage;
            state.currentPage = updatedCurrentPage;
        },
        updateField: (state, action) => {
            const { sectionIndex, questionIndex, value, fieldType } = action.payload;
            
            if (!state.currentPage || !state.currentPage.Sections) return;
            
            // Get the current page index
            const currentPageIndex = state.data.findIndex(
            p => p.id === state.currentPage.id
            );
            
            if (currentPageIndex === -1) return;
            
            // Get the question to update
            const question = state.currentPage.Sections[sectionIndex]?.Questions[questionIndex];
            if (!question) return;
            
            // Apply the update with safe handling of different field types
            let processedValue = value;
            
            // For fields that might expect JSON, validate the string isn't trying to parse
            if (question.type === 'checkbox' || question.type === 'checkbox-button' || question.type === 'multi-select') {
                // Don't update these types from autofill
                return;
            }
            
            // Update both in currentPage and in the data array
            state.currentPage.Sections[sectionIndex].Questions[questionIndex].answer = processedValue;
            state.currentPage.Sections[sectionIndex].Questions[questionIndex].dirty = true;
            
            // Also update in the data array
            state.data[currentPageIndex].Sections[sectionIndex].Questions[questionIndex].answer = processedValue;
            state.data[currentPageIndex].Sections[sectionIndex].Questions[questionIndex].dirty = true;
        },
        updateSingleField: (state, action) => {
            const { sectionIndex, questionIndex, value, pageId } = action.payload;
            
            // Safety checks
            if (!state.data) return;
            
            // Find the specific page to update
            const pageIndex = state.data.findIndex(page => page.id === pageId);
            if (pageIndex === -1) {
                console.log(`Page not found: ${pageId}`);
                return;
            }
            
            // Get the page
            const page = state.data[pageIndex];
            
            // Check section exists
            if (!page.Sections[sectionIndex]) {
                console.log(`Section not found: ${sectionIndex}`);
                return;
            }
            
            // Check question exists
            const question = page.Sections[sectionIndex].Questions[questionIndex];
            if (!question) {
                console.log(`Question not found: ${sectionIndex}-${questionIndex}`);
                return;
            }
            
            // Check if this is a compatible field type
            const textCompatibleTypes = ['string', 'text', 'email', 'phone-number', 'year', 'integer', 'number'];
            if (!textCompatibleTypes.includes(question.type)) {
                console.log(`Incompatible field type: ${question.type}`);
                return;
            }

            if (question.type === 'date' || question.type === 'date-range') {
                try {
                // Validate the date string
                const testDate = new Date(value);
                if (isNaN(testDate.getTime())) {
                    console.log(`Invalid date value: ${value}`);
                    return;
                }
                } catch (error) {
                    console.log(`Error parsing date: ${error.message}`);
                    return;
                }
            }
            
            // Update the field
            // console.log(`Updating field: Page ${pageId}, Section ${sectionIndex}, Question ${questionIndex}, Type ${question.type}, Value "${value}"`);
            
            // Update in both places
            page.Sections[sectionIndex].Questions[questionIndex].answer = value;
            page.Sections[sectionIndex].Questions[questionIndex].dirty = true;
            
            // If this is the current page, also update currentPage reference
            if (state.currentPage && state.currentPage.id === pageId) {
                state.currentPage.Sections[sectionIndex].Questions[questionIndex].answer = value;
                state.currentPage.Sections[sectionIndex].Questions[questionIndex].dirty = true;
            }
        }
    }
})

// export the action
export const bookingRequestFormActions = bookingRequestFormSlice.actions;

export const bookingRequestFormReducer = bookingRequestFormSlice.reducer;