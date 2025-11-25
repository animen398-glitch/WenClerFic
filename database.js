const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// На Vercel используем /tmp для записи, иначе локальную папку data
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
const DB_DIR = isVercel ? '/tmp' : path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'wenclerfic.db');

// Создаем папку для БД если её нет (только для локальной разработки)
if (!isVercel) {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

// Создаем и подключаемся к БД
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Ошибка подключения к БД:', err.message);
  } else {
    console.log('Подключено к SQLite базе данных');
  }
});

function ensureColumn(table, column, definition) {
  db.all(`PRAGMA table_info(${table})`, (err, rows) => {
    if (err) {
      console.error(`Ошибка получения схемы таблицы ${table}:`, err);
      return;
    }
    const exists = rows.some(row => row.name === column);
    if (!exists) {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, (alterErr) => {
        if (alterErr) {
          console.error(`Ошибка добавления столбца ${column} в таблицу ${table}:`, alterErr);
        } else {
          console.log(`Столбец ${column} добавлен в таблицу ${table}`);
        }
      });
    }
  });
}

// Инициализация таблиц
function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Таблица пользователей
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        avatar TEXT,
        provider TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          console.error('Ошибка создания таблицы users:', err);
          reject(err);
        } else {
          ensureColumn('users', 'isProfileComplete', 'INTEGER DEFAULT 1');
        }
      });

      // Таблица фанфиков
      db.run(`CREATE TABLE IF NOT EXISTS fics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        authorId INTEGER NOT NULL,
        description TEXT,
        genre TEXT,
        rating TEXT,
        tags TEXT,
        views INTEGER DEFAULT 0,
        likes INTEGER DEFAULT 0,
        chapters INTEGER DEFAULT 0,
        status TEXT DEFAULT 'ongoing',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (authorId) REFERENCES users(id)
      )`, (err) => {
        if (err) {
          console.error('Ошибка создания таблицы fics:', err);
          reject(err);
        }
      });

      // Таблица глав
      db.run(`CREATE TABLE IF NOT EXISTS chapters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ficId INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        order INTEGER NOT NULL,
        words INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ficId) REFERENCES fics(id) ON DELETE CASCADE
      )`, (err) => {
        if (err) {
          console.error('Ошибка создания таблицы chapters:', err);
          reject(err);
        }
      });

      // Таблица комментариев
      db.run(`CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ficId INTEGER NOT NULL,
        authorId INTEGER NOT NULL,
        text TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ficId) REFERENCES fics(id) ON DELETE CASCADE,
        FOREIGN KEY (authorId) REFERENCES users(id)
      )`, (err) => {
        if (err) {
          console.error('Ошибка создания таблицы comments:', err);
          reject(err);
        } else {
          // Таблица сессий
          db.run(`CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expiresAt DATETIME NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
          )`, (sessionErr) => {
            if (sessionErr) {
              console.error('Ошибка создания таблицы sessions:', sessionErr);
              reject(sessionErr);
            } else {
              // Таблица незавершенных профилей
              db.run(`CREATE TABLE IF NOT EXISTS pending_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                provider TEXT,
                meta TEXT,
                expiresAt DATETIME NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
              )`, (pendingErr) => {
                if (pendingErr) {
                  console.error('Ошибка создания таблицы pending_profiles:', pendingErr);
                  reject(pendingErr);
                } else {
                  // Таблица действий пользователей
                  db.run(`CREATE TABLE IF NOT EXISTS user_actions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    userId INTEGER NOT NULL,
                    actionType TEXT NOT NULL,
                    targetType TEXT,
                    targetId INTEGER,
                    metadata TEXT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
                  )`, (actionsErr) => {
                    if (actionsErr) {
                      console.error('Ошибка создания таблицы user_actions:', actionsErr);
                      reject(actionsErr);
                    } else {
                      cleanupExpiredSessions().catch(err => {
                        console.error('Ошибка очистки просроченных сессий:', err);
                      });
                      cleanupExpiredPendingProfiles().catch(err => {
                        console.error('Ошибка очистки незавершенных профилей:', err);
                      });
                      console.log('База данных инициализирована');
                      resolve();
                    }
                  });
                }
              });
            }
          });
        }
      });
    });
  });
}

// Users
function createUser(user) {
  return new Promise((resolve, reject) => {
    const { username, email, password, avatar, provider, isProfileComplete = 1 } = user;
    db.run(
      `INSERT INTO users (username, email, password, avatar, provider, isProfileComplete) VALUES (?, ?, ?, ?, ?, ?)`,
      [username, email, password, avatar || null, provider || null, isProfileComplete ? 1 : 0],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ ...user, id: this.lastID });
        }
      }
    );
  });
}

