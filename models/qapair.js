'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class QaPair extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
  }
  QaPair.init({
    label: DataTypes.STRING,
    question: DataTypes.TEXT,
    answer: DataTypes.TEXT,
    question_type: DataTypes.STRING,
    question_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'questions', key: 'id'
      }
    },
    section_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'sections', key: 'id'
      }
    }
  }, {
    sequelize,
    modelName: 'QaPair',
    tableName: 'qa_pairs',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['question_id', 'section_id', 'answer']
      }
    ]
  });



  return QaPair;
};

async () => await RoleHasPermission.sync();
