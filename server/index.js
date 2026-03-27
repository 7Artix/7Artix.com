import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import objectRoutes from './routes/objects.js';
import tagRoutes from './routes/tags.js';
import pinnedRoutes from './routes/pinned.js';
import userRoutes from './routes/users.js';
import { getAllObjectsFromFiles } from './utils.js'; 
import { DATA_PATH } from './config.js';
import { loginUser, verifyToken } from './auth.js';
import rateLimit from 'express-rate-limit';
import { UAParser } from 'ua-parser-js';

const app = express();

// Trust the proxy (Cloudflare Tunnel) to correctly identify HTTPS
app.set('trust proxy', 1);

// --- Access Logging Middleware ---
const logDir = path.join(DATA_PATH, 'logs');
if (fs.existsSync(DATA_PATH) && !fs.existsSync(logDir)) {
    try {
        fs.mkdirSync(logDir);
    } catch (e) {
        console.error('Failed to create logs directory:', e);
    }
}

app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        
        // Priority for real IP: 
        // 1. CF-Connecting-IP (Cloudflare Tunnel)
        // 2. X-Forwarded-For (Proxies like Nginx)
        // 3. X-Real-IP (Nginx)
        // 4. req.ip (Express resolved IP based on trust proxy)
        let clientIp = req.headers['cf-connecting-ip'] || 
                       req.headers['x-forwarded-for'] || 
                       req.headers['x-real-ip'] || 
                       req.ip || 
                       '-';
        
        // If X-Forwarded-For is a list, take the first IP (the original client)
        if (clientIp.includes(',')) {
            clientIp = clientIp.split(',')[0].trim();
        }
        
        const country = req.headers['cf-ipcountry'] || '-';
        const timestamp = new Date().toISOString();
        const method = req.method;
        const url = req.originalUrl || req.url;
        const status = res.statusCode;
        const userAgent = req.headers['user-agent'] || '-';
        const referer = req.headers['referer'] || '-';

        // Filter out noisy requests from logging to keep the log clean and meaningful
        // Only log actual page navigations (track) and login attempts.
        const isTrack = url.startsWith('/api/track');
        const isLogin = url.startsWith('/api/login') && method === 'POST';
        
        if (!isTrack && !isLogin) {
            return; // Skip logging this request
        }

        // Decode the URL if it's a track request (e.g., convert %2F to /)
        let displayUrl = url;
        if (isTrack) {
            try {
                displayUrl = decodeURIComponent(url);
            } catch (e) {
                // Keep original if decoding fails
            }
        }

        // Try to decode JWT to check if request is from a logged in user 
        // (Since this logger runs before the auth middleware)
        let username = 'guest';
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                // Do a quick unsafe decode just for logging purposes
                const payload = Buffer.from(token.split('.')[1], 'base64').toString();
                const decoded = JSON.parse(payload);
                if (decoded && decoded.username) {
                    username = decoded.username;
                }
            } catch (e) {
                // Ignore parsing errors, just fall back to 'guest'
            }
        }

        // Parse User-Agent for better readability
        const parser = new UAParser(userAgent);
        const browser = parser.getBrowser().name || 'Unknown';
        const os = parser.getOS().name || 'Unknown';
        const device = parser.getDevice().type || 'desktop'; // If empty, it's usually desktop
        const platformInfo = `${os}/${browser}/${device}`;

        // Format: [ISO Date] IP [Country] METHOD URL STATUS DURATIONms [User: username] (PlatformInfo)
        const logLine = `[${timestamp}] ${clientIp} [${country}] ${method} ${displayUrl} ${status} ${duration}ms [User: ${username}] (${platformInfo})\n`;

        // Output to console for quick docker logs debugging (Only if we aren't spamming)
        console.log(`[Access] ${clientIp} [${country}] ${method} ${displayUrl} ${status} ${duration}ms [User: ${username}] (${platformInfo})`);

        // Write to log file in data volume for convenient viewing
        if (fs.existsSync(logDir)) {
            // Log rotation per month to avoid huge files, e.g., access-YYYY-MM.log
            const monthStr = timestamp.substring(0, 7); 
            const logFile = path.join(logDir, `access-${monthStr}.log`);
            fs.appendFile(logFile, logLine, (err) => {
                if (err) console.error('[Log Error] Failed to write to access log:', err);
            });
        }
    });
    next();
});

