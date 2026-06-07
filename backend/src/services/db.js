import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const DB_FILE = process.env.DB_PATH || './data/db.json';
const dbPath = path.resolve(DB_FILE);

// Ensure data directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// In-memory data store
let data = {
  users: [],
  posts: [],
  comments: [],
  likes: [],
  follows: [],
  notifications: [],
  ai_interactions: [],
  trend_analysis: [],
  content_flags: [],
  reels: []
};

// Load database from file
const load = () => {
  try {
    if (fs.existsSync(dbPath)) {
      const fileData = fs.readFileSync(dbPath, 'utf-8');
      if (fileData.trim()) {
        const parsed = JSON.parse(fileData);
        data = { ...data, ...parsed };
      }
    } else {
      save(); // Create initial empty database file
    }
  } catch (error) {
    console.error('Error loading database, initializing empty store:', error);
    save();
  }
};

// Save database to file
const save = () => {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving database to file:', error);
  }
};

// Initial load
load();

// Database Interface Engine
const db = {
  // Query all items in a collection
  collection: (name) => {
    if (!data[name]) {
      data[name] = [];
    }
    return {
      find: (filter = {}) => {
        let results = [...data[name]];
        
        // Filter support (exact match or function)
        if (typeof filter === 'function') {
          results = results.filter(filter);
        } else {
          results = results.filter(item => {
            for (const key in filter) {
              if (item[key] !== filter[key]) return false;
            }
            return true;
          });
        }
        
        // Sorting and limiting helper chain
        const chain = {
          sort: (sortFunc) => {
            results.sort(sortFunc);
            return chain;
          },
          limit: (n) => {
            results = results.slice(0, n);
            return chain;
          },
          offset: (n) => {
            results = results.slice(n);
            return chain;
          },
          exec: () => results
        };
        
        return chain;
      },

      findOne: (filter = {}) => {
        const results = data[name];
        if (typeof filter === 'function') {
          return results.find(filter) || null;
        }
        return results.find(item => {
          for (const key in filter) {
            if (item[key] !== filter[key]) return false;
          }
          return true;
        }) || null;
      },

      insert: (item) => {
        const newItem = {
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...item
        };
        data[name].push(newItem);
        save();
        return newItem;
      },

      update: (filter, updateData) => {
        let count = 0;
        const results = data[name];
        const filterFunc = typeof filter === 'function' 
          ? filter 
          : (item) => {
              for (const key in filter) {
                if (item[key] !== filter[key]) return false;
              }
              return true;
            };

        data[name] = results.map(item => {
          if (filterFunc(item)) {
            count++;
            return {
              ...item,
              ...updateData,
              updated_at: new Date().toISOString()
            };
          }
          return item;
        });

        if (count > 0) save();
        return count;
      },

      delete: (filter) => {
        const beforeCount = data[name].length;
        const filterFunc = typeof filter === 'function'
          ? filter
          : (item) => {
              for (const key in filter) {
                if (item[key] !== filter[key]) return false;
              }
              return true;
            };

        data[name] = data[name].filter(item => !filterFunc(item));
        const deletedCount = beforeCount - data[name].length;
        
        if (deletedCount > 0) save();
        return deletedCount;
      },

      count: (filter = {}) => {
        return db.collection(name).find(filter).exec().length;
      }
    };
  },
  
  // Custom transaction save
  save: () => save(),
  
  // Clear all data (useful for resets/seeds)
  reset: () => {
    data = {
      users: [],
      posts: [],
      comments: [],
      likes: [],
      follows: [],
      notifications: [],
      ai_interactions: [],
      trend_analysis: [],
      content_flags: [],
      reels: []
    };
    save();
  }
};

export default db;
