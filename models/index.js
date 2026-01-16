'use strict';

const Sequelize = require('sequelize');
const accessTokenModel = require('./accesstoken');
const addressModel = require('./address');
const bookingModel = require('./booking');
const bookingEquipmentModel = require('./bookingequipment')
const checklistModel = require('./checklist')
const checklistactionModel = require('./checklistaction')
const checklistTemplateModel = require('./checklisttemplate')
const equipmentModel = require('./equipment')
const equipmentCategoryModal = require('./equipmentcategory');
const guestModel = require('./guest');
const modelHasRolesModel = require('./modelhasrole')
const pageModel = require('./page')
const permissionsModel = require('./permission');
const qapairModel = require('./qapair')
const questionModel = require('./question')
const questionTypeModel = require('./questiontype')
const questionDependencyModel = require('./questiondependency')
const roleHasPermissionsModel = require('./rolehaspermission')
const rolesModel = require('./role')
const roomModel = require('./room')
const roomTypeModel = require('./roomtype')
const templateModel = require('./template')
const userModel = require('./user')
const settingModel = require('./setting');
const sectionModel = require('./section');
const emailTriggerModel = require('./emailtrigger');
const supplierModel = require('./supplier');
const commentModel = require('./comment');
const notificationLibraryModel = require('./notificationlibrary');
const notificationModel = require('./notification');
const logModel = require('./log');
const healthInfo = require('./healthinfo');
const packageModel = require('./package');
const courseModel = require('./course');
const courseOfferModel = require('./courseoffer');
const courseRateModel = require('./courserate');
const packageRequirementModel = require('./packagerequirement');
// REMOVED: const guestApprovalModel = require('./guestapproval');
const promotionModel = require('./promotion');
const emailTemplateModel = require('./emailtemplate');
const emailTriggerQuestionModel = require('./emailtriggerquestion');
const bookingApprovalUsageModel = require('./bookingapprovalusage');
const fundingApprovalModel = require('./fundingapproval');
// REMOVED: const guestApprovalFundingApprovalModel = require('./guestapprovalfundingapproval');
const courseEOIModel = require('./courseeoi');

const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.js')[env];

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

const AccessToken = accessTokenModel(sequelize, Sequelize.DataTypes);
const Address = addressModel(sequelize, Sequelize.DataTypes);
const Booking = bookingModel(sequelize, Sequelize.DataTypes)
const BookingEquipment = bookingEquipmentModel(sequelize, Sequelize.DataTypes)
const Checklist = checklistModel(sequelize, Sequelize.DataTypes)
const ChecklistAction = checklistactionModel(sequelize, Sequelize.DataTypes)
const ChecklistTemplate = checklistTemplateModel(sequelize, Sequelize.DataTypes)
const Equipment = equipmentModel(sequelize, Sequelize.DataTypes)
const EquipmentCategory = equipmentCategoryModal(sequelize, Sequelize.DataTypes)
const Guest = guestModel(sequelize, Sequelize.DataTypes)
const ModelHasRole = modelHasRolesModel(sequelize, Sequelize.DataTypes)
const Page = pageModel(sequelize, Sequelize.DataTypes)
const Permission = permissionsModel(sequelize, Sequelize.DataTypes)
const QaPair = qapairModel(sequelize, Sequelize.DataTypes)
const Question = questionModel(sequelize, Sequelize.DataTypes)
const QuestionType = questionTypeModel(sequelize, Sequelize.DataTypes)
const QuestionDependency = questionDependencyModel(sequelize, Sequelize.DataTypes)
const Role = rolesModel(sequelize, Sequelize.DataTypes)
const RoleHasPermission = roleHasPermissionsModel(sequelize, Sequelize.DataTypes)
const Room = roomModel(sequelize, Sequelize.DataTypes)
const RoomType = roomTypeModel(sequelize, Sequelize.DataTypes)
const Template = templateModel(sequelize, Sequelize.DataTypes)
const User = userModel(sequelize, Sequelize.DataTypes)
const Setting = settingModel(sequelize, Sequelize.DataTypes)
const Section = sectionModel(sequelize, Sequelize.DataTypes)
const EmailTrigger = emailTriggerModel(sequelize, Sequelize.DataTypes)
const Supplier = supplierModel(sequelize, Sequelize.DataTypes)
const Comment = commentModel(sequelize, Sequelize.DataTypes)
const NotificationLibrary = notificationLibraryModel(sequelize, Sequelize.DataTypes)
const Notification = notificationModel(sequelize, Sequelize.DataTypes)
const Log = logModel(sequelize, Sequelize.DataTypes)
const HealthInfo = healthInfo(sequelize, Sequelize.DataTypes);
const Package = packageModel(sequelize, Sequelize.DataTypes);
const Course = courseModel(sequelize, Sequelize.DataTypes);
const CourseOffer = courseOfferModel(sequelize, Sequelize.DataTypes);
const CourseRate = courseRateModel(sequelize, Sequelize.DataTypes);
const PackageRequirement = packageRequirementModel(sequelize, Sequelize.DataTypes);
// REMOVED: const GuestApproval = guestApprovalModel(sequelize, Sequelize.DataTypes);
const Promotion = promotionModel(sequelize, Sequelize.DataTypes);
const EmailTemplate = emailTemplateModel(sequelize, Sequelize.DataTypes);
const EmailTriggerQuestion = emailTriggerQuestionModel(sequelize, Sequelize.DataTypes);
const BookingApprovalUsage = bookingApprovalUsageModel(sequelize, Sequelize.DataTypes);
const FundingApproval = fundingApprovalModel(sequelize, Sequelize.DataTypes);
// REMOVED: const GuestApprovalFundingApproval = guestApprovalFundingApprovalModel(sequelize, Sequelize.DataTypes);
const CourseEOI = courseEOIModel(sequelize, Sequelize.DataTypes);

