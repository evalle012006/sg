// pages/api/settings/flags.js
import { Flag, Booking, Guest, sequelize } from '../../../models';
import { Op } from 'sequelize';

const VALID_TYPES = ['guest', 'booking'];

// Mirrors the slugify behavior the UI already applies to `value`
// (manage-flags/index.js: value.trim().toLowerCase().replace(/\s+/g, '-'))
function slugify(input) {
  return String(input).trim().toLowerCase().replace(/\s+/g, '-');
}

// Default acronym suggestion: first letter of up to the first 3 words.
// Admin can always override this — see `acronym` handling below.
function suggestAcronym(label) {
  return String(label)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(word => word[0].toUpperCase())
    .join('');
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const flags = await Flag.findAll({
        order: [['type', 'ASC'], ['label', 'ASC']],
      });

      const grouped = {
        guest_flags: flags.filter(f => f.type === 'guest'),
        booking_flags: flags.filter(f => f.type === 'booking'),
      };

      return res.status(200).json(grouped);
    }

    if (req.method === 'POST') {
      // Accept both the new `type` param and the legacy `attribute`
      // ('guest_flag' / 'booking_flag') so any caller still using the old
      // shape (e.g. cached client bundle mid-deploy) doesn't hard-fail.
      let { type, attribute, label, value, acronym, color } = req.body;

      if (!type && attribute) {
        type = attribute === 'guest_flag' ? 'guest' : attribute === 'booking_flag' ? 'booking' : null;
      }

      if (!type || !VALID_TYPES.includes(type)) {
        return res.status(400).json({
          message: 'type is required and must be "guest" or "booking"',
        });
      }

      if (!label || !String(label).trim()) {
        return res.status(400).json({
          message: 'label is required',
        });
      }

      const resolvedLabel = String(label).trim();
      const resolvedValue = value ? slugify(value) : slugify(resolvedLabel);
      const resolvedAcronym = (acronym && String(acronym).trim())
        ? String(acronym).trim().toUpperCase()
        : suggestAcronym(resolvedLabel);
      const resolvedColor = color || '#6B7280';

      const existing = await Flag.findOne({ where: { type, value: resolvedValue } });
      if (existing) {
        return res.status(409).json({
          message: 'This flag already exists',
        });
      }

      const newFlag = await Flag.create({
        type,
        value: resolvedValue,
        label: resolvedLabel,
        acronym: resolvedAcronym,
        color: resolvedColor,
      });

      return res.status(201).json({
        message: 'Flag created successfully',
        flag: newFlag,
      });
    }

    if (req.method === 'PUT') {
      const { id, label, value, acronym, color } = req.body;

      if (!id) {
        return res.status(400).json({ message: 'id is required' });
      }

      const flag = await Flag.findByPk(id);
      if (!flag) {
        return res.status(404).json({ message: 'Flag not found' });
      }

      const updates = {};

      if (label !== undefined) {
        if (!String(label).trim()) {
          return res.status(400).json({ message: 'label cannot be empty' });
        }
        updates.label = String(label).trim();
      }

      if (value !== undefined) {
        const resolvedValue = slugify(value);
        if (!resolvedValue) {
          return res.status(400).json({ message: 'value cannot be empty' });
        }
        const existing = await Flag.findOne({
          where: { type: flag.type, value: resolvedValue, id: { [Op.ne]: id } },
        });
        if (existing) {
          return res.status(409).json({ message: 'A flag with this value already exists' });
        }
        updates.value = resolvedValue;
      }

      // acronym: empty string is a valid explicit choice to re-trigger
      // auto-suggestion from the (possibly just-updated) label; omitted
      // entirely means "don't touch it".
      if (acronym !== undefined) {
        updates.acronym = String(acronym).trim()
          ? String(acronym).trim().toUpperCase()
          : suggestAcronym(updates.label || flag.label);
      }

      if (color !== undefined) {
        updates.color = color;
      }

      await flag.update(updates);

      return res.status(200).json({
        message: 'Flag updated successfully',
        flag,
      });
    }

    if (req.method === 'DELETE') {
      const { id, confirmed } = req.body;

      if (!id) {
        return res.status(400).json({ message: 'id is required' });
      }

      const flag = await Flag.findByPk(id);
      if (!flag) {
        return res.status(404).json({ message: 'Flag not found' });
      }

      const affectedBookings = flag.type === 'booking'
        ? await Booking.findAll({
            attributes: ['id', 'label'],
            where: sequelize.where(
              sequelize.fn('JSON_CONTAINS', sequelize.col('label'), JSON.stringify(flag.value)),
              1
            ),
          })
        : [];

      const affectedGuests = flag.type === 'guest'
        ? await Guest.findAll({
            attributes: ['id', 'flags'],
            where: sequelize.where(
              sequelize.fn('JSON_CONTAINS', sequelize.col('flags'), JSON.stringify(flag.value)),
              1
            ),
          })
        : [];

      const affectedCount = affectedBookings.length + affectedGuests.length;

      if (!confirmed) {
        return res.status(200).json({
          confirmationRequired: affectedCount > 0,
          affectedCount,
          message: flag.type === 'booking'
            ? `This flag is used on ${affectedCount} booking(s).`
            : `This flag is used on ${affectedCount} guest(s).`,
        });
      }

      const transaction = await sequelize.transaction();
      try {
        if (flag.type === 'booking') {
          await sequelize.query(
            `UPDATE bookings
             SET label = JSON_REMOVE(label, JSON_UNQUOTE(JSON_SEARCH(label, 'one', :value)))
             WHERE JSON_CONTAINS(label, :quotedValue)`,
            {
              replacements: { value: flag.value, quotedValue: JSON.stringify(flag.value) },
              transaction,
            }
          );
        }

        if (flag.type === 'guest') {
          await sequelize.query(
            `UPDATE guests
             SET flags = JSON_REMOVE(flags, JSON_UNQUOTE(JSON_SEARCH(flags, 'one', :value)))
             WHERE JSON_CONTAINS(flags, :quotedValue)`,
            {
              replacements: { value: flag.value, quotedValue: JSON.stringify(flag.value) },
              transaction,
            }
          );
        }

        await flag.destroy({ transaction });
        await transaction.commit();
      } catch (err) {
        await transaction.rollback();
        throw err;
      }

      return res.status(200).json({
        message: 'Flag deleted successfully',
        affectedCount,
      });
    }

    return res.status(405).json({ message: 'Method not allowed' });

  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      message: 'Server error',
      error: error.message,
    });
  }
}