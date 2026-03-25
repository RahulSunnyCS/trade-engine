import 'dotenv/config';
import { runMigrations, closePool } from './client';

runMigrations()
  .then(() => closePool())
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