//ASSOCIATIONS

// Role & Permission associations
Role.belongsToMany(Permission, { through: RoleHasPermission, foreignKey: 'role_id' });
Permission.belongsToMany(Role, { through: RoleHasPermission, foreignKey: 'permission_id' });

// Email Trigger & Template associations
EmailTrigger.belongsTo(EmailTemplate, { foreignKey: 'email_template_id', as: 'template' });
EmailTemplate.hasMany(EmailTrigger, { foreignKey: 'email_template_id', as: 'triggers' });

// Email Trigger & Question associations
EmailTrigger.belongsToMany(Question, { 
  through: EmailTriggerQuestion, 
  foreignKey: 'email_trigger_id',
  otherKey: 'question_id',
  as: 'questions' 
});
Question.belongsToMany(EmailTrigger, { 
  through: EmailTriggerQuestion, 
  foreignKey: 'question_id',
  otherKey: 'email_trigger_id',
  as: 'emailTriggers' 
});

// Direct access to junction table records
EmailTrigger.hasMany(EmailTriggerQuestion, { 
  foreignKey: 'email_trigger_id', 
  as: 'triggerQuestions' 
});
EmailTriggerQuestion.belongsTo(EmailTrigger, { 
  foreignKey: 'email_trigger_id', 
  as: 'emailTrigger' 
});

Question.hasMany(EmailTriggerQuestion, { 
  foreignKey: 'question_id', 
  as: 'triggerQuestions' 
});
EmailTriggerQuestion.belongsTo(Question, { 
  foreignKey: 'question_id', 
  as: 'question' 
});

// Guest & Booking associations
Guest.hasMany(Booking)
Booking.belongsTo(Guest)

// Guest & HealthInfo associations
Guest.hasOne(HealthInfo)
HealthInfo.belongsTo(Guest)

// Booking & Section associations
Booking.hasMany(Section, {
  foreignKey: 'model_id',
  constraints: false,
  scope: {
    model_type: 'booking'
  }
});
Section.belongsTo(Booking, { foreignKey: 'model_id', constraints: false });

// Guest & Notification associations
Guest.hasMany(Notification, {
  foreignKey: 'notifyee_id',
  constraints: false,
  scope: {
    notifyee_type: 'guest'
  }
});
Notification.belongsTo(Guest, { foreignKey: 'notifyee_id', constraints: false });

