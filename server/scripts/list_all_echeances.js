#!/usr/bin/env node
/**
 * list_all_echeances.js
 * Lists affaires and their facultative/traite dateEcheance values for inspection.
 * Usage: node scripts/list_all_echeances.js [limit]
 */

const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') }); } catch (e) {}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async function main() {
  const limit = parseInt(process.argv[2], 10) || 50;
  try {
    await prisma.$connect();
    const total = await prisma.affaire.count();
    console.log('Total affaires in DB:', total);

    const rows = await prisma.affaire.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { facultativeData: true, traiteData: true, cedante: true },
    });

    rows.forEach((a) => {
      const fac = a.facultativeData;
      const traite = a.traiteData;
      const facDate = fac && fac.dateEcheance ? new Date(fac.dateEcheance).toISOString() : '';
      const traiteDate = traite && traite.dateEcheance ? new Date(traite.dateEcheance).toISOString() : '';
      console.log('---');
      console.log('id:', a.id);
      console.log('numero:', a.numero);
      console.log('type:', a.type);
      console.log('cedante:', a.cedante ? a.cedante.raisonSociale : '—');
      console.log('fac_dateEcheance:', facDate);
      console.log('traite_dateEcheance:', traiteDate);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    try { await prisma.$disconnect(); } catch (e) {}
  }
})();
