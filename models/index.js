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
const guestFundingModel = require('./guestfunding');
const promotionModel = require('./promotion');

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
const GuestFunding = guestFundingModel(sequelize, Sequelize.DataTypes);
const Promotion = promotionModel(sequelize, Sequelize.DataTypes);

//ASSOCIATIONS
Role.belongsToMany(Permission, { through: RoleHasPermission, foreignKey: 'role_id' });
Permission.belongsToMany(Role, { through: RoleHasPermission, foreignKey: 'permission_id' });


Guest.hasMany(Booking)
Booking.belongsTo(Guest)

Guest.hasOne(HealthInfo)
HealthInfo.belongsTo(Guest)

Booking.hasMany(Section, {
  foreignKey: 'model_id',
  constraints: false,
  scope: {
    model_type: 'booking'
  }
});
Section.belongsTo(Booking, { foreignKey: 'model_id', constraints: false });

Guest.hasMany(Notification, {
  foreignKey: 'notifyee_id',
  constraints: false,
  scope: {
    notifyee_type: 'guest'
  }
});
Notification.belongsTo(Guest, { foreignKey: 'notifyee_id', constraints: false });

Section.hasMany(QaPair);
QaPair.belongsTo(Section);

Booking.hasMany(Room);
Room.belongsTo(Booking);

RoomType.hasMany(Room);
Room.belongsTo(RoomType);

Booking.hasOne(Checklist)
Checklist.belongsTo(Booking)

Checklist.hasMany(ChecklistAction)
ChecklistAction.belongsTo(Checklist)

Booking.hasMany(Log, {
  foreignKey: 'loggable_id',
  constraints: false,
  scope: {
    loggable_type: 'booking'
  }
});
Log.belongsTo(Booking, { foreignKey: 'loggable_id', constraints: false });

Booking.belongsToMany(Equipment, { through: BookingEquipment, foreignKey: 'booking_id' });
Equipment.belongsToMany(Booking, { through: BookingEquipment, foreignKey: 'equipment_id' });

BookingEquipment.hasOne(Equipment, { sourceKey: 'equipment_id', foreignKey: 'id' })
BookingEquipment.hasOne(Booking, { sourceKey: 'booking_id', foreignKey: 'id' })

EquipmentCategory.hasMany(Equipment, {
  foreignKey: 'category_id',
  constraints: false,
});
Equipment.belongsTo(EquipmentCategory, { foreignKey: 'category_id', constraints: false });

Supplier.hasMany(Equipment, {
  foreignKey: 'supplier_id',
  constraints: false,
});
Equipment.belongsTo(Supplier, { foreignKey: 'supplier_id', constraints: false });

Template.hasOne(ChecklistTemplate)
ChecklistTemplate.belongsTo(Template)

Template.hasMany(Page)
Page.belongsTo(Template)

Page.hasMany(Section, {
  foreignKey: 'model_id',
  constraints: false,
  scope: {
    model_type: 'page'
  }
})
Section.belongsTo(Page, { foreignKey: 'model_id', constraints: false })

Section.hasMany(Question)
Question.belongsTo(Section)

Question.hasMany(QuestionDependency, { foreignKey: 'question_id' })
QuestionDependency.belongsTo(Question, { foreignKey: 'question_id' })

QuestionDependency.hasOne(Question, { as: 'dependency', sourceKey: 'dependence_id', foreignKey: 'id' })
// Question.hasMany(QuestionDependency, { as: 'dependant', sourceKey: 'id', foreignKey: 'question_id' })

Question.hasOne(QaPair);
QaPair.belongsTo(Question);

User.hasMany(Address, {
  foreignKey: 'addressable_id',
  constraints: false,
  scope: {
    'addressable_type': 'user'
  }
})
Address.belongsTo(User, { foreignKey: 'addressable_id', constraints: false })

User.hasMany(Notification, {
  foreignKey: 'notifyee_id',
  constraints: false,
  scope: {
    notifyee_type: 'user'
  }
});
Notification.belongsTo(User, { foreignKey: 'notifyee_id', constraints: false })

User.hasMany(Comment);
Comment.belongsTo(User);


Guest.hasMany(Address, {
  foreignKey: 'addressable_id',
  constraints: false,
  scope: {
    'addressable_type': 'guest'
  }
})
Address.belongsTo(Guest, { foreignKey: 'addressable_id', constraints: false })

Guest.hasMany(Comment);
Comment.belongsTo(Guest);

User.belongsToMany(Role, { through: ModelHasRole, foreignKey: 'model_id' });
Role.belongsToMany(User, { through: ModelHasRole, foreignKey: 'role_id' });

Guest.belongsToMany(Role, { through: ModelHasRole, foreignKey: 'model_id' });
Role.belongsToMany(Guest, { through: ModelHasRole, foreignKey: 'role_id' });

Course.hasMany(CourseOffer, {
  foreignKey: 'course_id',
  as: 'offers'
});
CourseOffer.belongsTo(Course, {
  foreignKey: 'course_id',
  as: 'course'
});

Guest.hasMany(CourseOffer, {
  foreignKey: 'guest_id',
  as: 'courseOffers'
});
CourseOffer.belongsTo(Guest, {
  foreignKey: 'guest_id',
  as: 'guest'
});

Booking.hasMany(CourseOffer, {
  foreignKey: 'booking_id',
  as: 'courseOffers'
});
CourseOffer.belongsTo(Booking, {
  foreignKey: 'booking_id',
  as: 'booking'
});

User.hasMany(CourseOffer, {
  foreignKey: 'offered_by',
  as: 'offeredCourses'
});
CourseOffer.belongsTo(User, {
  foreignKey: 'offered_by',
  as: 'offeredBy'
});

Package.hasMany(PackageRequirement, {
  foreignKey: 'package_id',
  as: 'requirements'
});
PackageRequirement.belongsTo(Package, {
  foreignKey: 'package_id',
  as: 'package'
});

Guest.hasOne(GuestFunding, {
  foreignKey: 'guest_id',
  as: 'funding'
});
GuestFunding.belongsTo(Guest, {
  foreignKey: 'guest_id',
  as: 'guest'
});

Package.hasMany(GuestFunding, {
  foreignKey: 'package_id',
  as: 'guestFundings'
});
GuestFunding.belongsTo(Package, {
  foreignKey: 'package_id',
  as: 'package'
});
// Association between GuestFunding and RoomType for additional room tracking
RoomType.hasMany(GuestFunding, {
  foreignKey: 'additional_room_approved',
  as: 'guestFundings'
});
GuestFunding.belongsTo(RoomType, {
  foreignKey: 'additional_room_approved',
  as: 'additionalRoomType'
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
  GuestFunding,
  Promotion,
};
