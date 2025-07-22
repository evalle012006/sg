'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert('settings', [
      {
        attribute: 'exercise_goal',
        value: JSON.stringify({
          goal: "Clinical support and specialist review (Physiotherapy)",
          service: "Physiotherapy",
          expect: "Alternative opinion and or review of a client's progress, and therapy programs. Building the capacity of local clinicians so they can provide the best possible care to clients in their communities.",
          funding: ["Initial assessment (1.5 hours)", "Follow up with therapist (2 hours)", "Report (2 hours)"],
          rate: "PT: $220"
        }),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        attribute: 'exercise_goal',
        value: JSON.stringify({
          goal: "Clinical support and specialist review (Exercise physiology)",
          service: "Exercise physiology",
          expect: "Alternative opinion and or review of a client's progress, and therapy programs. Building the capacity of local clinicians so they can provide the best possible care to clients in their communities.",
          funding: ["Initial assessment (1.5 hours)", "Follow up with therapist (2 hours)", "Report (2 hours)"],
          rate: "PT: $185"
        }),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        attribute: 'exercise_goal',
        value: JSON.stringify({
          goal: "Development of site-specific gym program",
          service: "Exercise physiology",
          expect: "Enhancing client access to gym facilities and bolstering their ability to exercise and sustain fitness levels.",
          funding: ["Initial Assessment (1.5 hours)", "Development of program (1 hour)", "Report (1 hour)"],
          rate: "PT: $185"
        }),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        attribute: 'exercise_goal',
        value: JSON.stringify({
          goal: "Maintaining client's therapy/exercise program while traveling away from home (Physiotherapy)",
          service: "Physiotherapy",
          expect: "Continue the prescribed therapy/exercise program in conjunction with the local treating therapist.",
          funding: ["Initial Assessment (1.5 hours)", "Maintenance therapy (TBC)", "Report (1 hour)"],
          rate: "PT: $220"
        }),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        attribute: 'exercise_goal',
        value: JSON.stringify({
          goal: "Maintaining client's therapy/exercise program while traveling away from home (Exercise physiology)",
          service: "Exercise Physiology",
          expect: "Continue the prescribed therapy/exercise program in conjunction with the local treating therapist.",
          funding: ["Initial Assessment (1.5 hours)", "Maintenance therapy (TBC)", "Report (1 hour)"],
          rate: "PT: $185"
        }),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        attribute: 'exercise_goal',
        value: JSON.stringify({
          goal: "Equipment trials",
          service: "Physiotherapy",
          expect: "Provide a letter of support detailing the client's trials and their outcomes, which their treating therapist can utilize in the equipment request application.",
          funding: ["Trial (4 hours)", "Report (2 hours)"],
          rate: "PT: $220"
        }),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        attribute: 'exercise_goal',
        value: JSON.stringify({
          goal: "Maintaining client's therapy/exercise program while traveling away from home (Physiotherapy)",
          service: "Physiotherapy",
          expect: "Continue the prescribed therapy/exercise program in conjunction with the local treating therapist.",
          funding: ["Initial Assessment (1.5 hours)", "Maintenance therapy (TBC)", "Report (1 hour)"],
          rate: "PT: $220"
        }),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        attribute: 'exercise_goal',
        value: JSON.stringify({
          goal: "Specific Goal PLEASE WRITE HERE e.g transfer practice",
          service: "Exercise Physiology",
          expect: "Treatment plan created. Specialist therapists delivering program. Report on outcomes.",
          funding: ["Initial Assessment (1.5 hours)", "Maintenance therapy (TBC)", "Report (2 hours)"],
          rate: "PT: $185"
        }),
        created_at: new Date(),
        updated_at: new Date()
      },
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('settings', null, {});
  }
};