import Database from 'better-sqlite3';
import path from 'path';

// Use a local SQLite database file
const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

// Mimic the mysql2/promise pool interface for minimal disruption
const pool = {
  query: async (sql: string, params: any[] = []) => {
    // Convert MySQL-style placeholders (?) to SQLite if needed (SQLite also uses ?)
    // Convert some common MySQL syntax to SQLite
    let sqliteSql = sql
      .replace(/AUTO_INCREMENT/gi, 'AUTOINCREMENT')
      .replace(/ENUM\([^)]+\)/gi, 'TEXT')
      .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/gi, "DATETIME DEFAULT (datetime('now','localtime'))")
      .replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP/gi, "DATETIME DEFAULT (datetime('now','localtime'))");

    // Convert Date objects, booleans, and undefined in params for SQLite
    const sqliteParams = params.map(param => {
      if (param instanceof Date) {
        return param.toISOString();
      }
      if (typeof param === 'boolean') {
        return param ? 1 : 0;
      }
      if (param === undefined) {
        return null;
      }
      if (param !== null && typeof param === 'object') {
        return JSON.stringify(param);
      }
      return param;
    });

    try {
      if (sqliteSql.trim().toUpperCase().startsWith('SELECT')) {
        const stmt = db.prepare(sqliteSql);
        const rows = stmt.all(...sqliteParams);
        return [rows, null];
      } else {
        const stmt = db.prepare(sqliteSql);
        const result = stmt.run(...sqliteParams);
        // Map SQLite result to MySQL-style result for compatibility
        const mysqlResult = {
          ...result,
          insertId: result.lastInsertRowid,
          affectedRows: result.changes
        };
        return [mysqlResult, null];
      }
    } catch (error) {
      console.error('SQLite Error:', error);
      throw error;
    }
  },
  execute: async (sql: string, params: any[] = []) => {
    return pool.query(sql, params);
  }
};

export default pool;
