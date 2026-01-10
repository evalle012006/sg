'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CourseEOI extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Associate with Guest model
      CourseEOI.belongsTo(models.Guest, {
        foreignKey: 'guest_id',
        as: 'guest'
      });
    }
  }

  CourseEOI.init({
    guest_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'guests',
        key: 'id'
      }
    },
    guest_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    guest_email: {
      type: DataTypes.STRING,
      allowNull: false
    },
    guest_phone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    funding_type: {
      type: DataTypes.STRING,
      allowNull: true
    },
    completing_for: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'myself'
    },
    has_sci: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true
    },
    support_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    support_phone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    support_email: {
      type: DataTypes.STRING,
      allowNull: true
    },
    support_role: {
      type: DataTypes.STRING,
      allowNull: true
    },
    sci_levels: {
      type: DataTypes.STRING,
      allowNull: true
    },
    selected_courses: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    course_date_preferences: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    comments: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending'
    },
    admin_notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    submitted_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    contacted_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'CourseEOI',
    tableName: 'course_eois',
    underscored: true,
  });

  return CourseEOI;
};