#!/usr/bin/env node
/**
 * set_echeances_test.js
 * Set the next N affaires' facultative/traite dateEcheance to dates within the next 7 days.
 * Usage: node scripts/set_echeances_test.js [N]
 */

const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') }); } catch (e) {}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async function main() {
  const N = parseInt(process.argv[2], 10) || 5;
  console.log(`Setting échéance dates for up to ${N} affaires to within next 7 days...`);

  try {
    await prisma.$connect();

    const affaires = await prisma.affaire.findMany({
      where: { isActive: true },
      include: { facultativeData: true, traiteData: true },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    let updated = 0;
    for (const a of affaires) {
      if (updated >= N) break;

      // choose which date field to update
      const hasFac = !!a.facultativeData;
      const hasTraite = !!a.traiteData;
      if (!hasFac && !hasTraite) continue;

      const dayOffset = updated % 7; // spread across 7-day window
      const target = new Date();
      target.setDate(target.getDate() + dayOffset);
      target.setHours(12, 0, 0, 0);

      if (hasFac) {
        await prisma.facultativeAffaire.update({
          where: { id: a.facultativeData.id },
          data: { dateEcheance: target },
        });
        console.log(`Updated facultative affaire ${a.numero} -> ${target.toISOString()}`);
        updated++;
      } else if (hasTraite) {
        await prisma.traiteAffaire.update({
          where: { id: a.traiteData.id },
          data: { dateEcheance: target },
        });
        console.log(`Updated traite affaire ${a.numero} -> ${target.toISOString()}`);
        updated++;
      }
    }

    if (updated === 0) console.log('No affaires with facultativeData/traiteData found to update.');
    else console.log(`Done. Updated ${updated} affaire(s).`);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    try { await prisma.$disconnect(); } catch (e) {}
  }
})();
