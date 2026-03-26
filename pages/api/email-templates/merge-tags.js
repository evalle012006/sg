import { getAllMergeTags } from '../../../services/GlobalMergeTagRegistry';
import EmailTemplateMappingService from '../../../services/booking/EmailTemplateService';

/**
 * ✅ FIXED: API endpoint that combines BOTH sources of merge tags:
 * 1. Static tags from GlobalMergeTagRegistry (guest info, booking details, etc.)
 * 2. Dynamic booking questions from EmailTemplateMappingService (actual form questions)
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  try {
    console.log('📋 Fetching merge tags from both sources...');

    // ✅ SOURCE 1: Get static tags from GlobalMergeTagRegistry
    const staticTags = getAllMergeTags();
    console.log('   ✓ Static tags loaded:', Object.keys(staticTags));

    // ✅ SOURCE 2: Get dynamic booking questions from database
    const bookingQuestions = await EmailTemplateMappingService.getAvailableMergeTags();
    console.log('   ✓ Booking questions loaded:', Object.keys(bookingQuestions || {}));

    // ✅ MERGE: Combine both sources
    const mergedTags = {
      ...staticTags,  // Start with static tags
      ...bookingQuestions  // Add booking questions (may override or add new categories)
    };

    // ✅ If booking questions are in their own category, ensure they're included
    if (bookingQuestions && Object.keys(bookingQuestions).length > 0) {
      // Booking questions might come as a flat object or categorized
      // If they need to be in a specific category, add them:
      if (!mergedTags['Booking Template Questions'] && bookingQuestions['Booking Template Questions']) {
        mergedTags['Booking Template Questions'] = bookingQuestions['Booking Template Questions'];
      }
    }

    console.log('   ✅ Final merged categories:', Object.keys(mergedTags));

    return res.status(200).json({
      success: true,
      data: mergedTags,
      message: 'Merge tags retrieved successfully',
      stats: {
        totalCategories: Object.keys(mergedTags).length,
        totalTags: Object.values(mergedTags).reduce((sum, tags) => sum + (tags?.length || 0), 0),
        staticCategories: Object.keys(staticTags).length,
        dynamicCategories: Object.keys(bookingQuestions || {}).length
      }
    });
  } catch (error) {
    console.error('❌ Error fetching merge tags:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch merge tags',
      error: error.message
    });
  }
}