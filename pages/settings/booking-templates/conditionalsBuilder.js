import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchTemplate } from "../../../store/templateSlice";
import Layout from "../../../components/layout"
import { GetField } from "../../../components/fields";
import SimpleTable from "./../../../components/ui/simpleTable"
import { truncate } from "lodash";
import Modal from "../../../components/ui/genericModal";
import ConditionsTable from "./conditionsTable";
import { toast } from "react-toastify";

export default function ConditionalsBuilder() {

    const router = useRouter();
    const dispatch = useDispatch();

    const { template_uuid, type } = router.query;
    const template = useSelector(state => state.builder.template);

    const [questions, setQuestions] = useState([]);
    const [selectedQuestion, setSelectedQuestion] = useState(null);
    const [filteredQuestions, setFilteredQuestions] = useState([]);

    const [selectedQuestionConditions, setSelectedQuestionConditions] = useState([]);
    const [allQuestionsConditions, setAllQuestionsConditions] = useState([]);

    const [showAddConditionModal, setShowAddConditionModal] = useState(false);
    const [newCondition, setNewCondition] = useState({ question_id: null, answer: null, dependence_id: null });

    const [searchQuestionQuery, setSearchQuestionQuery] = useState("");

    const fieldWithSelectOptions = [
        'select',
        'multi-select',
        'checkbox',
        'checkbox-button',
        'radio',
        'health-info',
        'radio-ndis',
        'card-selection',
        'card-selection-multi',
        'horizontal-card',
        'horizontal-card-multi',
        'service-cards',           
        'service-cards-multi'      
    ];

    const cardSelectionFields = [
        'card-selection',
        'card-selection-multi',
        'horizontal-card',
        'horizontal-card-multi',
        'service-cards',           
        'service-cards-multi'      
    ];

    useEffect(() => {
        if (!template_uuid) {
            return;
        }

        fetchInitialData();
    }, [template_uuid]);

    useEffect(() => {
        // generate conditions array for the selected question
        if (!selectedQuestion || !questions) {
            return;
        }
        generateSelectedQuestionConditions();

    }, [selectedQuestion, questions]);

    useEffect(() => {
        if (!template || !questions) {
            return;
        }

        generateAllQuestionsConditions();
    }, [questions, template])

    const generateSelectedQuestionConditions = () => {
        let conditions = [];

        if (fieldWithSelectOptions.includes(selectedQuestion.type)) {
            const selectedQuestionOptions = typeof selectedQuestion.options == 'string' 
                ? JSON.parse(selectedQuestion.options) 
                : selectedQuestion.options;
            
            selectedQuestion.options && selectedQuestionOptions.map(option => {
                const answerValue = cardSelectionFields.includes(selectedQuestion.type) 
                    ? option.value 
                    : option.label;
                const displayValue = option.label;
                
                // For service-cards, create conditions for Yes/No AND sub-options
                if (selectedQuestion.type === 'service-cards' || selectedQuestion.type === 'service-cards-multi') {
                    // Yes condition (service selected = true)
                    const yesAnswerValue = `${option.value}:yes`;
                    const yesDisplayValue = `${option.label} → Yes`;
                    
                    const existingYesConditions = questions.filter(question =>
                        question.QuestionDependencies.filter(dependency => 
                            dependency.dependence_id === selectedQuestion.id && 
                            dependency.answer === yesAnswerValue
                        ).length > 0
                    );

                    if (existingYesConditions.length) {
                        existingYesConditions.forEach(condition => {
                            conditions.push({
                                question: selectedQuestion.question, 
                                answer: yesDisplayValue,
                                nextQuestion: condition.question || condition.type,
                                isYesNo: true,
                                yesNoValue: 'yes',
                                parentService: option.label,
                                metaData: condition.QuestionDependencies.find(dependency => 
                                    dependency.dependence_id === selectedQuestion.id && 
                                    dependency.answer === yesAnswerValue
                                )
                            });
                        });
                    } else {
                        conditions.push({ 
                            question: selectedQuestion.question, 
                            answer: yesDisplayValue, 
                            type: selectedQuestion.type, 
                            nextQuestion: 'Next Question',
                            isYesNo: true,
                            yesNoValue: 'yes',
                            parentService: option.label,
                            metaData: null 
                        });
                    }

                    // No condition (service selected = false)
                    const noAnswerValue = `${option.value}:no`;
                    const noDisplayValue = `${option.label} → No`;
                    
                    const existingNoConditions = questions.filter(question =>
                        question.QuestionDependencies.filter(dependency => 
                            dependency.dependence_id === selectedQuestion.id && 
                            dependency.answer === noAnswerValue
                        ).length > 0
                    );

                    if (existingNoConditions.length) {
                        existingNoConditions.forEach(condition => {
                            conditions.push({
                                question: selectedQuestion.question, 
                                answer: noDisplayValue,
                                nextQuestion: condition.question || condition.type,
                                isYesNo: true,
                                yesNoValue: 'no',
                                parentService: option.label,
                                metaData: condition.QuestionDependencies.find(dependency => 
                                    dependency.dependence_id === selectedQuestion.id && 
                                    dependency.answer === noAnswerValue
                                )
                            });
                        });
                    } else {
                        conditions.push({ 
                            question: selectedQuestion.question, 
                            answer: noDisplayValue, 
                            type: selectedQuestion.type, 
                            nextQuestion: 'Next Question',
                            isYesNo: true,
                            yesNoValue: 'no',
                            parentService: option.label,
                            metaData: null 
                        });
                    }

                    // Sub-options (if available)
                    if (option.subOptions && option.subOptions.length > 0) {
                        option.subOptions.forEach(subOption => {
                            // Format: "service-value:sub-option-value" to track both service and sub-option
                            const subOptionAnswerValue = `${option.value}:${subOption.value}`;
                            const subOptionDisplayValue = `${option.label} → ${subOption.label}`;
                            
                            const existingSubOptionConditions = questions.filter(question =>
                                question.QuestionDependencies.filter(dependency => 
                                    dependency.dependence_id === selectedQuestion.id && 
                                    dependency.answer === subOptionAnswerValue
                                ).length > 0
                            );

                            if (existingSubOptionConditions.length) {
                                existingSubOptionConditions.forEach(condition => {
                                    conditions.push({
                                        question: selectedQuestion.question, 
                                        answer: subOptionDisplayValue,
                                        nextQuestion: condition.question || condition.type,
                                        isSubOption: true,
                                        parentService: option.label,
                                        metaData: condition.QuestionDependencies.find(dependency => 
                                            dependency.dependence_id === selectedQuestion.id && 
                                            dependency.answer === subOptionAnswerValue
                                        )
                                    });
                                });
                            } else {
                                conditions.push({ 
                                    question: selectedQuestion.question, 
                                    answer: subOptionDisplayValue, 
                                    type: selectedQuestion.type, 
                                    nextQuestion: 'Next Question',
                                    isSubOption: true,
                                    parentService: option.label,
                                    metaData: null 
                                });
                            }
                        });
                    }
                } else {
                    // For non-service-cards, handle as before
                    const existingConditions = questions.filter(question =>
                        question.QuestionDependencies.filter(dependency => 
                            dependency.dependence_id === selectedQuestion.id && 
                            dependency.answer === answerValue
                        ).length > 0
                    );

                    if (existingConditions.length) {
                        existingConditions.forEach(condition => {
                            conditions.push({
                                question: selectedQuestion.question, 
                                answer: displayValue,
                                nextQuestion: condition.question || condition.type,
                                metaData: condition.QuestionDependencies.find(dependency => 
                                    dependency.dependence_id === selectedQuestion.id && 
                                    dependency.answer === answerValue
                                )
                            });
                        });
                    } else {
                        conditions.push({ 
                            question: selectedQuestion.question, 
                            answer: displayValue, 
                            type: selectedQuestion.type, 
                            nextQuestion: 'Next Question', 
                            metaData: null 
                        });
                    }
                }
            });
        }

        setSelectedQuestionConditions(conditions);
    }

    const generateAllQuestionsConditions = () => {
        let conditions = [];

        questions.forEach(selectedQuestion => {
            if (fieldWithSelectOptions.includes(selectedQuestion.type)) {
                const selectedQuestionOptions = typeof selectedQuestion.options == 'string' 
                    ? JSON.parse(selectedQuestion.options) 
                    : selectedQuestion.options;
                
                selectedQuestion.options && selectedQuestionOptions.map(option => {
                    const answerValue = cardSelectionFields.includes(selectedQuestion.type) 
                        ? option.value 
                        : option.label;
                    const displayValue = option.label;
                    
                    if (selectedQuestion.type === 'service-cards' || selectedQuestion.type === 'service-cards-multi') {
                        // Yes conditions
                        const yesAnswerValue = `${option.value}:yes`;
                        const yesDisplayValue = `${option.label} → Yes`;
                        
                        const existingYesConditions = questions.filter(question =>
                            question.QuestionDependencies.filter(dependency => 
                                dependency.dependence_id === selectedQuestion.id && 
                                dependency.answer === yesAnswerValue
                            ).length > 0
                        );

                        if (existingYesConditions.length) {
                            existingYesConditions.forEach(condition => {
                                conditions.push({
                                    question: selectedQuestion.question, 
                                    answer: yesDisplayValue,
                                    nextQuestion: condition.question || condition.type,
                                    isYesNo: true,
                                    yesNoValue: 'yes',
                                    parentService: option.label,
                                    metaData: condition.QuestionDependencies.find(dependency => 
                                        dependency.dependence_id === selectedQuestion.id && 
                                        dependency.answer === yesAnswerValue
                                    )
                                });
                            });
                        }

                        // No conditions
                        const noAnswerValue = `${option.value}:no`;
                        const noDisplayValue = `${option.label} → No`;
                        
                        const existingNoConditions = questions.filter(question =>
                            question.QuestionDependencies.filter(dependency => 
                                dependency.dependence_id === selectedQuestion.id && 
                                dependency.answer === noAnswerValue
                            ).length > 0
                        );

                        if (existingNoConditions.length) {
                            existingNoConditions.forEach(condition => {
                                conditions.push({
                                    question: selectedQuestion.question, 
                                    answer: noDisplayValue,
                                    nextQuestion: condition.question || condition.type,
                                    isYesNo: true,
                                    yesNoValue: 'no',
                                    parentService: option.label,
                                    metaData: condition.QuestionDependencies.find(dependency => 
                                        dependency.dependence_id === selectedQuestion.id && 
                                        dependency.answer === noAnswerValue
                                    )
                                });
                            });
                        }

                        // Sub-option conditions
                        if (option.subOptions && option.subOptions.length > 0) {
                            option.subOptions.forEach(subOption => {
                                const subOptionAnswerValue = `${option.value}:${subOption.value}`;
                                const subOptionDisplayValue = `${option.label} → ${subOption.label}`;
                                
                                const existingSubOptionConditions = questions.filter(question =>
                                    question.QuestionDependencies.filter(dependency => 
                                        dependency.dependence_id === selectedQuestion.id && 
                                        dependency.answer === subOptionAnswerValue
                                    ).length > 0
                                );

                                if (existingSubOptionConditions.length) {
                                    existingSubOptionConditions.forEach(condition => {
                                        conditions.push({
                                            question: selectedQuestion.question, 
                                            answer: subOptionDisplayValue,
                                            nextQuestion: condition.question || condition.type,
                                            isSubOption: true,
                                            parentService: option.label,
                                            metaData: condition.QuestionDependencies.find(dependency => 
                                                dependency.dependence_id === selectedQuestion.id && 
                                                dependency.answer === subOptionAnswerValue
                                            )
                                        });
                                    });
                                }
                            });
                        }
                    } else {
                        const existingConditions = questions.filter(question =>
                            question.QuestionDependencies.filter(dependency => 
                                dependency.dependence_id === selectedQuestion.id && 
                                dependency.answer === answerValue
                            ).length > 0
                        );

                        if (existingConditions.length) {
                            existingConditions.forEach(condition => {
                                conditions.push({
                                    question: selectedQuestion.question, 
                                    answer: displayValue,
                                    nextQuestion: condition.question || condition.type,
                                    metaData: condition.QuestionDependencies.find(dependency => 
                                        dependency.dependence_id === selectedQuestion.id && 
                                        dependency.answer === answerValue
                                    )
                                });
                            });
                        }
                    }
                });
            }
        });

        setAllQuestionsConditions(conditions);
    }

    const fetchInitialData = () => {
        // fetches the template if template_uuid is passed in the url
        dispatch(fetchTemplate(template_uuid));
    }

    useEffect(() => {
        if (!template.uuid) {
            return;
        }

        const questionsData = template.Pages.map(page => page.Sections.map(section => section.Questions.flat()).flat()).flat(); // extracting all questions from the template
        questionsData.sort((a, b) => { return a.section_id - b.section_id; });
        setQuestions(questionsData);
        setFilteredQuestions(questionsData);
    }, [template])

    useEffect(() => {
        setFilteredQuestions(() => {
            if (searchQuestionQuery === '' || searchQuestionQuery.length === 0) {
                return questions;
            }
            return questions.filter(question => question.question.toLowerCase().includes(searchQuestionQuery.toLowerCase()));
        });
    }, [searchQuestionQuery, questions]);

    const filterQuestions = (query) => {
        if (!query || query.length === 0) {
            setFilteredQuestions(questions);
            return;
        }

        return questions.filter(question => question.question.toLowerCase().includes(searchQuestionQuery.toLowerCase()));
    }

    useEffect(() => {
        if (!newCondition.question_id || !newCondition.dependence_id || !newCondition.answer) {
            return;
        }

        saveNewCondition();
    }, [newCondition])

    const saveNewCondition = async () => await fetch('/api/booking-templates/questions/dependencies/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(newCondition)
    }).then(res => dispatch(fetchTemplate(template_uuid)));

    const selectedQuestionOptions = typeof selectedQuestion?.options == 'string' ? JSON.parse(selectedQuestion?.options) : selectedQuestion?.options;
    
    return (
        <Layout hideTitleBar={true}>
            <div className="grid grid-cols-12">
                <div className="col-span-9">
                    <div className="py-6 px-10 border border-transparent border-b-gray-300 flex justify-between space-x-4 w-full">
                        <div>
                            <p className="label">Template Name</p>
                            <p className="text-xl">{template.name}</p>
                        </div>
                        <div>
                            <p className="label">Questions</p>
                            <p className="text-xl">{template.no_of_questions}</p>
                        </div>
                    </div>
                    <div>
                        <div className="py-6 px-10 w-full">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl mb-5 text-sargood-blue font-bold">Selected Question {selectedQuestion ? '(Q.' + selectedQuestion.id + ')' : ''}</h3>
                                <button className="bg-sky-800 px-3.5 py-2.5 text-white rounded-md mb-10 disabled:bg-gray-400"
                                    disabled={!selectedQuestion}
                                    onClick={() => {
                                        setNewCondition({ question_id: null, answer: null, dependence_id: null });
                                        setShowAddConditionModal(true)
                                    }}>+ New Condition</button>
                            </div>
                            <div>
                                {selectedQuestion ?
                                    <div>
                                        <div className="bg-stone-50 p-10">
                                            <div className="relative">
                                                <p className="absolute top-0 right-0 bg-blue-300 text-white rounded-md p-1 px-2 w-fit">preview</p>
                                                <GetField type={selectedQuestion.type} label={selectedQuestion.question} options={selectedQuestion.options} hideoptions={true} />
                                            </div>
                                        </div>
                                        <h3 className="py-10 text-xl text-sargood-blue font-bold">Conditions for Q.{selectedQuestion?.id}</h3>
                                        {selectedQuestionConditions.length > 0 ? <ConditionsTable
                                            columns={[
                                                { label: 'Response', attribute: 'answer' },
                                                { label: 'Next Question', attribute: 'nextQuestion' }]}
                                            data={selectedQuestionConditions} /> :
                                            <div>
                                                No conditions found for this question
                                            </div>}
                                    </div> :
                                    <div className="text-center">
                                        Please select one of questions from the right panel to manage conditions
                                    </div>}
                            </div>

                            {allQuestionsConditions &&
                                <div>
                                    <h3 className="py-10 text-xl text-sargood-blue font-bold">Template Conditions</h3>
                                    <SimpleTable
                                        columns={[{ label: 'Question', attribute: 'question' },
                                        { label: 'Response', attribute: 'answer' },
                                        { label: 'Next Question', attribute: 'nextQuestion' }]}
                                        data={allQuestionsConditions} />
                                </div>}
                        </div>
                    </div>
                </div>
                <div className="relative col-span-3">
                    <div className="scrollbar-hidden h-screen fixed top-0 right-0 bg-white w-[25em] border border-transparent border-l-gray-300 overflow-y-scroll">
                        <div className="px-10 py-6">
                            <GetField type="text" value={searchQuestionQuery} placeholder="Search..." onChange={(value) => setSearchQuestionQuery(value)} />

                            <div className="questions">
                                {filteredQuestions.map((question, index) => (
                                    <div key={index} className={`question p-5 mb-5 hover:bg-stone-50 border border-stone-300 rounded-xl cursor-pointer
                                        ${selectedQuestion?.id === question.id ? 'bg-blue-50 border-blue-300' : ''}`}
                                        onClick={() => setSelectedQuestion(question)}>
                                        <div className="flex justify-between items-center">
                                            {/* <label className="label">Q.{question.id}</label> */}
                                            {/* <label className="bg-sargood-blue/10 rounded-md p-1 px-2">{question.type}</label> */}
                                        </div>
                                        <p>{truncate(question.question, { length: 70 })}</p>
                                    </div>)
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* UPDATED MODAL WITH SERVICE-CARDS YES/NO + SUB-OPTIONS SUPPORT */}
            {showAddConditionModal &&
                <Modal
                    confirmLabel="Add Condition"
                    title="Add Condition"
                    description="Select the relevant option, the next question and click on Add Condition"
                    onClose={() => {
                        setNewCondition({ question_id: null, answer: null, dependence_id: null });
                        setShowAddConditionModal(false);
                    }}
                    onConfirm={() => {
                        if (!newCondition.answer) {
                            toast.error('Please select/input an answer from the selected question');
                        } else if (!newCondition.question_id) {
                            toast.error('Please select next question on the right side panel.');
                        } else {
                            setShowAddConditionModal(false);
                            setNewCondition({ ...newCondition, dependence_id: selectedQuestion.id });
                        }
                    }}>
                    <div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="overflow-y-auto" style={{ maxHeight: '500px' }}>
                                <p className="text-xl mb-5">Q.{selectedQuestion.id} {selectedQuestion.question}</p>
                                
                                {/* Regular options display for non-service-cards questions */}
                                {selectedQuestion?.options && 
                                 selectedQuestion.type !== 'service-cards' && 
                                 selectedQuestion.type !== 'service-cards-multi' &&
                                 selectedQuestionOptions.map((option, index) => (
                                    <div key={index} className="flex items-center space-x-2 mb-5">
                                        <input 
                                            type="radio" 
                                            name="answer" 
                                            id={`option-${index}`}
                                            onChange={() => setNewCondition({ 
                                                ...newCondition, 
                                                answer: cardSelectionFields.includes(selectedQuestion.type) 
                                                    ? option.value 
                                                    : option.label 
                                            })} 
                                        />
                                        <label htmlFor={`option-${index}`} className="cursor-pointer">{option.label}</label>
                                    </div>
                                ))}
                                
                                {/* Enhanced display for service-cards questions with YES/NO + sub-options */}
                                {selectedQuestion?.options && 
                                 (selectedQuestion.type === 'service-cards' || 
                                  selectedQuestion.type === 'service-cards-multi') &&
                                 selectedQuestionOptions.map((option, optionIndex) => (
                                    <div key={optionIndex} className="mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50">
                                        {/* Service name header */}
                                        <div className="mb-3">
                                            <h4 className="font-bold text-gray-800 text-base mb-2">{option.label}</h4>
                                        </div>
                                        
                                        {/* Yes/No options - ALWAYS shown */}
                                        <div className="space-y-2 mb-3">
                                            {/* Yes option */}
                                            <div className="flex items-center space-x-2 p-2 bg-green-50 rounded border-l-4 border-green-500">
                                                <input 
                                                    type="radio" 
                                                    name="answer" 
                                                    id={`yes-${optionIndex}`}
                                                    checked={newCondition.answer === `${option.value}:yes`}
                                                    onChange={() => setNewCondition({ 
                                                        ...newCondition, 
                                                        answer: `${option.value}:yes`
                                                    })} 
                                                />
                                                <label htmlFor={`yes-${optionIndex}`} className="font-medium text-gray-800 cursor-pointer flex-1">
                                                    Yes
                                                </label>
                                            </div>
                                            
                                            {/* No option */}
                                            <div className="flex items-center space-x-2 p-2 bg-red-50 rounded border-l-4 border-red-500">
                                                <input 
                                                    type="radio" 
                                                    name="answer" 
                                                    id={`no-${optionIndex}`}
                                                    checked={newCondition.answer === `${option.value}:no`}
                                                    onChange={() => setNewCondition({ 
                                                        ...newCondition, 
                                                        answer: `${option.value}:no`
                                                    })} 
                                                />
                                                <label htmlFor={`no-${optionIndex}`} className="font-medium text-gray-800 cursor-pointer flex-1">
                                                    No
                                                </label>
                                            </div>
                                        </div>
                                        
                                        {/* Sub-options (if available) */}
                                        {option.subOptions && option.subOptions.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-gray-300">
                                                <p className="text-xs text-gray-600 uppercase tracking-wide mb-2 font-semibold">
                                                    📋 SUB-OPTIONS:
                                                </p>
                                                <div className="space-y-1">
                                                    {option.subOptions.map((subOption, subIndex) => (
                                                        <div 
                                                            key={subIndex} 
                                                            className="flex items-center space-x-2 p-2 hover:bg-white rounded"
                                                        >
                                                            <input 
                                                                type="radio" 
                                                                name="answer" 
                                                                id={`sub-${optionIndex}-${subIndex}`}
                                                                checked={newCondition.answer === `${option.value}:${subOption.value}`}
                                                                onChange={() => setNewCondition({ 
                                                                    ...newCondition, 
                                                                    answer: `${option.value}:${subOption.value}` 
                                                                })} 
                                                            />
                                                            <label 
                                                                htmlFor={`sub-${optionIndex}-${subIndex}`}
                                                                className="text-sm text-gray-700 cursor-pointer flex-1"
                                                            >
                                                                {subOption.label}
                                                            </label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            
                            <div className="flex flex-col">
                                <p className="text-xl mb-3">Next Question</p>
                                <div className="border border-stone-100 flex-1 overflow-y-auto p-2" style={{ maxHeight: '500px' }}>
                                    {questions && questions.map((question, index) => (
                                        <div key={index} className="flex items-center space-x-2 mb-3">
                                            <input 
                                                type="radio" 
                                                name="next-question" 
                                                id={`next-${question.id}`}
                                                onChange={() => setNewCondition({ 
                                                    ...newCondition, 
                                                    question_id: question.id 
                                                })} 
                                            />
                                            <label htmlFor={`next-${question.id}`} className="cursor-pointer text-sm">
                                                Q {question.id}. {question.question || question.type}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal>
            }
        </Layout >
    )
}