// Section & QaPair associations
Section.hasMany(QaPair);
QaPair.belongsTo(Section);

// Booking & Room associations
Booking.hasMany(Room);
Room.belongsTo(Booking);

// RoomType & Room associations
RoomType.hasMany(Room);
Room.belongsTo(RoomType);

// Booking & Checklist associations
Booking.hasOne(Checklist)
Checklist.belongsTo(Booking)

// Checklist & ChecklistAction associations
Checklist.hasMany(ChecklistAction)
ChecklistAction.belongsTo(Checklist)

// Booking & Log associations
Booking.hasMany(Log, {
  foreignKey: 'loggable_id',
  constraints: false,
  scope: {
    loggable_type: 'booking'
  }
});
Log.belongsTo(Booking, { foreignKey: 'loggable_id', constraints: false });

// Booking & Equipment associations (many-to-many)
Booking.belongsToMany(Equipment, { through: BookingEquipment, foreignKey: 'booking_id' });
Equipment.belongsToMany(Booking, { through: BookingEquipment, foreignKey: 'equipment_id' });

BookingEquipment.hasOne(Equipment, { sourceKey: 'equipment_id', foreignKey: 'id' })
BookingEquipment.hasOne(Booking, { sourceKey: 'booking_id', foreignKey: 'id' })

// EquipmentCategory & Equipment associations
EquipmentCategory.hasMany(Equipment, {
  foreignKey: 'category_id',
  constraints: false,
});
Equipment.belongsTo(EquipmentCategory, { foreignKey: 'category_id', constraints: false });

// Supplier & Equipment associations
Supplier.hasMany(Equipment, {
  foreignKey: 'supplier_id',
  constraints: false,
});
Equipment.belongsTo(Supplier, { foreignKey: 'supplier_id', constraints: false });

// Template & ChecklistTemplate associations
Template.hasOne(ChecklistTemplate)
ChecklistTemplate.belongsTo(Template)

// Template & Page associations
Template.hasMany(Page)
Page.belongsTo(Template)

// Page & Section associations
Page.hasMany(Section, {
  foreignKey: 'model_id',
  constraints: false,
  scope: {
    model_type: 'page'
  }
})
Section.belongsTo(Page, { foreignKey: 'model_id', constraints: false })

// Section & Question associations
Section.hasMany(Question)
Question.belongsTo(Section)

// Question & QuestionDependency associations
Question.hasMany(QuestionDependency, { foreignKey: 'question_id' })
QuestionDependency.belongsTo(Question, { foreignKey: 'question_id' })

QuestionDependency.hasOne(Question, { as: 'dependency', sourceKey: 'dependence_id', foreignKey: 'id' })

// Question & QaPair associations
Question.hasOne(QaPair);
QaPair.belongsTo(Question);

// User & Address associations
User.hasMany(Address, {
  foreignKey: 'addressable_id',
  constraints: false,
  scope: {
    'addressable_type': 'user'
  }
})
Address.belongsTo(User, { foreignKey: 'addressable_id', constraints: false })

// User & Notification associations
User.hasMany(Notification, {
  foreignKey: 'notifyee_id',
  constraints: false,
  scope: {
    notifyee_type: 'user'
  }
});
Notification.belongsTo(User, { foreignKey: 'notifyee_id', constraints: false })

// User & Comment associations
User.hasMany(Comment);
Comment.belongsTo(User);

// Guest & Address associations
Guest.hasMany(Address, {
  foreignKey: 'addressable_id',
  constraints: false,
  scope: {
    'addressable_type': 'guest'
  }
})
Address.belongsTo(Guest, { foreignKey: 'addressable_id', constraints: false })

// Guest & Comment associations
Guest.hasMany(Comment);
Comment.belongsTo(Guest);

// User & Role associations (many-to-many)
User.belongsToMany(Role, { through: ModelHasRole, foreignKey: 'model_id' });
Role.belongsToMany(User, { through: ModelHasRole, foreignKey: 'role_id' });

