import 'dotenv/config';
import { readFileSync } from 'node:fs';
import firestore from '@google-cloud/firestore';

const client = new firestore.v1.FirestoreAdminClient({ keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS });
try {
  const project = await client.getProjectId();
  const config = JSON.parse(readFileSync(new URL('../firestore.indexes.json', import.meta.url), 'utf8'));
  for (const { collectionGroup, ...index } of config.indexes) {
    try {
      await client.createIndex({ parent: `projects/${project}/databases/(default)/collectionGroups/${collectionGroup}`, index });
      console.log('Index requested:', collectionGroup, index.fields.map(f => f.fieldPath).join(', '));
    } catch (error) {
      if (error.code !== 6) throw error;
      console.log('Index already exists:', collectionGroup, index.fields.map(f => f.fieldPath).join(', '));
    }
  }
} catch (error) {
  console.error(error.code || error.name, error.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
