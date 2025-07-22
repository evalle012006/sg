'use strict';
const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Question extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      models.Section.hasMany(Question)
    }
  }
  Question.init({
    section_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'sections', key: 'id'
      }
    },
    label: DataTypes.STRING,
    type: DataTypes.STRING,
    required: DataTypes.BOOLEAN,
    question: DataTypes.TEXT,
    question_key: {
      type: DataTypes.STRING,
      allowNull: true, // Allow null for existing records and skipped types
    },
    options: DataTypes.JSON,
    option_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,
      comment: 'Type of options for card selection questions (e.g., funder, course)',
      validate: {
        isIn: {
          args: [['funder', 'course']], // Add new types here as needed
          msg: 'option_type must be one of: funder, course'
        }
      }
    },
    details: DataTypes.JSON,
    order: DataTypes.INTEGER,
    prefill: DataTypes.BOOLEAN,
    has_not_available_option: DataTypes.BOOLEAN,
    second_booking_only: DataTypes.BOOLEAN,
    is_locked: DataTypes.BOOLEAN,
    ndis_only: DataTypes.BOOLEAN,
    show_flag: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'Question',
    tableName: 'questions',
    underscored: true,
  });

  return Question;
};