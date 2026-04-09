function loadUserFromHeaders(req, _res, next) {
    const role = req.get('x-user-role');
    const userId = req.get('x-user-id');
    const username = req.get('x-username');

    if (role) {
        req.user = {
            user_id: userId ? Number(userId) : null,
            username: username || null,
            role: role.toLowerCase()
        };
    }

    next();
}

function requireAdmin(req, res, next) {
    const role = req.user?.role;

    if (!role) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    if (role !== 'admin' && role !== 'superadmin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    next();
}

function requireSuperadmin(req, res, next) {
    if (!req.user?.role) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Superadmin access required' });
    }

    next();
}

module.exports = {
    loadUserFromHeaders,
    requireAdmin,
    requireSuperadmin
};
