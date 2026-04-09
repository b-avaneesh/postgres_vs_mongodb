function requireRole(...allowedRoles) {
    return (req, res, next) => {
        const role = req.user?.role;

        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!allowedRoles.includes(role)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        next();
    };
}

module.exports = {
    requireRole
};
