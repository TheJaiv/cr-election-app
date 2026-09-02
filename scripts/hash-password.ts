/**
 * Generate the value for ADMIN_PASSWORD_HASH.
 *
 *   npm run hash-password -- "my admin password"
 *
 * Copy the printed line into .env.local and into the Vercel project settings.
 * The plaintext password is never stored anywhere.
 *
 * Fields are ":"-separated because Next's env loader expands "$NAME" inside
 * .env files, which silently corrupts a "$"-delimited hash.
 */
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem?: number },
) => Promise<Buffer>;

const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error('Usage: npm run hash-password -- "your password"');
    process.exit(1);
  }
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 32, PARAMS);
  const hash = [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join(":");
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
}

main();
