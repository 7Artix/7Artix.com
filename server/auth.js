import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { getUsers, verifyPassword } from './utils.js';

dotenv.config();

const SECRET_KEY = process.env.JWT_SECRET || 'default_secret';

// 生成 Token：包含用户ID, 用户名和角色
export const generateToken = (user) => {
    return jwt.sign({ 
        id: user.id,
        username: user.username,
        role: user.role 
    }, SECRET_KEY, { expiresIn: '7d' });
};

// 中间件：验证 Token
export const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ success: false, message: 'Access Denied' });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).json({ success: false, message: 'Invalid Token' });
        
        // 检查用户是否依然存在
        const users = getUsers();
        const user = users.find(u => u.id === decoded.id);
        if (!user) {
            return res.status(401).json({ success: false, message: 'User no longer exists' });
        }

        if (user.passwordChangedAt && decoded.iat < user.passwordChangedAt) {
            return res.status(401).json({ success: false, message: 'Password has been changed, please login again' });
        }

        req.user = decoded;
        next();
    });
};

// 中间件：验证 Token (可选)
export const verifyTokenOptional = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null;
        return next();
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            req.user = null;
            return next();
        }
        
        const users = getUsers();
        const user = users.find(u => u.id === decoded.id);
        if (!user) {
            req.user = null;
            return next();
        }

        if (user.passwordChangedAt && decoded.iat < user.passwordChangedAt) {
            req.user = null;
            return next();
        }

        req.user = decoded;
        next();
    });
};

// 中间件：要求 Admin 权限
export const requireAdmin = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }
        next();
    });
};

export const loginUser = (username, password) => {
    const users = getUsers();
    const user = users.find(u => u.username === username);
    if (user && verifyPassword(password, user.password)) {
        return { 
            success: true, 
            token: generateToken(user), 
            user: { id: user.id, username: user.username, role: user.role } 
        };
    }
    return { success: false, message: 'Invalid username or password' };
};