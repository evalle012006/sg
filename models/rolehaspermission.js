'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class RoleHasPermission extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
  }


  RoleHasPermission.init(
    {
      role_id: {
        type: DataTypes.INTEGER,
        references: {
          model: 'roles', key: 'id'
        }
      },
      permission_id: {
        type: DataTypes.INTEGER,
        references: {
          model: 'permissions', key: 'id'
        }
      },
      created_at: {
        type: DataTypes.DATE,
      },
      updated_at: {
        type: DataTypes.DATE,
      }
    }, {
    sequelize,
    modelName: 'RoleHasPermission',
    tableName: 'role_has_permissions',
    underscored: true,
  });

  return RoleHasPermission;
};

async () => await RoleHasPermission.sync();