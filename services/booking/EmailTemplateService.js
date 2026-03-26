import { Setting, Template, Page, Section, Question } from "../../models";
import { QUESTION_KEYS, getAnswerByQuestionKey, findByQuestionKey } from "./question-helper";
import moment from "moment";

/**
 * Service to map booking questions to email template merge tags
 * ✅ UPDATED: Single "Booking Template Questions" category (no sub-groupings)
 */
class EmailTemplateMappingService {
  
  /**
   * Normalize tag name by converting hyphens to underscores
   */
  static normalizeTagName(tagName) {
    if (!tagName) return tagName;
    return tagName.replace(/-/g, '_');
  }
  
  /**
   * ✅ SIMPLIFIED: Single category for ALL booking template questions
   */
  static MERGE_TAG_CATEGORIES = {
    'Booking Template Questions': []  // All questions go here
  };

  /**
   * Get the default booking template from settings
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
   * ✅ UPDATED: Get all available merge tags - ALL questions in ONE category
   * Returns merge tags grouped by category
   */
  async getAvailableMergeTags() {
    try {
      const questions = await this.getAllTemplateQuestions();
      
      // ✅ SINGLE CATEGORY: All booking template questions
      const availableTags = {
        'Booking Template Questions': []
      };

      // Track used merge tags to detect duplicates
      const usedMergeTags = new Map();

      // ✅ Map ALL questions to single category
      questions.forEach(question => {
        // Skip questions without question_key
        if (!question.question_key) {
          return;
        }

        // ✅ Normalize to underscore format
        let mergeTag = EmailTemplateMappingService.normalizeTagName(question.question_key);
        
        // Check if this merge tag already exists (duplicate question_key)
        if (usedMergeTags.has(mergeTag)) {
          // Make it unique by appending section_id
          const count = usedMergeTags.get(mergeTag);
          usedMergeTags.set(mergeTag, count + 1);
          mergeTag = `${EmailTemplateMappingService.normalizeTagName(question.question_key)}_s${question.section_id}`;
        } else {
          usedMergeTags.set(mergeTag, 1);
        }

        // ✅ Add ALL questions to single category
        availableTags['Booking Template Questions'].push({
          label: question.question,
          value: `{{${mergeTag}}}`,
          description: `From: ${question.section} (Page: ${question.page})`,
          question_key: question.question_key,
          question_type: question.type,
          section_id: question.section_id
        });
      });

      // Remove category if empty
      if (availableTags['Booking Template Questions'].length === 0) {
        delete availableTags['Booking Template Questions'];
      }

      return availableTags;
    } catch (error) {
      console.error('Error getting available merge tags:', error);
      return {};
    }
  }

