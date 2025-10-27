import { Setting, Template, Page, Section, Question } from "../../models";
import { QUESTION_KEYS, getAnswerByQuestionKey, findByQuestionKey } from "./question-helper";
import moment from "moment";

/**
 * Service to map booking questions to email template merge tags
 * Dynamically generates available merge tags based on the default booking template
 */
class EmailTemplateMappingService {
  
  /**
   * Static mapping of question keys to merge tag names
   * This provides a centralized mapping for all possible merge tags
   */
  static MERGE_TAG_MAP = {
    // Guest Information
    [QUESTION_KEYS.GUEST_NAME]: 'guest_name',
    [QUESTION_KEYS.GUEST_EMAIL]: 'guest_email',
    [QUESTION_KEYS.GUEST_PHONE]: 'guest_phone',
    [QUESTION_KEYS.GUEST_ADDRESS]: 'guest_address',
    [QUESTION_KEYS.DATE_OF_BIRTH]: 'guest_dob',
    [QUESTION_KEYS.EMERGENCY_CONTACT_NAME]: 'emergency_contact_name',
    [QUESTION_KEYS.EMERGENCY_CONTACT_PHONE]: 'emergency_contact_phone',
    
    // Booking Details
    [QUESTION_KEYS.CHECK_IN_DATE]: 'checkin_date',
    [QUESTION_KEYS.CHECK_OUT_DATE]: 'checkout_date',
    [QUESTION_KEYS.CHECK_IN_OUT_DATE]: 'checkin_checkout_date',
    [QUESTION_KEYS.ARRIVAL_TIME]: 'arrival_time',
    [QUESTION_KEYS.LATE_ARRIVAL]: 'late_arrival',
    [QUESTION_KEYS.ADULTS_COUNT]: 'number_of_adults',
    [QUESTION_KEYS.CHILDREN_COUNT]: 'number_of_children',
    [QUESTION_KEYS.INFANTS_COUNT]: 'number_of_infants',
    [QUESTION_KEYS.ASSISTANCE_ANIMAL]: 'has_assistance_animal',
    [QUESTION_KEYS.ROOM_SELECTION]: 'room_type',
    [QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL]: 'package_type',
    [QUESTION_KEYS.ACCOMMODATION_PACKAGE_COURSES]: 'package_type',
    [QUESTION_KEYS.COURSE_SELECTION]: 'course_name',
    
    // Funding & Support
    [QUESTION_KEYS.FUNDING_SOURCE]: 'funding_source',
    [QUESTION_KEYS.NDIS_NUMBER]: 'ndis_number',
    [QUESTION_KEYS.NDIS_COORDINATOR_NAME]: 'ndis_coordinator_name',
    [QUESTION_KEYS.NDIS_COORDINATOR_EMAIL]: 'ndis_coordinator_email',
    [QUESTION_KEYS.ICARE_NUMBER]: 'icare_number',
    [QUESTION_KEYS.ICARE_COORDINATOR_NAME]: 'icare_coordinator_name',
    [QUESTION_KEYS.ICARE_COORDINATOR_EMAIL]: 'icare_coordinator_email',
    [QUESTION_KEYS.FINANCIAL_ASSISTANCE_REASON]: 'financial_assistance_reason',
    [QUESTION_KEYS.FUNDING_AMOUNT_TRAVEL]: 'funding_amount',
    [QUESTION_KEYS.TRAVEL_GRANT_APPLICATION]: 'applying_travel_grant',
    [QUESTION_KEYS.TRAVEL_GRANT_REASON]: 'travel_grant_reason',
    
    // Goals & Objectives
    [QUESTION_KEYS.GOALS_ACHIEVE]: 'goals',
    [QUESTION_KEYS.REASON_FOR_STAY]: 'reason_for_stay',
    
    // Health Information
    [QUESTION_KEYS.HEALTH_CONDITIONS]: 'health_conditions',
    [QUESTION_KEYS.MEDICATIONS]: 'medications',
    [QUESTION_KEYS.ALLERGIES]: 'allergies',
    [QUESTION_KEYS.DIETARY_REQUIREMENTS]: 'dietary_requirements',
    
    // Care Requirements
    [QUESTION_KEYS.CARE_PLAN_UPLOAD]: 'care_plan_uploaded',
    [QUESTION_KEYS.ICARE_APPROVAL_UPLOAD]: 'icare_approval_uploaded',
    [QUESTION_KEYS.APPROVAL_LETTER_UPLOAD]: 'approval_letter_uploaded',
    
    // Property Information (these are typically static)
    property_name: 'property_name',
    property_address: 'property_address',
    property_phone: 'property_phone',
    property_email: 'property_email',
  };

