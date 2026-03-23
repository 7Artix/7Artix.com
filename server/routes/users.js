import express from 'express';
import { getUsers, saveUsers, hashPassword, generateID } from '../utils.js';
import { requireAdmin } from '../auth.js';

const router = express.Router();

// Search users by name (Logged in users)
router.get('/search', (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);
    
    const users = getUsers();
    const filtered = users
        .filter(u => u.username.toLowerCase().includes(q.toLowerCase()))
        .map(({ id, username }) => ({ id, username })); // Only return id and username
    
    res.json(filtered);
});

// List all users (Admin only)
router.get('/', requireAdmin, (req, res) => {
    const users = getUsers().map(({ password, ...u }) => u);
    res.json(users);
});

// Create a new user (Admin only)
router.post('/', requireAdmin, (req, res) => {
    const { username, password, role } = req.body;
    
    if (!username || !password || !role) {
        return res.status(400).json({ success: false, message: 'Missing fields' });
    }

    const users = getUsers();
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ success: false, message: 'Username already exists' });
    }

    const newUser = {
        id: generateID(),
        username,
        password: hashPassword(password),
        role: role === 'admin' ? 'admin' : 'user',
        passwordChangedAt: Math.floor(Date.now() / 1000)
    };

    users.push(newUser);
    saveUsers(users);

    const { password: _, ...userWithoutPassword } = newUser;
    res.json({ success: true, user: userWithoutPassword });
});

// Update user (Admin only)
router.put('/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { username, password, role } = req.body;
    
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === id);

    if (userIndex === -1) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check username uniqueness if changed
    if (username && username !== users[userIndex].username) {
        if (users.find(u => u.username === username)) {
            return res.status(400).json({ success: false, message: 'Username already exists' });
        }
        users[userIndex].username = username;
    }

    if (password) {
        users[userIndex].password = hashPassword(password);
        users[userIndex].passwordChangedAt = Math.floor(Date.now() / 1000);
    }

    if (role) {
        users[userIndex].role = role === 'admin' ? 'admin' : 'user';
    }

    saveUsers(users);
    const { password: _, ...userWithoutPassword } = users[userIndex];
    res.json({ success: true, user: userWithoutPassword });
});

// Delete user (Admin only)
router.delete('/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    
    // Prevent deleting self? (Optional but good)
    if (req.user.id === id) {
        return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
    }

    let users = getUsers();
    const userIndex = users.findIndex(u => u.id === id);

    if (userIndex === -1) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    users.splice(userIndex, 1);
    saveUsers(users);
    res.json({ success: true });
});

export default router;
