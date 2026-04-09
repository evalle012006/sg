'use strict';

/**
 * Audit Script: Find corrupted QaPair rows
 *
 * Scans qa_pairs for rows where the answer's shape doesn't match the stored
 * question_type — caused by save-qa-pair using `question text + section_id`
 * for findOrCreate when multiple questions in the same section have question: "".
 *
 * Usage:
 *   Dry run (report only):
 *     node scripts/audit-qa-pairs.js
 *
 *   Fix mode (interactive — asks before deleting):
 *     node scripts/audit-qa-pairs.js --fix
 *
 *   Fix mode (non-interactive — no prompt, for CI):
 *     node scripts/audit-qa-pairs.js --fix --yes
 */

const { QaPair, Question, Section, Booking, Guest, sequelize } = require('../models');
const { Op } = require('sequelize');
const readline = require('readline');

const FIX_MODE = process.argv.includes('--fix');
const AUTO_YES = process.argv.includes('--yes');

// ─── Detection helpers ────────────────────────────────────────────────────────

/**
 * Goal-table answer: JSON array where every item has {goal, service, expect, funding, rate}
 */
function looksLikeGoalTable(raw) {
    if (!raw || typeof raw !== 'string' || !raw.trim().startsWith('[')) return false;
    try {
        const parsed = JSON.parse(raw);
        return (
            Array.isArray(parsed) &&
            parsed.length > 0 &&
            parsed.every(
                item =>
                    item && typeof item === 'object' &&
                    'goal' in item && 'service' in item &&
                    'expect' in item && 'funding' in item && 'rate' in item
            )
        );
    } catch { return false; }
}

/**
 * Service-cards answer: JSON object where values have {selected, subOptions}
 */
function looksLikeServiceCards(raw) {
    if (!raw || typeof raw !== 'string' || !raw.trim().startsWith('{')) return false;
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || Array.isArray(parsed)) return false;
        const values = Object.values(parsed);
        return (
            values.length > 0 &&
            values.every(v => v && typeof v === 'object' && 'selected' in v && 'subOptions' in v)
        );
    } catch { return false; }
}

/**
 * Care-table answer: JSON object with {careData, defaultValues}
 */
function looksLikeCareTable(raw) {
    if (!raw || typeof raw !== 'string' || !raw.trim().startsWith('{')) return false;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && 'careData' in parsed && 'defaultValues' in parsed;
    } catch { return false; }
}

/**
 * Rooms answer: JSON array where every item has {name, order}
 */
function looksLikeRooms(raw) {
    if (!raw || typeof raw !== 'string' || !raw.trim().startsWith('[')) return false;
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.length > 0 && parsed.every(i => i && 'name' in i && 'order' in i);
    } catch { return false; }
}

/**
 * Returns the "true" type inferred from the answer shape, or null if it can't be determined.
 */
function inferTypeFromAnswer(raw) {
    if (looksLikeGoalTable(raw))    return 'goal-table';
    if (looksLikeCareTable(raw))    return 'care-table';
    if (looksLikeServiceCards(raw)) return 'service-cards';
    if (looksLikeRooms(raw))        return 'rooms';
    return null;
}

// ─── Console helpers ──────────────────────────────────────────────────────────
const bold   = s => `\x1b[1m${s}\x1b[0m`;
const red    = s => `\x1b[31m${s}\x1b[0m`;
const yellow = s => `\x1b[33m${s}\x1b[0m`;
const green  = s => `\x1b[32m${s}\x1b[0m`;
const cyan   = s => `\x1b[36m${s}\x1b[0m`;