  /**
   * Resolve merge tags with actual booking data
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
        guest_first_name: guest?.first_name || '',
        guest_last_name: guest?.last_name || '',
        guest_email: guest?.email || '',
        guest_phone: guest?.phone_number || '',
        guest_address_street1: guest?.address_street1 || '',
        guest_address_street2: guest?.address_street2 || '',
        guest_address_city: guest?.address_city || '',
        guest_address_state: guest?.address_state_province || '',
        guest_address_postal: guest?.address_postal || '',
        guest_address_country: guest?.address_country || '',
        guest_dob: guest?.dob ? moment(guest.dob).format('DD/MM/YYYY') : '',
        guest_gender: guest?.gender || '',
        
        // Booking Details
        booking_reference: bookingData.reference_id || '',
        booking_status: bookingData.status || '',
        booking_status_name: bookingData.status_name || '',
        booking_type: bookingData.type || '',
        booking_name: bookingData.name || '',
        alternate_contact_name: bookingData.alternate_contact_name || '',
        alternate_contact_number: bookingData.alternate_contact_number || '',
        type_of_spinal_injury: bookingData.type_of_spinal_injury || '',
        eligibility: bookingData.eligibility || '',
        eligibility_name: bookingData.eligibility_name || '',
        notes: bookingData.notes || '',
        checklist_notes: bookingData.checklist_notes || '',
        late_arrival: bookingData.late_arrival ? 'Yes' : 'No',
        cancellation_type: bookingData.cancellation_type || '',
        booking_complete: bookingData.complete ? 'Yes' : 'No',
        booking_created_date: bookingData.created_at ? moment(bookingData.created_at).format('DD/MM/YYYY') : '',
        booking_updated_date: bookingData.updated_at ? moment(bookingData.updated_at).format('DD/MM/YYYY') : '',
        
        // Room Information
        number_of_guests: rooms[0]?.total_guests || 0,
        number_of_adults: rooms[0]?.adults || 0,
        number_of_children: rooms[0]?.children || 0,
        number_of_infants: rooms[0]?.infants || 0,
        
        // Property Information (static values)
        property_name: 'Sargood on Collaroy',
        property_address: '1 Pittwater Road, Collaroy NSW 2097',
        property_phone: '(02) 9972 9999',
        property_email: 'info@sargoodoncollaroy.com.au',
        property_website: 'www.sargoodoncollaroy.com.au',
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

      // ✅ Map all question answers to merge tags (normalized to underscores)
      qaPairs.forEach(qaPair => {
        const questionKey = qaPair.Question?.question_key || qaPair.question_key;
        const sectionId = qaPair.section_id;
        
        if (questionKey) {
          // ✅ Normalize to underscore format
          const normalizedKey = EmailTemplateMappingService.normalizeTagName(questionKey);
          
          if (!tagValues[normalizedKey]) {
            const answer = qaPair.answer;
            if (answer) {
              tagValues[normalizedKey] = this.formatAnswerForEmail(answer);
              
              // Also add section-specific version for duplicates
              if (sectionId) {
                tagValues[`${normalizedKey}_s${sectionId}`] = this.formatAnswerForEmail(answer);
              }
              
              // ✅ BACKWARD COMPATIBILITY: Also add hyphenated version for old templates
              if (questionKey.includes('-')) {
                tagValues[questionKey] = this.formatAnswerForEmail(answer);
                if (sectionId) {
                  tagValues[`${questionKey}_s${sectionId}`] = this.formatAnswerForEmail(answer);
                }
              }
            }
          } else if (sectionId) {
            // If base key exists, still add section-specific version
            const answer = qaPair.answer;
            if (answer) {
              tagValues[`${normalizedKey}_s${sectionId}`] = this.formatAnswerForEmail(answer);
              
              // BACKWARD COMPATIBILITY
              if (questionKey.includes('-')) {
                tagValues[`${questionKey}_s${sectionId}`] = this.formatAnswerForEmail(answer);
              }
            }
          }
        }
      });

      // Room type
      if (rooms.length > 0) {
        const roomTypes = rooms.map(room => room.RoomType?.name).filter(Boolean);
        tagValues.room_type = roomTypes.join(', ');
        tagValues.room_name = roomTypes.join(', ');
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
   */
  formatAnswerForEmail(answer) {
    // If already an object or array, return as-is for Handlebars
    if (typeof answer === 'object' && answer !== null) {
      return answer;
    }
    
    // Try to parse string as JSON
    if (typeof answer === 'string') {
      try {
        const parsed = JSON.parse(answer);
        if (Array.isArray(parsed) || typeof parsed === 'object') {
          return parsed;
        }
        return answer;
      } catch (e) {
        return answer;
      }
    }
    
    return String(answer || '');
  }

  /**
   * Validate template merge tags
   */
  async validateTemplateTags(template) {
    try {
      const availableTags = await this.getAvailableMergeTags();
      const allValidTags = new Set();

      Object.values(availableTags).forEach(category => {
        category.forEach(tag => {
          const tagName = tag.value.replace(/[{}]/g, '');
          allValidTags.add(tagName);
          
          // Also accept hyphenated version
          const hyphenatedVersion = tagName.replace(/_/g, '-');
          if (hyphenatedVersion !== tagName) {
            allValidTags.add(hyphenatedVersion);
          }
        });
      });

      // Find all merge tags in template
      const tagRegex = /{{([^}]+)}}/g;
      const foundTags = [];
      let match;

      while ((match = tagRegex.exec(template)) !== null) {
        foundTags.push(match[1]);
      }

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
   * Get merge tag suggestions
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