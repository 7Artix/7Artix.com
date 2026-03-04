import express from 'express';
import cors from 'cors';
import fs from 'fs';
import objectRoutes from './routes/objects.js';
import tagRoutes from './routes/tags.js';
import pinnedRoutes from './routes/pinned.js';
import userRoutes from './routes/users.js';
import { getAllObjectsFromFiles } from './utils.js'; 
import { DATA_PATH } from './config.js';
import { loginUser, verifyToken } from './auth.js';
import rateLimit from 'express-rate-limit';

const app = express();

// Trust the proxy (Cloudflare Tunnel) to correctly identify HTTPS
app.set('trust proxy', 1);

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

app.use('/api/objects', objectRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/pinned', pinnedRoutes);
app.use('/api/users', userRoutes);
app.use('/api/static', express.static(DATA_PATH));

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Backend Engine running at PORT: ${PORT}`);
});