function prompt(question) {
    return new Promise(resolve => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(question, answer => { rl.close(); resolve(answer.trim().toLowerCase()); });
    });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log(bold('\n🔍  QaPair Corruption Audit'));
    console.log(`    Mode       : ${FIX_MODE ? red('FIX — will delete corrupted rows') : green('DRY RUN — read only')}`);
    console.log(`    Environment: ${process.env.NODE_ENV || 'development'}\n`);

    // ── Fetch all qa_pairs with non-null answer ────────────────────────────────
    console.log('Fetching qa_pairs...');
    const allPairs = await QaPair.findAll({
        where: { answer: { [Op.not]: null } },
        include: [{
            model: Question,
            required: false,
            attributes: ['id', 'type', 'question_key'],
        }],
        attributes: ['id', 'question', 'question_type', 'question_id', 'section_id', 'answer', 'created_at', 'updated_at'],
        order: [['id', 'ASC']],
    });
    console.log(`  → ${allPairs.length} rows fetched\n`);

    // ── Classify each row ─────────────────────────────────────────────────────
    // Section A: answer shape contradicts stored question_type
    const corrupted = [];

    // Section B: question_type is a structured type but answer doesn't match
    const orphaned = [];

    const STRUCTURED_TYPES = new Set(['goal-table', 'care-table', 'service-cards', 'rooms']);

    for (const qp of allPairs) {
        const inferredType = inferTypeFromAnswer(qp.answer);
        const storedType   = qp.question_type;

        if (inferredType && inferredType !== storedType) {
            // Answer clearly belongs to a different type than what's stored
            corrupted.push({
                id:           qp.id,
                section_id:   qp.section_id,
                question_id:  qp.question_id,
                storedType,
                inferredType,
                actualQuestionType: qp.Question?.type ?? null,
                question_key: qp.Question?.question_key ?? null,
                createdAt:    qp.created_at,
                updatedAt:    qp.updated_at,
                answerPreview: buildPreview(qp.answer, inferredType),
            });
        } else if (STRUCTURED_TYPES.has(storedType) && !inferredType) {
            // Stored as a structured type but answer doesn't parse correctly
            // orphaned.push({
            //     id:          qp.id,
            //     section_id:  qp.section_id,
            //     question_id: qp.question_id,
            //     storedType,
            //     answerSnippet: (qp.answer || '').substring(0, 100),
            //     createdAt:   qp.created_at,
            //     updatedAt:   qp.updated_at,
            // });
        }
    }

    // ── Section A report ──────────────────────────────────────────────────────
    console.log(bold('══════════════════════════════════════════════════════════'));
    console.log(bold('  SECTION A — Answer shape contradicts stored question_type'));
    console.log(bold('══════════════════════════════════════════════════════════'));

    if (corrupted.length === 0) {
        console.log(green('  ✓ No corrupted rows found.\n'));
    } else {
        // Group by section for readability
        const bySectionId = corrupted.reduce((acc, row) => {
            (acc[row.section_id] = acc[row.section_id] || []).push(row);
            return acc;
        }, {});

        // Fetch booking + guest context for affected sections
        const sectionIds = Object.keys(bySectionId).map(Number);
        const sections = await Section.findAll({
            where: { id: { [Op.in]: sectionIds } },
            include: [{ model: Booking, required: false, include: [Guest] }],
            attributes: ['id', 'label'],
        });
        const sectionMap = Object.fromEntries(sections.map(s => [s.id, s]));

        for (const [secId, rows] of Object.entries(bySectionId)) {
            const sec     = sectionMap[secId];
            const booking = sec?.Booking;
            const guest   = booking?.Guest;

            console.log(yellow(`\n  Section ${secId}  "${sec?.label || '(no label)'}"`));
            if (booking) console.log(`    Booking: ${booking.uuid}  status=${booking.status ?? 'unknown'}`);
            if (guest)   console.log(`    Guest  : ${guest.first_name} ${guest.last_name} (id=${guest.id})`);
            console.log('');

            for (const row of rows) {
                console.log(
                    `    ${red('✗')} id=${bold(String(row.id).padEnd(8))} ` +
                    `question_id=${String(row.question_id ?? 'NULL').padEnd(7)} ` +
                    `stored=${red(row.storedType.padEnd(16))} ` +
                    `inferred=${cyan(row.inferredType)}`
                );
                if (row.question_key) console.log(`       question_key   : ${row.question_key}`);
                if (row.actualQuestionType) console.log(`       actual Q.type  : ${row.actualQuestionType}`);
                console.log(`       answer preview : ${row.answerPreview}`);
                console.log(`       created=${row.createdAt}  updated=${row.updatedAt}`);
            }
        }
        console.log(`\n  Total: ${red(String(corrupted.length))} corrupted row(s)\n`);
    }

    // ── Section B report ──────────────────────────────────────────────────────
    // console.log(bold('══════════════════════════════════════════════════════════'));
    // console.log(bold('  SECTION B — Structured type stored but answer malformed'));
    // console.log(bold('══════════════════════════════════════════════════════════'));

    // if (orphaned.length === 0) {
    //     console.log(green('  ✓ No malformed structured rows found.\n'));
    // } else {
    //     for (const row of orphaned) {
    //         console.log(yellow(
    //             `  id=${row.id}  section_id=${row.section_id}  question_id=${row.question_id ?? 'NULL'}  ` +
    //             `stored_type=${row.storedType}`
    //         ));
    //         console.log(`    answer: ${row.answerSnippet}`);
    //     }
    //     console.log(`\n  Total: ${yellow(String(orphaned.length))} malformed row(s)\n`);
    // }

    // ── Nothing to do ─────────────────────────────────────────────────────────
    if (corrupted.length === 0 && orphaned.length === 0) {
        console.log(green('✓  All qa_pairs look clean.\n'));
        await sequelize.close();
        return;
    }

    if (!FIX_MODE) {
        console.log(bold('💡  Run with --fix to delete corrupted/malformed rows.'));
        console.log('    node scripts/audit-qa-pairs.js --fix\n');
        await sequelize.close();
        return;
    }

    // ── Fix mode ──────────────────────────────────────────────────────────────
    const allToDelete = [
        ...corrupted.map(r => ({ id: r.id, reason: `answer is ${r.inferredType} but stored as ${r.storedType}` })),
        // ...orphaned.map(r  => ({ id: r.id, reason: `stored as ${r.storedType} but answer is not that shape` })),
    ];

    console.log(bold('\n⚠️   Rows queued for deletion:'));
    allToDelete.forEach(r => console.log(`   id=${r.id}  (${r.reason})`));

    let proceed = AUTO_YES;
    if (!proceed) {
        const answer = await prompt(`\nDelete ${allToDelete.length} row(s)? [yes/no]: `);
        proceed = answer === 'yes' || answer === 'y';
    }

    if (!proceed) {
        console.log(yellow('\nAborted — no changes made.\n'));
        await sequelize.close();
        return;
    }

    const idsToDelete = allToDelete.map(r => r.id);
    const t = await sequelize.transaction();
    try {
        const deleted = await QaPair.destroy({
            where: { id: { [Op.in]: idsToDelete } },
            transaction: t,
        });
        await t.commit();
        console.log(green(`\n✅  Deleted ${deleted} row(s).\n`));
    } catch (err) {
        await t.rollback();
        console.error(red('\n❌  Delete failed — transaction rolled back.'));
        console.error(err);
    }

    await sequelize.close();
}

// ─── Preview builder ──────────────────────────────────────────────────────────
function buildPreview(raw, type) {
    try {
        const parsed = JSON.parse(raw);
        if (type === 'goal-table')    return parsed.map(g => g.service).join(', ');
        if (type === 'service-cards') return Object.keys(parsed).filter(k => parsed[k]?.selected).join(', ') || '(none selected)';
        if (type === 'care-table')    return `${parsed.careData?.length ?? 0} care entries`;
        if (type === 'rooms')         return parsed.map(r => r.name).join(', ');
    } catch {}
    return raw.substring(0, 80);
}

main().catch(err => {
    console.error(red('\nFatal error:'), err);
    sequelize.close();
    process.exit(1);
});
