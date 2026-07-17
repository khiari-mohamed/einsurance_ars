#!/usr/bin/env node
/**
 * check_echeances.js
 * Quick Node script to inspect `affaire` records with upcoming `dateEcheance`.
 * Usage: node scripts/check_echeances.js [days]
 * Defaults to 7 days.
 */

const path = require('path');
// Load .env if present (install dotenv if not available)
try { require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') }); } catch (e) {}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async function main() {
  const days = parseInt(process.argv[2], 10) || 7;
  const now = new Date();
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  console.log(`Checking affaires with dateEcheance between ${now.toISOString()} and ${future.toISOString()} (next ${days} days)`);

  try {
    await prisma.$connect();

    const total = await prisma.affaire.count();
    console.log('Total affaires in DB:', total);

    const matches = await prisma.affaire.findMany({
      where: {
        isActive: true,
        OR: [
          { facultativeData: { dateEcheance: { gte: now, lte: future } } },
          { traiteData: { dateEcheance: { gte: now, lte: future } } },
        ],
      },
      include: {
        facultativeData: true,
        traiteData: true,
        cedante: true,
      },
      orderBy: [
        { facultativeData: { dateEcheance: 'asc' } },
        { traiteData: { dateEcheance: 'asc' } },
      ],
      take: 100,
    });

    console.log(`Found ${matches.length} affaire(s) with upcoming échéance:\n`);

    for (const a of matches) {
      const dateEcheance = (a.facultativeData && a.facultativeData.dateEcheance)
        ? new Date(a.facultativeData.dateEcheance)
        : (a.traiteData && a.traiteData.dateEcheance) ? new Date(a.traiteData.dateEcheance) : null;

      console.log('---');
      console.log('id:', a.id);
      console.log('numero:', a.numero);
      console.log('type:', a.type);
      console.log('cedante:', a.cedante ? a.cedante.raisonSociale : '—');
      console.log('montant (facultative primeCedee):', a.facultativeData ? String(a.facultativeData.primeCedee ?? '') : '');
      console.log('primePrevisionnelle (traite):', a.traiteData ? String(a.traiteData.primePrevisionnelle ?? '') : '');
      console.log('dateEcheance:', dateEcheance ? dateEcheance.toISOString() : '—');
      console.log('raw facultativeData:', JSON.stringify(a.facultativeData || null));
      console.log('raw traiteData:', JSON.stringify(a.traiteData || null));
      console.log('\n');
    }

    if (matches.length === 0) {
      console.log('No upcoming échéances found in DB for the requested window.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error while querying DB:', err);
    process.exit(1);
  } finally {
    try { await prisma.$disconnect(); } catch (e) {}
  }
})();