  /**
   * Category groupings for merge tags (for UI display)
   */
  static MERGE_TAG_CATEGORIES = {
    'Guest Information': [
      'guest_name', 'guest_email', 'guest_phone', 'guest_address', 
      'guest_dob', 'emergency_contact_name', 'emergency_contact_phone'
    ],
    'Booking Details': [
      'booking_reference', 'checkin_date', 'checkout_date', 'checkin_checkout_date',
      'arrival_time', 'late_arrival', 'number_of_adults', 'number_of_children',
      'number_of_infants', 'number_of_guests', 'number_of_nights',
      'has_assistance_animal', 'room_type', 'package_type', 'course_name'
    ],
    'Funding & Support': [
      'funding_source', 'ndis_number', 'ndis_coordinator_name', 'ndis_coordinator_email',
      'icare_number', 'icare_coordinator_name', 'icare_coordinator_email',
      'financial_assistance_reason', 'funding_amount', 'applying_travel_grant',
      'travel_grant_reason'
    ],
    'Goals & Care': [
      'goals', 'reason_for_stay', 'health_conditions', 'medications',
      'allergies', 'dietary_requirements', 'care_plan_uploaded'
    ],
    'Property Information': [
      'property_name', 'property_address', 'property_phone', 'property_email'
    ]
  };

  /**
   * Get the default booking template from settings
   * FIXED: Changed 'key' to 'attribute' to match the Settings model schema
   */
  async getDefaultTemplate() {
    try {
      const setting = await Setting.findOne({
        where: { attribute: 'default_template' }
      });

      if (!setting || !setting.value) {
        throw new Error('Default template not found in settings');
      }

      const templateId = setting.value;
      
      const template = await Template.findOne({
        where: { id: templateId },
        include: [{
          model: Page,
          include: [{
            model: Section,
            include: [{
              model: Question
            }]
          }]
        }],
        order: [[Page, 'order', 'ASC']]
      });

      return template;
    } catch (error) {
      console.error('Error fetching default template:', error);
      throw error;
    }
  }

  /**
   * Get all questions from the default template
   */
  async getAllTemplateQuestions() {
    try {
      const template = await this.getDefaultTemplate();
      
      if (!template || !template.Pages) {
        return [];
      }

      const questions = [];
      
      template.Pages.forEach(page => {
        page.Sections.forEach(section => {
          section.Questions.forEach(question => {
            questions.push({
              id: question.id,
              question_key: question.question_key,
              question: question.question,
              type: question.type,
              section: section.label,
              section_id: section.id,
              page: page.title,
              options: question.options
            });
          });
        });
      });

      return questions;
    } catch (error) {
      console.error('Error getting template questions:', error);
      return [];
    }
  }

  /**
   * Get all available merge tags based on the default template
   * Returns merge tags grouped by category
   */
  async getAvailableMergeTags() {
    try {
      const questions = await this.getAllTemplateQuestions();
      const availableTags = {};

      // Initialize categories
      Object.keys(EmailTemplateMappingService.MERGE_TAG_CATEGORIES).forEach(category => {
        availableTags[category] = [];
      });

      // Add static/system tags
      availableTags['Booking Details'].push({
        label: 'Booking Reference',
        value: '{{booking_reference}}',
        description: 'Unique booking reference number'
      });

      availableTags['Booking Details'].push({
        label: 'Number of Guests',
        value: '{{number_of_guests}}',
        description: 'Total number of guests'
      });

      availableTags['Booking Details'].push({
        label: 'Number of Nights',
        value: '{{number_of_nights}}',
        description: 'Total nights of stay'
      });

      // Property information (static)
      availableTags['Property Information'].push({
        label: 'Property Name',
        value: '{{property_name}}',
        description: 'Name of the property'
      });

      availableTags['Property Information'].push({
        label: 'Property Address',
        value: '{{property_address}}',
        description: 'Property address'
      });

      availableTags['Property Information'].push({
        label: 'Property Phone',
        value: '{{property_phone}}',
        description: 'Property contact phone'
      });

      availableTags['Property Information'].push({
        label: 'Property Email',
        value: '{{property_email}}',
        description: 'Property contact email'
      });

      // Track used merge tags globally to detect duplicates across sections
      const usedMergeTags = new Map(); // key: merge_tag, value: count of usage

      // Map questions to merge tags - NOW SHOWING ALL QUESTIONS
      questions.forEach(question => {
        // Skip questions without question_key
        if (!question.question_key) {
          return;
        }

        let mergeTag;
        let category;

        // Check if question has a predefined merge tag mapping
        if (EmailTemplateMappingService.MERGE_TAG_MAP[question.question_key]) {
          mergeTag = EmailTemplateMappingService.MERGE_TAG_MAP[question.question_key];
          category = this.getCategoryForMergeTag(mergeTag);
        } else {
          // For questions without predefined mapping, use question_key as merge tag
          mergeTag = question.question_key;
          
          // Check if this merge tag already exists (duplicate question_key in different section)
          if (usedMergeTags.has(mergeTag)) {
            // Make it unique by appending section_id
            const count = usedMergeTags.get(mergeTag);
            usedMergeTags.set(mergeTag, count + 1);
            mergeTag = `${question.question_key}_s${question.section_id}`;
          } else {
            usedMergeTags.set(mergeTag, 1);
          }
          
          // Default category for unmapped questions
          category = 'Other Questions';
        }

        // Initialize category if it doesn't exist
        if (!availableTags[category]) {
          availableTags[category] = [];
        }

        availableTags[category].push({
          label: question.question,
          value: `{{${mergeTag}}}`,
          description: `From: ${question.section} (Page: ${question.page})`,
          question_key: question.question_key,
          question_type: question.type,
          section_id: question.section_id
        });
      });

      // Remove empty categories
      Object.keys(availableTags).forEach(category => {
        if (availableTags[category].length === 0) {
          delete availableTags[category];
        }
      });

      return availableTags;
    } catch (error) {
      console.error('Error getting available merge tags:', error);
      return {};
    }
  }

