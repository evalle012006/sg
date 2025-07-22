'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {

        await queryInterface.bulkInsert('settings', [
            {
                attribute: 'MAIL_HOST',
                value: '',
            },
            {
                attribute: 'MAIL_PORT',
                value: '',
            },
            {
                attribute: 'MAIL_USER',
                value: '',
            },
            {
                attribute: 'MAIL_PASSWORD',
                value: '',
            },
            {
                attribute: 'MAIL_SENDER_EMAIL',
                value: '',
            }], {});

    },

    async down(queryInterface, Sequelize) {
        /**
         * Add commands to revert seed here.
         *
         * Example:
         * await queryInterface.bulkDelete('People', null, {});
         */
    }
};
