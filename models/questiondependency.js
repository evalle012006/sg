'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class QuestionDependency extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  QuestionDependency.init({
    question_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'questions',
        key: 'id'
      }
    },
    dependence_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'questions',
        key: 'id'
      }
    },
    answer: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'QuestionDependency',
    tableName: 'question_dependencies',
    underscored: true,
  });
  return QuestionDependency;
};