function getUserById(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM users WHERE id = ?`, [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function getUserByEmail(email) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function getUserByUsername(username) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function updateUser(id, updates = {}) {
  return new Promise((resolve, reject) => {
    const fields = Object.keys(updates);
    if (fields.length === 0) {
      resolve(null);
      return;
    }

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => updates[field]);
    values.push(id);

    db.run(`UPDATE users SET ${setClause} WHERE id = ?`, values, function(err) {
      if (err) {
        reject(err);
      } else {
        getUserById(id).then(resolve).catch(reject);
      }
    });
  });
}

// Sessions
function createSession({ userId, token, expiresAt }) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO sessions (userId, token, expiresAt) VALUES (?, ?, ?)`,
      [userId, token, expiresAt],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, userId, token, expiresAt });
        }
      }
    );
  });
}

function getSessionByToken(token) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM sessions WHERE token = ?`, [token], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function deleteSessionByToken(token) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM sessions WHERE token = ?`, [token], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ success: this.changes > 0 });
      }
    });
  });
}

function deleteSessionsByUser(userId) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM sessions WHERE userId = ?`, [userId], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ deleted: this.changes });
      }
    });
  });
}

function cleanupExpiredSessions() {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM sessions WHERE expiresAt < datetime('now')`, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ deleted: this.changes });
      }
    });
  });
}

// Pending profiles
function createPendingProfile({ userId, token, provider, meta, expiresAt }) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO pending_profiles (userId, token, provider, meta, expiresAt) VALUES (?, ?, ?, ?, ?)`,
      [userId, token, provider || null, meta || null, expiresAt],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, userId, token, provider, meta, expiresAt });
        }
      }
    );
  });
}

function getPendingProfileByToken(token) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM pending_profiles WHERE token = ?`, [token], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function deletePendingProfileByToken(token) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM pending_profiles WHERE token = ?`, [token], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ deleted: this.changes });
      }
    });
  });
}

function deletePendingProfilesByUser(userId) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM pending_profiles WHERE userId = ?`, [userId], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ deleted: this.changes });
      }
    });
  });
}

function cleanupExpiredPendingProfiles() {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM pending_profiles WHERE expiresAt < datetime('now')`, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ deleted: this.changes });
      }
    });
  });
}

// Fics
function createFic(fic) {
  return new Promise((resolve, reject) => {
    const { title, authorId, description, genre, rating, tags, status } = fic;
    const tagsStr = Array.isArray(tags) ? JSON.stringify(tags) : tags;
    db.run(
      `INSERT INTO fics (title, authorId, description, genre, rating, tags, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, authorId, description, genre, rating, tagsStr, status || 'ongoing'],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ ...fic, id: this.lastID });
        }
      }
    );
  });
}

function getFicById(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM fics WHERE id = ?`, [id], (err, row) => {
      if (err) {
        reject(err);
      } else {
        if (row && row.tags) {
          try {
            row.tags = JSON.parse(row.tags);
          } catch (e) {
            row.tags = [];
          }
        }
        resolve(row);
      }
    });
  });
}

function getAllFics(filters = {}) {
  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM fics WHERE 1=1`;
    const params = [];

    if (filters.genre) {
      query += ` AND genre = ?`;
      params.push(filters.genre);
    }

    if (filters.rating) {
      query += ` AND rating = ?`;
      params.push(filters.rating);
    }

    // Сортировка
    const sortBy = filters.sort || 'newest';
    switch (sortBy) {
      case 'newest':
        query += ` ORDER BY updatedAt DESC`;
        break;
      case 'popular':
        query += ` ORDER BY views DESC`;
        break;
      case 'rating':
        query += ` ORDER BY likes DESC`;
        break;
      case 'views':
        query += ` ORDER BY views DESC`;
        break;
    }

    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        const fics = rows.map(row => {
          if (row.tags) {
            try {
              row.tags = JSON.parse(row.tags);
            } catch (e) {
              row.tags = [];
            }
          }
          return row;
        });
        resolve(fics);
      }
    });
  });
}

function updateFic(id, updates) {
  return new Promise((resolve, reject) => {
    const fields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
      if (key === 'tags' && Array.isArray(updates[key])) {
        fields.push(`${key} = ?`);
        values.push(JSON.stringify(updates[key]));
      } else if (key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });

    fields.push('updatedAt = CURRENT_TIMESTAMP');
    values.push(id);

    db.run(
      `UPDATE fics SET ${fields.join(', ')} WHERE id = ?`,
      values,
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, ...updates });
        }
      }
    );
  });
}

function deleteFic(id) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM fics WHERE id = ?`, [id], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ success: true });
      }
    });
  });
}

function getUserFics(userId) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM fics WHERE authorId = ? ORDER BY updatedAt DESC`, [userId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        const fics = rows.map(row => {
          if (row.tags) {
            try {
              row.tags = JSON.parse(row.tags);
            } catch (e) {
              row.tags = [];
            }
          }
          return row;
        });
        resolve(fics);
      }
    });
  });
}