  /**
   * Get the category for a merge tag
   */
  getCategoryForMergeTag(mergeTag) {
    for (const [category, tags] of Object.entries(EmailTemplateMappingService.MERGE_TAG_CATEGORIES)) {
      if (tags.includes(mergeTag)) {
        return category;
      }
    }
    return null;
  }

  /**
   * Resolve merge tags with actual booking data
   * @param {Object} bookingData - Full booking data with relations
   * @param {String} template - Email template string with merge tags
   */
  async resolveMergeTags(bookingData, template) {
    try {
      if (!bookingData || !template) {
        return template;
      }

      const qaPairs = bookingData.Sections?.map(section => section.QaPairs).flat() || [];
      const guest = bookingData.Guest;
      const rooms = bookingData.Rooms || [];

      // Prepare tag values
      const tagValues = {
        // Guest Information
        guest_name: guest ? `${guest.first_name} ${guest.last_name}` : '',
        guest_email: guest?.email || '',
        guest_phone: guest?.phone_number || '',
        guest_address: guest?.address || '',
        
        // Booking Details
        booking_reference: bookingData.reference_id || '',
        alternate_contact_name: bookingData.alternate_contact_name || '',
        alternate_contact_number: bookingData.alternate_contact_number || '',
        
        // Room Information
        number_of_guests: rooms[0]?.total_guests || 0,
        number_of_adults: rooms[0]?.adults || 0,
        number_of_children: rooms[0]?.children || 0,
        number_of_infants: rooms[0]?.infants || 0,
        
        // Property Information (static values)
        property_name: 'Sargood On Collaroy',
        property_address: '1 Pittwater Road, Collaroy, NSW 2097',
        property_phone: '(02) 9972 9999',
        property_email: 'info@sargoodoncollaroy.com.au',
      };

      // Get check-in/out dates
      const checkInOutAnswer = this.getCheckInOutAnswerByKeys(qaPairs);
      if (checkInOutAnswer?.length === 2) {
        tagValues.checkin_date = moment(checkInOutAnswer[0]).format('DD/MM/YYYY');
        tagValues.checkout_date = moment(checkInOutAnswer[1]).format('DD/MM/YYYY');
        tagValues.checkin_checkout_date = `${tagValues.checkin_date} - ${tagValues.checkout_date}`;
        
        // Calculate nights
        const nights = moment(checkInOutAnswer[1]).diff(moment(checkInOutAnswer[0]), 'days');
        tagValues.number_of_nights = nights;
      }

      // Map all question answers to merge tags
      // First, handle predefined mappings
      Object.entries(EmailTemplateMappingService.MERGE_TAG_MAP).forEach(([questionKey, mergeTag]) => {
        const answer = getAnswerByQuestionKey(qaPairs, questionKey);
        if (answer) {
          tagValues[mergeTag] = this.formatAnswerForEmail(answer);
        }
      });

      // Then, handle all other questions using their question_key directly
      // Also handle section-specific tags for duplicate question_keys
      qaPairs.forEach(qaPair => {
        const questionKey = qaPair.Question?.question_key || qaPair.question_key;
        const sectionId = qaPair.section_id;
        
        if (questionKey && !tagValues[questionKey]) {
          // Only add if not already handled by predefined mappings
          const answer = qaPair.answer;
          if (answer) {
            tagValues[questionKey] = this.formatAnswerForEmail(answer);
            
            // Also add section-specific version (for duplicate question_keys)
            if (sectionId) {
              tagValues[`${questionKey}_s${sectionId}`] = this.formatAnswerForEmail(answer);
            }
          }
        } else if (questionKey && sectionId) {
          // If the base key already exists, still add the section-specific version
          const answer = qaPair.answer;
          if (answer) {
            tagValues[`${questionKey}_s${sectionId}`] = this.formatAnswerForEmail(answer);
          }
        }
      });

      // Room type
      if (rooms.length > 0) {
        const roomTypes = rooms.map(room => room.RoomType?.name).filter(Boolean);
        tagValues.room_type = roomTypes.join(', ');
      }

      // Replace all merge tags in template
      let resolvedTemplate = template;
      Object.entries(tagValues).forEach(([tag, value]) => {
        const regex = new RegExp(`{{${tag}}}`, 'g');
        resolvedTemplate = resolvedTemplate.replace(regex, value || '');
      });

      return resolvedTemplate;
    } catch (error) {
      console.error('Error resolving merge tags:', error);
      return template;
    }
  }

