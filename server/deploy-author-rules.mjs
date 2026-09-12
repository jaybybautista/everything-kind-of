import admin from './firebaseAdmin.js';
import { readFileSync, writeFileSync } from 'node:fs';

try {
  const rules = admin.securityRules();
  const previous = await rules.getFirestoreRuleset();
  writeFileSync(new URL('./firestore-rules-backup.json', import.meta.url), JSON.stringify(previous, null, 2));
  const deployed = await rules.releaseFirestoreRulesetFromSource(
    readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
  );
  console.log('Author-only rules deployed:', deployed.name);
} catch (error) {
  console.error('Rule deployment failed:', error.code || error.name, error.message);
  process.exitCode = 1;
}
