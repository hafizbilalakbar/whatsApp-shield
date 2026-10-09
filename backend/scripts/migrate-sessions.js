#!/usr/bin/env node
/**
 * Session Migration & Cleanup Script
 * 
 * Detects the real working session from the old structure (session_auth_info, 
 * session_auth_info_backup, session_auth_info_backup2, etc.) and migrates it
 * to the new structure (backend/sessions/default/).
 * 
 * Usage:
 *   node scripts/migrate-sessions.js --dry-run    # Preview changes without applying
 *   node scripts/migrate-sessions.js --yes        # Apply changes without confirmation
 *   node scripts/migrate-sessions.js              # Interactive mode with confirmation
 */

const fs = require('fs');
const path = require('path');

const BACKEND_DIR = path.join(__dirname, '..');
const OLD_SESSION_DIR = path.join(BACKEND_DIR, 'session_auth_info');
const OLD_BACKUP_DIRS = [
  path.join(BACKEND_DIR, 'session_auth_info_backup'),
  path.join(BACKEND_DIR, 'session_auth_info_backup2'),
  path.join(BACKEND_DIR, 'session_auth_info_empty'),
];
const NEW_SESSIONS_DIR = path.join(BACKEND_DIR, 'sessions');
const NEW_DEFAULT_SESSION_DIR = path.join(NEW_SESSIONS_DIR, 'default');

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    yes: args.includes('--yes') || args.includes('-y'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

function printHelp() {
  console.log(`
Session Migration & Cleanup Script
==================================

This script migrates your WhatsApp session from the old structure to the new
clean structure, and removes duplicate/backup folders.

Old structure (to be cleaned up):
  backend/session_auth_info/
  backend/session_auth_info_backup/
  backend/session_auth_info_backup2/
  backend/session_auth_info_empty/

New structure (clean, scalable):
  backend/sessions/default/

Usage:
  node scripts/migrate-sessions.js [options]

Options:
  --dry-run, -d    Preview changes without applying them
  --yes, -y        Apply changes without confirmation prompt
  --help, -h       Show this help message

The script will:
1. Scan all old session folders for valid creds.json (registered: true)
2. Identify the "real" working session (the one with valid credentials)
3. Move it to backend/sessions/default/
4. Delete all backup/empty folders
5. Clean up stray log files in session folders
  `);
}

function readCreds(sessionPath) {
  const credsPath = path.join(sessionPath, 'creds.json');
  if (!fs.existsSync(credsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(credsPath, 'utf8'));
  } catch (err) {
    return { error: err.message };
  }
}

function getFolderSize(folderPath) {
  if (!fs.existsSync(folderPath)) return 0;
  try {
    const files = fs.readdirSync(folderPath);
    let totalSize = 0;
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile()) totalSize += stat.size;
    }
    return totalSize;
  } catch (_) {
    return 0;
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function scanOldSessions() {
  const results = [];
  
  // Check main session folder
  if (fs.existsSync(OLD_SESSION_DIR)) {
    const creds = readCreds(OLD_SESSION_DIR);
    const size = getFolderSize(OLD_SESSION_DIR);
    results.push({
      path: OLD_SESSION_DIR,
      name: 'session_auth_info',
      creds,
      size,
      isValid: creds && creds.registered === true,
      isBackup: false,
    });
  }
  
  // Check backup folders
  for (const backupDir of OLD_BACKUP_DIRS) {
    if (fs.existsSync(backupDir)) {
      const creds = readCreds(backupDir);
      const size = getFolderSize(backupDir);
      results.push({
        path: backupDir,
        name: path.basename(backupDir),
        creds,
        size,
        isValid: creds && creds.registered === true,
        isBackup: true,
      });
    }
  }
  
  return results;
}

function printScanResults(sessions) {
  console.log('\n=== SCAN RESULTS ===\n');
  
  for (const s of sessions) {
    const status = s.isValid ? '✓ VALID (registered)' : (s.creds ? '✗ INVALID (not registered)' : '✗ NO CREDS');
    const type = s.isBackup ? 'BACKUP' : 'MAIN';
    console.log(`${type}: ${s.name}`);
    console.log(`  Path: ${s.path}`);
    console.log(`  Size: ${formatBytes(s.size)}`);
    console.log(`  Status: ${status}`);
    if (s.creds && !s.creds.error) {
      console.log(`  Registered: ${s.creds.registered ? 'true' : 'false'}`);
      console.log(`  Noise Key: ${s.creds.noiseKey ? 'present' : 'missing'}`);
      console.log(`  Registration ID: ${s.creds.registrationId || 'N/A'}`);
    } else if (s.creds?.error) {
      console.log(`  Error reading creds: ${s.creds.error}`);
    }
    console.log('');
  }
}

function executeMigration(sessions, dryRun, yes) {
  // Find the best candidate for migration (valid, non-backup preferred)
  const validMain = sessions.find(s => s.isValid && !s.isBackup);
  const validBackup = sessions.find(s => s.isValid && s.isBackup);
  const anyMain = sessions.find(s => !s.isBackup && s.creds);
  const anyBackup = sessions.find(s => s.isBackup && s.creds);
  
  let sourceSession = validMain || validBackup || anyMain || anyBackup;
  
  if (!sourceSession) {
    console.log('\n❌ No session with credentials found. Nothing to migrate.');
    return false;
  }
  
  console.log('\n=== MIGRATION PLAN ===\n');
  console.log(`Source: ${sourceSession.name} (${sourceSession.path})`);
  console.log(`  Valid: ${sourceSession.isValid ? 'Yes' : 'No'}`);
  console.log(`  Size: ${formatBytes(sourceSession.size)}`);
  console.log(`\nDestination: ${NEW_DEFAULT_SESSION_DIR}`);
  
  // Files to delete
  const toDelete = sessions
    .filter(s => s.path !== sourceSession.path)
    .map(s => s.path);
  
  if (toDelete.length > 0) {
    console.log('\nFolders to DELETE:');
    for (const d of toDelete) {
      const size = getFolderSize(d);
      console.log(`  - ${path.basename(d)} (${formatBytes(size)})`);
    }
  }
  
  // Also clean up stray log files in backend root
  const strayLogs = [
    path.join(BACKEND_DIR, 'shield-gateway.log'),
    path.join(BACKEND_DIR, 'shield-gateway.log.1'),
  ].filter(f => fs.existsSync(f));
  
  if (strayLogs.length > 0) {
    console.log('\nStray log files in backend root (will be kept, rotation handles them):');
    for (const l of strayLogs) {
      const size = fs.statSync(l).size;
      console.log(`  - ${path.basename(l)} (${formatBytes(size)})`);
    }
  }
  
  if (dryRun) {
    console.log('\n🔍 DRY RUN - No changes made. Run without --dry-run to apply.');
    return true;
  }
  
  // Perform migration (skip confirmation if --yes flag)
  if (!yes) {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    
    return new Promise((resolve) => {
      rl.question('\n⚠️  Proceed with migration? [y/N] ', (answer) => {
        rl.close();
        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log('Migration cancelled.');
          resolve(false);
          return;
        }
        doMigration().then(resolve);
      });
    });
  }
  
  // --yes flag provided, proceed directly
  return doMigration();
  
  function doMigration() {
    try {
      // Create new sessions directory
      fs.mkdirSync(NEW_SESSIONS_DIR, { recursive: true });
      
      // Copy source to destination
      if (fs.existsSync(NEW_DEFAULT_SESSION_DIR)) {
        fs.rmSync(NEW_DEFAULT_SESSION_DIR, { recursive: true, force: true });
      }
      
      console.log('\n=== EXECUTING MIGRATION ===\n');
      console.log(`Copying ${sourceSession.name} -> sessions/default/`);
      fs.cpSync(sourceSession.path, NEW_DEFAULT_SESSION_DIR, { recursive: true });
      
      // Verify the copy BEFORE removing anything: creds.json must exist, and if
      // the source was a registered session the destination must be registered
      // too. Otherwise abort and leave the source folder intact.
      const destCreds = readCreds(NEW_DEFAULT_SESSION_DIR);
      if (!destCreds || destCreds.error) {
        throw new Error('Migration failed: creds.json not found/invalid in destination');
      }
      if (sourceSession.isValid && destCreds.registered !== true) {
        throw new Error('Migration aborted: destination creds are not registered; source left intact');
      }
      console.log('✓ Session copied and verified');

      // Delete the source folder (true move semantics) AND every other old
      // session folder. The source is only removed after the verified copy.
      const toRemove = [...toDelete, sourceSession.path];
      for (const d of toRemove) {
        if (path.resolve(d) === path.resolve(NEW_DEFAULT_SESSION_DIR)) continue;
        console.log(`Deleting ${path.basename(d)}...`);
        fs.rmSync(d, { recursive: true, force: true });
      }
      console.log('✓ Old folders (including migrated source) deleted');
      
      // Create logs directory if it doesn't exist
      const logsDir = path.join(BACKEND_DIR, 'logs');
      fs.mkdirSync(logsDir, { recursive: true });
      
      console.log('\n✅ Migration completed successfully!');
      console.log(`\nNew session location: ${NEW_DEFAULT_SESSION_DIR}`);
      console.log('\nNext steps:');
      console.log('  1. Start the backend: npm start');
      console.log('  2. The session should auto-restore on startup');
      console.log('  3. Check /api/session/status to verify');
      
      return true;
    } catch (err) {
      console.error('\n❌ Migration failed:', err.message);
      return false;
    }
  }
}