  /**
   * Helper to get check-in/out dates from Q&A pairs
   */
  getCheckInOutAnswerByKeys(qaPairs) {
    const combinedAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.CHECK_IN_OUT_DATE);
    if (combinedAnswer) {
      const answerArr = combinedAnswer.split(' - ');
      if (answerArr?.length > 1) {
        return answerArr;
      }
    }
    
    const checkInAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.CHECK_IN_DATE);
    const checkOutAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.CHECK_OUT_DATE);
    
    if (checkInAnswer && checkOutAnswer) {
      return [checkInAnswer, checkOutAnswer];
    }
    
    return null;
  }

  /**
   * Format answer for email display
   * Enhanced to preserve arrays and objects for Handlebars templating
   */
  formatAnswerForEmail(answer) {
    // If already an object or array, return as-is for Handlebars to process
    if (typeof answer === 'object' && answer !== null) {
      return answer;
    }
    
    // Try to parse string as JSON
    if (typeof answer === 'string') {
      try {
        const parsed = JSON.parse(answer);
        // Return parsed arrays and objects as-is for Handlebars
        if (Array.isArray(parsed) || typeof parsed === 'object') {
          return parsed;
        }
        // For primitive values, return the string
        return answer;
      } catch (e) {
        // Not JSON, return as string
        return answer;
      }
    }
    
    // For other types, convert to string
    return String(answer || '');
  }

  /**
   * Validate template merge tags
   * Returns list of invalid/unrecognized tags
   */
  async validateTemplateTags(template) {
    try {
      const availableTags = await this.getAvailableMergeTags();
      const allValidTags = new Set();

      Object.values(availableTags).forEach(category => {
        category.forEach(tag => {
          // Extract tag name from {{tag_name}}
          const tagName = tag.value.replace(/[{}]/g, '');
          allValidTags.add(tagName);
        });
      });

      // Find all merge tags in template
      const tagRegex = /{{([^}]+)}}/g;
      const foundTags = [];
      let match;

      while ((match = tagRegex.exec(template)) !== null) {
        foundTags.push(match[1]);
      }

      // Find invalid tags
      const invalidTags = foundTags.filter(tag => !allValidTags.has(tag));

      return {
        valid: invalidTags.length === 0,
        invalidTags,
        foundTags,
        availableTags: Array.from(allValidTags)
      };
    } catch (error) {
      console.error('Error validating template tags:', error);
      return {
        valid: false,
        invalidTags: [],
        foundTags: [],
        availableTags: []
      };
    }
  }

  /**
   * Get merge tag suggestions based on partial input
   */
  async getMergeTagSuggestions(partial = '') {
    try {
      const availableTags = await this.getAvailableMergeTags();
      const allTags = [];

      Object.entries(availableTags).forEach(([category, tags]) => {
        tags.forEach(tag => {
          allTags.push({
            ...tag,
            category
          });
        });
      });

      if (!partial) {
        return allTags;
      }

      const searchTerm = partial.toLowerCase();
      return allTags.filter(tag => 
        tag.label.toLowerCase().includes(searchTerm) ||
        tag.value.toLowerCase().includes(searchTerm) ||
        tag.description.toLowerCase().includes(searchTerm)
      );
    } catch (error) {
      console.error('Error getting merge tag suggestions:', error);
      return [];
    }
  }
}

// Export singleton instance
export default new EmailTemplateMappingService();
export { EmailTemplateMappingService };