/* Sign one scheduled call, so a cron somewhere else can make it.
   Usage:  KBYS_SCHEDULE_SECRET=... node tools/sign-schedule.mjs /api/retain
   Prints a curl command. The secret is read from the environment and is never
   printed, and the signature it prints is good once, for a few minutes. */
import crypto from 'crypto';
import { sign, WINDOW_S } from '../api/_scheduled.js';

const path = process.argv[2] || '/api/retain';
const host = process.argv[3] || 'https://4ormiq.com';
const secret = process.env.KBYS_SCHEDULE_SECRET;
if (!secret || secret.length < 32) {
  console.error('Set KBYS_SCHEDULE_SECRET to the value on the deployment. '
    + 'It must be at least 32 characters.');
  process.exit(1);
}
const ts = Math.floor(Date.now() / 1000);
const nonce = crypto.randomBytes(12).toString('hex');
const sig = sign(secret, 'POST', path, ts, nonce, '');
console.log('curl -X POST ' + host + path
  + " \\\n  -H 'X-4orm-Timestamp: " + ts + "'"
  + " \\\n  -H 'X-4orm-Nonce: " + nonce + "'"
  + " \\\n  -H 'X-4orm-Signature: " + sig + "'");
console.log('\nGood for ' + WINDOW_S + ' seconds, and for one call.');
