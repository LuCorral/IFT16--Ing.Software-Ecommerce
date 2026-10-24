const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3');

function backupDatabase(sourcePath) {
  const resolvedSource = path.resolve(sourcePath);
  if (!fs.existsSync(resolvedSource)) {
    throw new Error('The configured SQLite database does not exist; no backup was created.');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${resolvedSource}.${timestamp}.bak`;

  return new Promise((resolve, reject) => {
    const source = new sqlite3.Database(resolvedSource, sqlite3.OPEN_READONLY, (openError) => {
      if (openError) {
        reject(openError);
        return;
      }
      const backup = source.backup(backupPath, (initializeError) => {
        if (initializeError) {
          source.close((closeError) => {
            fs.rmSync(backupPath, { force: true });
            reject(initializeError || closeError);
          });
          return;
        }

        const finish = (stepError) => {
          backup.finish((finishError) => {
            source.close((closeError) => {
              const error = stepError || finishError || closeError;
              if (error) {
                fs.rmSync(backupPath, { force: true });
                reject(error);
              } else {
                resolve(backupPath);
              }
            });
          });
        };

        const step = () => {
          backup.step(-1, (stepError, completed) => {
            if (stepError || completed) {
              finish(stepError);
            } else {
              step();
            }
          });
        };
        step();
      });
    });
  });
}

module.exports = { backupDatabase };
