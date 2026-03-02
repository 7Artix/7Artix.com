// server/utils.js
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import crypto from 'crypto';
import { OBJECTS_PATH, TAGS_FILE, USERS_FILE } from './config.js';

// ID Generation: 8-char hex string
export const generateID = () => {
    return crypto.randomBytes(4).toString('hex');
};

// Password hashing and verification
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keyLen: 64 };
export const hashPassword = (password) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync(password, salt, SCRYPT_PARAMS.keyLen, {
        N: SCRYPT_PARAMS.N,
        r: SCRYPT_PARAMS.r,
        p: SCRYPT_PARAMS.p
    });
    return `${salt}:${derivedKey.toString('hex')}`;
};

export const verifyPassword = (password, hash) => {
    const [salt, key] = hash.split(':');
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, SCRYPT_PARAMS.keyLen, {
        N: SCRYPT_PARAMS.N,
        r: SCRYPT_PARAMS.r,
        p: SCRYPT_PARAMS.p
    });
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
};

// User data management
export const getUsers = () => {
    if (!fs.existsSync(USERS_FILE)) return [];
    try {
        return yaml.load(fs.readFileSync(USERS_FILE, 'utf8')) || [];
    } catch { return []; }
};

export const saveUsers = (users) => {
    const dir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(USERS_FILE, yaml.dump(users, { lineWidth: -1 }));
};

const getGlobalTagIds = () => {
    if (!fs.existsSync(TAGS_FILE)) return [];
    try {
        const tags = yaml.load(fs.readFileSync(TAGS_FILE, 'utf8')) || [];
        return tags.map(t => t.id);
    } catch { return []; }
};

export const getAllObjectsFromFiles = () => {
    if (!fs.existsSync(OBJECTS_PATH)) return [];

    const globalTagIds = getGlobalTagIds();

    try {
        const folders = fs.readdirSync(OBJECTS_PATH).filter(f => 
            fs.statSync(path.join(OBJECTS_PATH, f)).isDirectory()
        );

        return folders.map(folderName => {
            const dirPath = path.join(OBJECTS_PATH, folderName);
            const configPath = path.join(dirPath, 'config.yaml');
            const statsPath = path.join(dirPath, 'stats.yaml');

            let existingConfig = {};

            if (fs.existsSync(configPath)) {
                try {
                    existingConfig = yaml.load(fs.readFileSync(configPath, 'utf8')) || {};
                } catch (e) {
                    console.error(`[Utils] Broken YAML in ${folderName}, resetting to default.`);
                    existingConfig = {};
                }
            }

            let stats = { views: 0 };
            if (fs.existsSync(statsPath)) {
                try {
                    stats = yaml.load(fs.readFileSync(statsPath, 'utf8')) || { views: 0 };
                } catch (e) {
                    console.error(`[Utils] Broken Stats YAML in ${folderName}`);
                }
            }

            const users = getUsers();
            const userPermissions = existingConfig.user || {};
            
            // Migration logic: if old fields exist, migrate them
            if (!existingConfig.user) {
                if (existingConfig.owner_id) {
                    userPermissions[existingConfig.owner_id] = "owner";
                }
                if (existingConfig.shared_with && Array.isArray(existingConfig.shared_with)) {
                    existingConfig.shared_with.forEach(uid => {
                        if (!userPermissions[uid]) userPermissions[uid] = "read";
                    });
                }
            }

            // Determine author name from owner
            const ownerId = Object.keys(userPermissions).find(uid => userPermissions[uid] === 'owner');
            const ownerUser = users.find(u => u.id === ownerId);
            const authorName = ownerUser ? ownerUser.username : (existingConfig.author || "Artix");

            // Clean up zombie users (users that no longer exist)
            const validUserIds = users.map(u => u.id);
            const cleanedUserPermissions = {};
            Object.keys(userPermissions).forEach(uid => {
                if (validUserIds.includes(uid)) {
                    cleanedUserPermissions[uid] = userPermissions[uid];
                }
            });

            const repairedConfig = {
                id: folderName,
                name: existingConfig.name || "New Object",
                dateCreated: existingConfig.dateCreated || new Date().toISOString(),
                dateModified: existingConfig.dateModified || existingConfig.dateCreated || new Date().toISOString(),
                type: existingConfig.type || "project",
                visibility: existingConfig.visibility || "public",
                user: cleanedUserPermissions,
                description: existingConfig.description || "",
                basePath: `/api/static/objects/${folderName}/`, 
                coverImage: existingConfig.coverImage || "", 
                cardImages: existingConfig.cardImages || [],
                tags: (existingConfig.tags || []).filter(tid => globalTagIds.includes(tid))
            };

            const finalObject = { ...repairedConfig, ...stats, author: authorName };

            const isMissingConfig = !fs.existsSync(configPath);
            const isDifferentConfig = JSON.stringify(existingConfig) !== JSON.stringify(repairedConfig);

            if (isMissingConfig || isDifferentConfig) {
                console.log(`[Structure-Healing] ${isMissingConfig ? 'Creating' : 'Repairing'} config for: ${folderName}`);
                fs.writeFileSync(configPath, yaml.dump(repairedConfig));
            }
            
            if (!fs.existsSync(statsPath)) {
                fs.writeFileSync(statsPath, yaml.dump({ views: 0 }));
            }

            if (!fs.existsSync(path.join(OBJECTS_PATH, folderName, 'assets', 'media'))) {
                fs.mkdirSync(path.join(OBJECTS_PATH, folderName, 'assets', 'media'), { recursive: true });
            }

            if (!fs.existsSync(path.join(OBJECTS_PATH, folderName, 'assets', 'file'))) {
                fs.mkdirSync(path.join(OBJECTS_PATH, folderName, 'assets', 'file'), { recursive: true });
            }

            return finalObject;
        });
    } catch (e) {
        console.error("[Utils] Scan fatal error:", e);
        return [];
    }
};