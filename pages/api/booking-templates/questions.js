/**
 * Get Questions from Template API
 * GET /api/booking-templates/questions
 */

import { Setting, Template, Page, Section, Question } from '../../../models';

// Question types to exclude from the list
const EXCLUDED_QUESTION_TYPES = [
  'goal-table',
  'care-table', 
  'simple-checkbox',
  'url',
  'rich-text'
];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  try {
    const { include_options = 'false' } = req.query;
    const shouldIncludeOptions = include_options === 'true';

    const defaultTemplate = await Setting.findOne({ 
      where: { attribute: 'default_template' } 
    });
    
    if (!defaultTemplate) {
      return res.status(404).json({ 
        success: false, 
        message: 'Default template not found' 
      });
    }
    
    const templateId = defaultTemplate.value;

    const template = await Template.findOne({
      where: { id: templateId },
      include: [
        {
          model: Page,
          include: [
            {
              model: Section,
              include: [Question]
            }
          ]
        }
      ],
      order: [
        [Page, 'order', 'ASC'],
        [Page, Section, 'order', 'ASC'],
        [Page, Section, Question, 'order', 'ASC']
      ]
    });

    if (!template) {
      return res.status(404).json({ 
        success: false, 
        message: 'Template not found' 
      });
    }

    const allQuestions = [];
    
    template.Pages.forEach(page => {
      page.Sections.forEach(section => {
        section.Questions.forEach(question => {
          // Skip excluded question types
          if (EXCLUDED_QUESTION_TYPES.includes(question.type)) {
            return;
          }

          const formattedQuestion = {
            id: question.id,
            question: question.question,
            question_key: question.question_key,
            question_type: mapQuestionType(question.type),
            section_id: section.id,
            section_label: section.label,
            page_id: page.id,
            page_title: page.title,
            // Add display label for dropdown
            display_label: `[${page.title} - ${section.label}] ${question.question}`,
            required: question.required,
            order: question.order,
            options: shouldIncludeOptions ? formatOptions(question) : [],
            validation: buildValidation(question)
          };

          allQuestions.push(formattedQuestion);
        });
      });
    });

    return res.status(200).json({
      success: true,
      template_id: templateId,
      template_name: template.name,
      questions: allQuestions,
      total: allQuestions.length
    });

  } catch (error) {
    console.error('Error fetching questions:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message 
    });
  }
}

function mapQuestionType(type) {
  const typeMapping = {
    'string': 'text',
    'text': 'text',
    'email': 'email',
    'phone-number': 'text',
    'number': 'number',
    'integer': 'number',
    'year': 'number',
    'date': 'text',
    'date-range': 'text',
    'time': 'text',
    'select': 'select',
    'multi-select': 'checkbox',
    'radio': 'radio',
    'radio-ndis': 'radio',
    'checkbox': 'checkbox',
    'checkbox-button': 'checkbox',
    'file-upload': 'file',
    'health-info': 'text',
    'rooms': 'select',
    'equipment': 'select',
    'card-selection': 'radio',
    'card-selection-multi': 'checkbox',
    'horizontal-card': 'radio',
    'horizontal-card-multi': 'checkbox',
    'package-selection': 'radio',
    'package-selection-multi': 'checkbox',
    'service-cards': 'radio',
    'service-cards-multi': 'checkbox'
  };

  return typeMapping[type] || 'text';
}

/**
 * Format options for select/radio/checkbox questions
 * Follows the same pattern as the frontend: 
 * const options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
 */
function formatOptions(question) {
  if (!question.options) {
    return [];
  }

  let options = question.options;

  // Parse if it's a string (same logic as frontend)
  if (typeof options === 'string') {
    try {
      options = JSON.parse(options);
    } catch (e) {
      console.error('Error parsing options:', e);
      return [];
    }
  }

  // If it's not an array at this point, return empty
  if (!Array.isArray(options)) {
    return [];
  }

  // Format options to ensure consistent structure
  return options.map(opt => {
    // If option is already an object with label/value
    if (typeof opt === 'object' && opt !== null) {
      return {
        label: opt.label || opt.value || opt.name || String(opt),
        value: opt.value || opt.label || opt.name || String(opt),
        // Preserve any additional properties (like subOptions for service-cards)
        ...(opt.subOptions && { subOptions: opt.subOptions }),
        ...(opt.description && { description: opt.description }),
        ...(opt.icon && { icon: opt.icon })
      };
    }
    
    // If it's a primitive value, convert to label/value format
    return {
      label: String(opt),
      value: String(opt)
    };
  });
}

function buildValidation(question) {
  const validation = {};

  if (question.required) {
    validation.required = true;
  }

  return validation;
}