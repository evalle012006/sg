import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { sortBy } from 'lodash';

// create a slice 
export const templateSlice = createSlice({
    name: "template",
    initialState: {
        template: { name: "New Template", Pages: [] },
        currentPage: null,
        builderMode: "new", // 'new' = new template, 'edit' = edit template - the new template is a temporary status,
        // it will be changed to 'edit' once a new template is created.
        list: [],
        filteredList: []
    },
    reducers: {
        setList: (state, action) => {
            state.list = action.payload;
        },
        setFilteredList: (state, action) => {
            state.filteredList = action.payload;
        },
        updateTemplate: (state, action) => {
            state.template = action.payload;
        },
        removeTemplate: state => {
            state.template = null
        },
        updateCurrentPage: (state, action) => {
            state.currentPage = { ...action.payload, Sections: sortBy(action.payload.Sections, 'order') };
        },
        setCurrentPageDefault: (state) => {
            if (state.template.Pages.length > 0) {
                state.currentPage = state.template.Pages[0];
                state.currentPage.Sections = sortBy(state.currentPage.Sections, 'order');
            }
        },
        updateBuilderMode: (state, action) => {
            state.builderMode = action.payload;
        },
        updatePages: (state, action) => {
            state.template.Pages = action.payload;
        },
        addSection: (state, action) => {
            let pageIndex = state.template.Pages.findIndex(page => page.id === state.currentPage.id);

            if (state.template.Pages[pageIndex].Sections) {
                state.template.Pages[pageIndex].Sections = sortBy([...state.template.Pages[pageIndex].Sections, action.payload]);
            } else {
                state.template.Pages[pageIndex].Sections = [action.payload];
            }

            if (state.currentPage && state.currentPage.Sections) {
                state.currentPage.Sections = sortBy([...state.currentPage.Sections, action.payload], 'order');
            } else {
                state.currentPage.Sections = [action.payload];
            }


        },
        updateSections: (state, action) => {
            let pageIndex = state.template.Pages.findIndex(page => page.id === state.currentPage.id);
            state.currentPage.Sections = action.payload;
            state.template.Pages[pageIndex] = state.currentPage
        },
        addQuestion: (state, action) => {
            let pageIndex = state.template.Pages.findIndex(page => page.id === state.currentPage.id);
            let sectionIndex = state.template.Pages[pageIndex].Sections.findIndex(section => section.id === action.payload.section_id);
            let currentSectionIndex = state.currentPage.Sections.findIndex(section => section.id === action.payload.section_id);
            if (pageIndex && sectionIndex && state.template.Pages[pageIndex].Sections[sectionIndex].Questions) {
                state.template.Pages[pageIndex].Sections[sectionIndex].Questions = [...state.template.Pages[pageIndex].Sections[sectionIndex].Questions, action.payload.question];
                state.currentPage.Sections[currentSectionIndex].Questions = [...state.currentPage.Sections[currentSectionIndex].Questions, action.payload.question];
            } else {
                state.template.Pages[pageIndex].Sections[sectionIndex].Questions = [action.payload.question];
                state.currentPage.Sections[currentSectionIndex].Questions = [action.payload.question];
            }

        },
        updateQuestion: (state, action) => {
            let pageIndex = state.template.Pages.findIndex(page => page.id === state.currentPage.id);
            let sectionIndex = state.template.Pages[pageIndex].Sections.findIndex(section => section.id === action.payload.section_id);
            let questionIndex = state.template.Pages[pageIndex].Sections[sectionIndex].Questions.findIndex(question => question.id === action.payload.id);
            let currentSectionIndex = state.currentPage.Sections.findIndex(section => section.id === action.payload.section_id);
            let currentQuestionIndex = state.currentPage.Sections[currentSectionIndex].Questions.findIndex(question => question.id === action.payload.id);

            state.template.Pages[pageIndex].Sections[sectionIndex].Questions[questionIndex] = action.payload;
            state.currentPage.Sections[currentSectionIndex].Questions[currentQuestionIndex] = action.payload;
        },
        clear: state => {
            state.template = { name: "New Template", Pages: [] };
            state.currentPage = null;
            state.builderMode = "new";
        }
    },
    extraReducers: (builder) => {
        builder
            // .addCase(fetchTemplate.fulfilled, (state, action) => {
            //     state.template = action.payload;
            //     state.builderMode = "edit";

            //     if (state.currentPage == null && state.template.Pages.length > 0) {
            //         state.currentPage = state.template.Pages[0];
            //     }
            //     else if (state.template && state.template.Pages.length > 0) {
            //         let pageIndex = state.template.Pages.findIndex(page => page.id === state.currentPage.id);
            //         state.currentPage = state.template.Pages[pageIndex];
            //     }
            // })
            .addCase(createTemplate.fulfilled, (state, action) => {
                state.template = action.payload;
                state.builderMode = "edit";
            })
            .addCase(addNewPage.fulfilled, (state, action) => {
                state.template.Pages.push(action.payload);
                state.currentPage = action.payload;
            })
    }
})

// export the action
export const templateActions = templateSlice.actions

export const templateReducer = templateSlice.reducer

// update template thunk
export const fetchTemplate = (template_uuid) => async (dispatch, getState) => {

    const state = getState();

    let uuid;
    if (!template_uuid) {
        uuid = getState().builder.template.uuid;
    } else {
        uuid = template_uuid;
    }
    let templateData = await fetch(`/api/booking-templates/${uuid}`)
        .then((response) => response.json())
        .then((data) => data);

    let no_of_questions = 0;
        if (templateData) {
            templateData.Pages.forEach((page, pageIndex) => {
            page.Sections.forEach((section, sectionIndex) => {
                no_of_questions += section.Questions.length;
            });
        });

        templateData.no_of_questions = no_of_questions;

        dispatch(templateActions.updateTemplate(templateData));
        dispatch(templateActions.updateBuilderMode("edit"));

        if (state.builder.currentPage && 'id' in state.builder.currentPage) {
            const currentPage = templateData.Pages.find(page => page.id === state.builder.currentPage.id);
            currentPage && dispatch(templateActions.updateCurrentPage({ ...currentPage, Sections: sortBy([...currentPage?.Sections], 'order') }))
        } else {
            dispatch(templateActions.setCurrentPageDefault());
        }
    }
}

// export const fetchTemplate = createAsyncThunk('template/fetchTemplate', async (template_uuid) => {
//         return await fetch(`/api/booking-templates/${template_uuid}`)
//             .then((response) => response.json())
//             .then((data) => data);
// });

export const createTemplate = createAsyncThunk('template/createTemplate', async (template) => {
    return await fetch("/api/booking-templates/create", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(template),
    })
        .then((res) => res.json())
        .then((data) => data)
});

export const addNewPage = createAsyncThunk('template/addNewPage', async (template_uuid) => {
    return await fetch("/api/booking-templates/" + template_uuid + "/pages/create", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "New Page" }),
    })
        .then((response) => response.json())
        .then((data) => data);
});