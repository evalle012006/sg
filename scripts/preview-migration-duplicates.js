'use strict';

/**
 * Preview Script: Show exactly which qa_pair rows the migration DELETE would remove
 *
 * This is a READ-ONLY script — it makes zero changes to the database.
 * Run it before applying the migration to verify what will be deleted.
 *
 * Usage:
 *   node scripts/preview-migration-duplicates.js
 *
 * Output:
 *   - Every (question_id, section_id) group that has duplicates
 *   - Which row would be KEPT (highest id = most recent)
 *   - Which rows would be DELETED (all others)
 *   - Booking UUID + guest name for context
 */

const { sequelize, QaPair, Question, Section, Booking, Guest } = require('../models');
const { Op } = require('sequelize');

const bold   = s => `\x1b[1m${s}\x1b[0m`;
const red    = s => `\x1b[31m${s}\x1b[0m`;
const green  = s => `\x1b[32m${s}\x1b[0m`;
const yellow = s => `\x1b[33m${s}\x1b[0m`;
const cyan   = s => `\x1b[36m${s}\x1b[0m`;
const dim    = s => `\x1b[2m${s}\x1b[0m`;

async function main() {
    console.log(bold('\n🔎  Migration Duplicate Preview  (READ-ONLY)\n'));
    console.log(`    Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`    This script makes NO changes to the database.\n`);

    // ── Step 1: find all (question_id, section_id) combos with more than one row ──
    const duplicateGroups = await sequelize.query(`
        SELECT
            question_id,
            section_id,
            COUNT(*)        AS total_rows,
            MAX(id)         AS keep_id,
            GROUP_CONCAT(id ORDER BY id ASC SEPARATOR ',') AS all_ids
        FROM qa_pairs
        WHERE question_id IS NOT NULL
        GROUP BY question_id, section_id
        HAVING COUNT(*) > 1
        ORDER BY section_id, question_id
    `, { type: sequelize.QueryTypes.SELECT });

    if (duplicateGroups.length === 0) {
        console.log(green('✓  No duplicate (question_id, section_id) groups found.'));
        console.log(green('   The migration DELETE would affect zero rows.\n'));
        await sequelize.close();
        return;
    }

    console.log(yellow(`Found ${duplicateGroups.length} duplicate group(s):\n`));

    // ── Step 2: collect every id involved ──────────────────────────────────────
    const keepIds   = [];
    const deleteIds = [];

    for (const group of duplicateGroups) {
        const allIds = group.all_ids.split(',').map(Number);
        const keepId = Number(group.keep_id);
        keepIds.push(keepId);
        allIds.filter(id => id !== keepId).forEach(id => deleteIds.push(id));
    }

    // ── Step 3: fetch full row data for every affected id ─────────────────────
    const allIds = [...keepIds, ...deleteIds];
    const rows = await QaPair.findAll({
        where: { id: { [Op.in]: allIds } },
        include: [{
            model: Question,
            required: false,
            attributes: ['id', 'type', 'question', 'question_key'],
        }],
        attributes: ['id', 'question', 'question_type', 'question_id', 'section_id', 'answer', 'created_at', 'updated_at'],
        order: [['section_id', 'ASC'], ['question_id', 'ASC'], ['id', 'ASC']],
    });

    const rowMap = Object.fromEntries(rows.map(r => [r.id, r]));

    // ── Step 4: fetch section → booking → guest context ───────────────────────
    const sectionIds = [...new Set(duplicateGroups.map(g => g.section_id))];
    const sections   = await Section.findAll({
        where: { id: { [Op.in]: sectionIds } },
        include: [{ model: Booking, required: false, include: [Guest] }],
        attributes: ['id', 'label'],
    });
    const sectionMap = Object.fromEntries(sections.map(s => [s.id, s]));

    // ── Step 5: print each group ───────────────────────────────────────────────
    let totalDeleted = 0;

    for (const group of duplicateGroups) {
        const allIds  = group.all_ids.split(',').map(Number);
        const keepId  = Number(group.keep_id);
        const toDelete = allIds.filter(id => id !== keepId);
        totalDeleted += toDelete.length;

        const sec     = sectionMap[group.section_id];
        const booking = sec?.Booking;
        const guest   = booking?.Guest;

        // Header
        console.log(bold('─────────────────────────────────────────────────────────'));
        console.log(
            bold(`question_id=${group.question_id}  section_id=${group.section_id}`) +
            `  (${group.total_rows} rows — ${toDelete.length} will be deleted)`
        );
        if (sec)     console.log(dim(`  Section : ${sec.label || '(no label)'}`));
        if (booking) console.log(dim(`  Booking : ${booking.uuid}  status=${booking.status ?? 'unknown'}`));
        if (guest)   console.log(dim(`  Guest   : ${guest.first_name} ${guest.last_name} (id=${guest.id})`));
        console.log('');

        // Print each row in the group
        for (const id of allIds) {
            const qp      = rowMap[id];
            const isKeep  = id === keepId;
            const tag     = isKeep ? green('  KEEP  ') : red(' DELETE ');
            const reason  = isKeep ? '(highest id = most recent)' : '';

            if (!qp) {
                console.log(`  [${tag}] id=${id}  ${yellow('(row not found in QaPair query)')}`);
                continue;
            }

            const answerPreview = (qp.answer || '').substring(0, 80).replace(/\n/g, ' ');
            const questionKey   = qp.Question?.question_key ?? '(no key)';
            const actualType    = qp.Question?.type         ?? '(no Question row)';

            console.log(`  [${tag}] id=${bold(String(id).padEnd(8))} ${reason}`);
            console.log(`           stored type  : ${isKeep ? cyan(qp.question_type) : red(qp.question_type)}`);
            console.log(`           actual Q type: ${actualType}`);
            console.log(`           question_key : ${questionKey}`);
            console.log(`           answer       : ${answerPreview}${qp.answer?.length > 80 ? '…' : ''}`);
            console.log(`           created      : ${qp.created_at}  updated: ${qp.updated_at}`);
            console.log('');
        }
    }

    // ── Step 6: summary ───────────────────────────────────────────────────────
    console.log(bold('═════════════════════════════════════════════════════════'));
    console.log(bold('  Summary'));
    console.log(bold('═════════════════════════════════════════════════════════'));
    console.log(`  Duplicate groups : ${yellow(String(duplicateGroups.length))}`);
    console.log(`  Rows to KEEP     : ${green(String(keepIds.length))}`);
    console.log(`  Rows to DELETE   : ${red(String(totalDeleted))}`);
    console.log('');
    console.log(dim('  The migration keeps the row with the highest id (most recently written)'));
    console.log(dim('  in each (question_id, section_id) group and deletes the rest.'));
    console.log('');
    console.log(bold('  ⚠️  If any DELETE row is the correct/clean one and the KEEP row'));
    console.log(bold('      is corrupted, run the audit script first to clean those up:'));
    console.log(bold('      node scripts/audit-qa-pairs.js --fix'));
    console.log(bold('      Then re-run this preview to confirm before migrating.\n'));

    await sequelize.close();
}

main().catch(err => {
    console.error(red('\nFatal error:'), err);
    sequelize.close();
    process.exit(1);
});