// Guest & Role associations (many-to-many)
Guest.belongsToMany(Role, { through: ModelHasRole, foreignKey: 'model_id' });
Role.belongsToMany(Guest, { through: ModelHasRole, foreignKey: 'role_id' });

// Course & CourseOffer associations
Course.hasMany(CourseOffer, {
  foreignKey: 'course_id',
  as: 'offers'
});
CourseOffer.belongsTo(Course, {
  foreignKey: 'course_id',
  as: 'course'
});

// Guest & CourseOffer associations
Guest.hasMany(CourseOffer, {
  foreignKey: 'guest_id',
  as: 'courseOffers'
});
CourseOffer.belongsTo(Guest, {
  foreignKey: 'guest_id',
  as: 'guest'
});

// Booking & CourseOffer associations
Booking.hasMany(CourseOffer, {
  foreignKey: 'booking_id',
  as: 'courseOffers'
});
CourseOffer.belongsTo(Booking, {
  foreignKey: 'booking_id',
  as: 'booking'
});

// User & CourseOffer associations
User.hasMany(CourseOffer, {
  foreignKey: 'offered_by',
  as: 'offeredCourses'
});
CourseOffer.belongsTo(User, {
  foreignKey: 'offered_by',
  as: 'offeredBy'
});

// Package & PackageRequirement associations
Package.hasMany(PackageRequirement, {
  foreignKey: 'package_id',
  as: 'requirements'
});
PackageRequirement.belongsTo(Package, {
  foreignKey: 'package_id',
  as: 'package'
});

// Booking & BookingApprovalUsage associations
Booking.hasMany(BookingApprovalUsage, {
  foreignKey: 'booking_id',
  as: 'approvalUsages'
});
BookingApprovalUsage.belongsTo(Booking, {
  foreignKey: 'booking_id',
  as: 'booking'
});

// FundingApproval associations
Guest.hasMany(FundingApproval, {
  foreignKey: 'guest_id',
  as: 'fundingApprovals'
});
FundingApproval.belongsTo(Guest, {
  foreignKey: 'guest_id',
  as: 'guest'
});

// Package & FundingApproval associations
Package.hasMany(FundingApproval, {
  foreignKey: 'package_id',
  as: 'fundingApprovals'
});
FundingApproval.belongsTo(Package, {
  foreignKey: 'package_id',
  as: 'package'
});

// RoomType & FundingApproval associations
RoomType.hasMany(FundingApproval, {
  foreignKey: 'additional_room_type_id',
  as: 'fundingApprovals'
});
FundingApproval.belongsTo(RoomType, {
  foreignKey: 'additional_room_type_id',
  as: 'additionalRoomType'
});

// FundingApproval & BookingApprovalUsage associations
FundingApproval.hasMany(BookingApprovalUsage, {
  foreignKey: 'funding_approval_id',
  as: 'usages'
});
BookingApprovalUsage.belongsTo(FundingApproval, {
  foreignKey: 'funding_approval_id',
  as: 'approval'
});

// Guest & CourseEOI associations
Guest.hasMany(CourseEOI, {
  foreignKey: 'guest_id',
  as: 'courseEOIs'
});
CourseEOI.belongsTo(Guest, {
  foreignKey: 'guest_id',
  as: 'guest'
});

module.exports = {
  sequelize,
  Sequelize,
  AccessToken,
  Address,
  Booking,
  BookingEquipment,
  Checklist,
  ChecklistAction,
  ChecklistTemplate,
  Equipment,
  EquipmentCategory,
  Guest,
  ModelHasRole,
  Page,
  Permission,
  QaPair,
  Question,
  QuestionType,
  QuestionDependency,
  RoleHasPermission,
  Role,
  Room,
  RoomType,
  Template,
  User,
  Setting,
  Section,
  EmailTrigger,
  Supplier,
  Comment,
  NotificationLibrary,
  Notification,
  Log,
  HealthInfo,
  Package,
  Course,
  CourseOffer,
  CourseRate,
  PackageRequirement,
  Promotion,
  EmailTemplate,
  EmailTriggerQuestion,
  BookingApprovalUsage,
  FundingApproval,
  CourseEOI,
};