async function main() {
  const { dryRun, yes, help } = parseArgs();
  
  if (help) {
    printHelp();
    process.exit(0);
  }
  
  console.log('WhatsApp Shield - Session Migration & Cleanup');
  console.log('==============================================\n');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  const sessions = scanOldSessions();
  
  if (sessions.length === 0) {
    console.log('No old session folders found. Nothing to do.');
    process.exit(0);
  }
  
  printScanResults(sessions);
  
  // Check if new structure already exists
  if (fs.existsSync(NEW_DEFAULT_SESSION_DIR)) {
    const newCreds = readCreds(NEW_DEFAULT_SESSION_DIR);
    console.log('\n=== NEW STRUCTURE ALREADY EXISTS ===\n');
    console.log(`Path: ${NEW_DEFAULT_SESSION_DIR}`);
    console.log(`Valid: ${newCreds && newCreds.registered === true ? 'Yes' : 'No'}`);
    console.log('\nYou may not need to migrate. Use --dry-run to see what would be cleaned up.');
    
    // Still offer to clean up old folders
    const newIsValid = newCreds && newCreds.registered === true;
    const oldFolders = newIsValid ? sessions : sessions.filter(s => s.isBackup || s.name === 'session_auth_info_empty');
    if (oldFolders.length > 0) {
      console.log('\nOld folders can be cleaned up:');
      for (const f of oldFolders) {
        console.log(`  - ${f.name} (${formatBytes(f.size)})`);
      }
      if (!newIsValid) {
        console.log('\n⚠️  New session is not registered — only backup/empty folders are eligible.');
      }
      
      if (!dryRun && !yes) {
        const readline = require('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        await new Promise((resolve) => {
          rl.question('\nDelete old backup/empty folders? [y/N] ', (answer) => {
            rl.close();
            if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
              for (const f of oldFolders) {
                console.log(`Deleting ${f.name}...`);
                fs.rmSync(f.path, { recursive: true, force: true });
              }
              console.log('✓ Old folders deleted');
            } else {
              console.log('Cleanup cancelled.');
            }
            resolve();
          });
        });
      } else if (!dryRun && yes) {
        for (const f of oldFolders) {
          console.log(`Deleting ${f.name}...`);
          fs.rmSync(f.path, { recursive: true, force: true });
        }
        console.log('✓ Old folders deleted');
      }
    }
    process.exit(0);
  }
  
  const success = await executeMigration(sessions, dryRun, yes);
  process.exit(success ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});