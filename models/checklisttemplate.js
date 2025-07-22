'use strict';
const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ChecklistTemplate extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
  }
  ChecklistTemplate.init({
    name: DataTypes.STRING,
    actions: DataTypes.STRING,
    template_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'templates', key: 'id'
      }
    },
    order: DataTypes.INTEGER,
  }, {
    sequelize,
    modelName: 'ChecklistTemplate',
    tableName: 'checklist_templates',
    underscored: true,
  });


  return ChecklistTemplate;
};