// Chapters
function createChapter(chapter) {
  return new Promise((resolve, reject) => {
    const { ficId, title, content, order } = chapter;
    const words = content.trim().split(/\s+/).filter(w => w).length;
    
    db.run(
      `INSERT INTO chapters (ficId, title, content, \`order\`, words) VALUES (?, ?, ?, ?, ?)`,
      [ficId, title, content, order, words],
      function(err) {
        if (err) {
          reject(err);
        } else {
          // Обновляем счетчик глав в фанфике
          db.run(`UPDATE fics SET chapters = chapters + 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, [ficId]);
          resolve({ ...chapter, id: this.lastID, words });
        }
      }
    );
  });
}

function getChaptersByFicId(ficId) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM chapters WHERE ficId = ? ORDER BY \`order\` ASC`, [ficId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function getChapterById(ficId, chapterId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM chapters WHERE id = ? AND ficId = ?`, [chapterId, ficId], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function updateChapter(ficId, chapterId, updates) {
  return new Promise((resolve, reject) => {
    const fields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
      if (key === 'content') {
        fields.push(`${key} = ?`);
        const words = updates[key].trim().split(/\s+/).filter(w => w).length;
        values.push(updates[key]);
        fields.push('words = ?');
        values.push(words);
      } else if (key !== 'id' && key !== 'ficId') {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });

    fields.push('updatedAt = CURRENT_TIMESTAMP');
    values.push(chapterId, ficId);

    db.run(
      `UPDATE chapters SET ${fields.join(', ')} WHERE id = ? AND ficId = ?`,
      values,
      function(err) {
        if (err) {
          reject(err);
        } else {
          // Обновляем дату фанфика
          db.run(`UPDATE fics SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, [ficId]);
          resolve({ id: chapterId, ...updates });
        }
      }
    );
  });
}

function deleteChapter(ficId, chapterId) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM chapters WHERE id = ? AND ficId = ?`, [chapterId, ficId], function(err) {
      if (err) {
        reject(err);
      } else {
        // Уменьшаем счетчик глав
        db.run(`UPDATE fics SET chapters = GREATEST(chapters - 1, 0), updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, [ficId]);
        resolve({ success: true });
      }
    });
  });
}

// Comments
function createComment(comment) {
  return new Promise((resolve, reject) => {
    const { ficId, authorId, text } = comment;
    db.run(
      `INSERT INTO comments (ficId, authorId, text) VALUES (?, ?, ?)`,
      [ficId, authorId, text],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ ...comment, id: this.lastID });
        }
      }
    );
  });
}

function getCommentsByFicId(ficId) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM comments WHERE ficId = ? ORDER BY createdAt DESC`, [ficId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Increment views
function incrementFicViews(id) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE fics SET views = views + 1 WHERE id = ?`, [id], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ success: true });
      }
    });
  });
}

// User Actions
function logUserAction(userId, actionType, targetType = null, targetId = null, metadata = null) {
  return new Promise((resolve, reject) => {
    const metaStr = metadata ? JSON.stringify(metadata) : null;
    db.run(
      `INSERT INTO user_actions (userId, actionType, targetType, targetId, metadata) VALUES (?, ?, ?, ?, ?)`,
      [userId, actionType, targetType, targetId, metaStr],
      function(err) {
        if (err) {
          console.error('Ошибка логирования действия:', err);
          reject(err);
        } else {
          resolve({ id: this.lastID });
        }
      }
    );
  });
}

function getUserActions(userId, limit = 50) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM user_actions WHERE userId = ? ORDER BY createdAt DESC LIMIT ?`,
      [userId, limit],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function getUserActionsByType(userId, actionType, limit = 50) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM user_actions WHERE userId = ? AND actionType = ? ORDER BY createdAt DESC LIMIT ?`,
      [userId, actionType, limit],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

module.exports = {
  db,
  initDatabase,
  // Users
  createUser,
  getUserById,
  getUserByEmail,
  getUserByUsername,
  updateUser,
  // Fics
  createFic,
  getFicById,
  getAllFics,
  updateFic,
  deleteFic,
  getUserFics,
  incrementFicViews,
  // Chapters
  createChapter,
  getChaptersByFicId,
  getChapterById,
  updateChapter,
  deleteChapter,
  // Comments
  createComment,
  getCommentsByFicId,
  // Sessions
  createSession,
  getSessionByToken,
  deleteSessionByToken,
  deleteSessionsByUser,
  cleanupExpiredSessions,
  // Pending profiles
  createPendingProfile,
  getPendingProfileByToken,
  deletePendingProfileByToken,
  deletePendingProfilesByUser,
  cleanupExpiredPendingProfiles,
  // User Actions
  logUserAction,
  getUserActions,
  getUserActionsByType
};

