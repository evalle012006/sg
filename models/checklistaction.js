'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ChecklistAction extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      models.Checklist.hasMany(ChecklistAction)
    }
  }
  ChecklistAction.init({
    action: DataTypes.STRING,
    status: DataTypes.BOOLEAN,
    checklist_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'checklists', key: 'id'
      }
    },
    order: DataTypes.INTEGER,
  }, {
    sequelize,
    modelName: 'ChecklistAction',
    tableName: 'checklist_actions',
    underscored: true,
  });
  return ChecklistAction;
};