// --- Dynamic Sitemap & Robots ---

// Helper to get dynamic base URL
const getBaseUrl = (req) => {
    return `${req.protocol}://${req.get('host')}`;
};

app.get('/sitemap.xml', (req, res) => {
    const baseUrl = getBaseUrl(req);
    
    try {
        const objects = getAllObjectsFromFiles();
        
        let urls = [
            { loc: '/', priority: '1.0', changefreq: 'daily' },
            { loc: '/cv', priority: '0.8', changefreq: 'weekly' },
            { loc: '/me', priority: '0.7', changefreq: 'monthly' },
        ];

        objects.forEach(obj => {
            // Only include public objects
            if (!obj.visibility || obj.visibility === 'public') {
                urls.push({
                    loc: `/object/${obj.id}`,
                    lastmod: obj.dateModified || obj.dateCreated,
                    priority: '0.5',
                    changefreq: 'weekly'
                });
            }
        });

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

        urls.forEach(u => {
            xml += '  <url>\n';
            xml += `    <loc>${baseUrl}${u.loc}</loc>\n`;
            if (u.lastmod) {
                try {
                    const dateStr = new Date(u.lastmod).toISOString().split('T')[0];
                    xml += `    <lastmod>${dateStr}</lastmod>\n`;
                } catch (e) {}
            }
            xml += `    <changefreq>${u.changefreq}</changefreq>\n`;
            xml += `    <priority>${u.priority}</priority>\n`;
            xml += '  </url>\n';
        });

        xml += '</urlset>';
        res.header('Content-Type', 'application/xml');
        res.send(xml);
    } catch (e) {
        console.error("Sitemap error:", e);
        res.status(500).send("Error generating sitemap");
    }
});

app.get('/robots.txt', (req, res) => {
    const baseUrl = getBaseUrl(req);
    const sitemapUrl = `${baseUrl}/sitemap.xml`;

    const txt = `User-agent: *
Allow: /

Disallow: /admin/
Disallow: /admin
Disallow: /login/
Disallow: /login

Disallow: /api/login
Disallow: /api/users
Disallow: /api/check-auth

Sitemap: ${sitemapUrl}`;

    res.header('Content-Type', 'text/plain');
    res.send(txt);
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 10,
    message: { success: false, message: "Too many login attempts, please try again later." }
});

if (!fs.existsSync(DATA_PATH)) {
    console.error(`\n[Data] : Data Directory Not Found: ${DATA_PATH}`);
} else {
    console.log(`[Data] Static Data Mapping: /api/static -> ${DATA_PATH}\n`);
}

app.use(cors());
app.use(express.json());

// Endpoint specifically for tracking SPA frontend navigations
app.get('/api/track', (req, res) => {
    // We don't need to do anything here. 
    // The access logging middleware will automatically record this request.
    res.status(204).end(); // 204 No Content
});

app.post('/api/login', loginLimiter, (req, res) => {
    const { username, password } = req.body;
    const result = loginUser(username, password);
    if (result.success) {
        res.json(result);
    } else {
        res.status(401).json(result);
    }
});

app.get('/api/check-auth', verifyToken, (req, res) => {
    res.json({ success: true, user: req.user });
});

// Admin endpoint to read current access logs
app.get('/api/admin/logs', verifyToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    
    const timestamp = new Date().toISOString();
    const monthStr = timestamp.substring(0, 7); 
    const logFile = path.join(DATA_PATH, 'logs', `access-${monthStr}.log`);
    
    if (fs.existsSync(logFile)) {
        fs.readFile(logFile, 'utf8', (err, data) => {
            if (err) return res.status(500).send('Failed to read log file.');
            res.header('Content-Type', 'text/plain');
            res.send(data);
        });
    } else {
        res.header('Content-Type', 'text/plain');
        res.send("No access logs generated for this month yet.");
    }
});

app.use('/api/objects', objectRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/pinned', pinnedRoutes);
app.use('/api/users', userRoutes);
app.use('/api/static', express.static(DATA_PATH));

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Backend Engine running at PORT: ${PORT}`);
});
