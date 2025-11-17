const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data', 'wenclerfic.db');

// Создаем папку data если её нет
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Создаем и подключаемся к БД
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Ошибка подключения к БД:', err.message);
  } else {
    console.log('Подключено к SQLite базе данных');
  }
});

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
          console.log('База данных инициализирована');
          resolve();
        }
      });
    });
  });
}

// Users
function createUser(user) {
  return new Promise((resolve, reject) => {
    const { username, email, password, avatar, provider } = user;
    db.run(
      `INSERT INTO users (username, email, password, avatar, provider) VALUES (?, ?, ?, ?, ?)`,
      [username, email, password, avatar || null, provider || null],
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

module.exports = {
  db,
  initDatabase,
  // Users
  createUser,
  getUserById,
  getUserByEmail,
  getUserByUsername,
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
  getCommentsByFicId
};

