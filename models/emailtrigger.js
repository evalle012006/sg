'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class EmailTrigger extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  EmailTrigger.init({
    recipient: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email_template: DataTypes.STRING,
    trigger_questions: DataTypes.JSON,
    type: DataTypes.ENUM('highlights', 'external', 'internal'),
    enabled: DataTypes.BOOLEAN,
  }, {
    sequelize,
    modelName: 'EmailTrigger',
    tableName: 'email_triggers',
  });
  return EmailTrigger;
};