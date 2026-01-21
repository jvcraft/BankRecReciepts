/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
    // Log error details
    console.error('[ERROR]', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });

    // Multer file upload errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            error: 'File too large',
            message: 'The uploaded file exceeds the maximum size limit (10MB)'
        });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
            error: 'Invalid upload',
            message: 'Unexpected file field in upload'
        });
    }

    // Firebase errors
    if (err.code?.startsWith('auth/')) {
        return res.status(401).json({
            error: 'Authentication error',
            message: err.message
        });
    }

    // Validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation error',
            message: err.message
        });
    }

    // Firestore errors
    if (err.code === 'not-found' || err.code === 5) {
        return res.status(404).json({
            error: 'Not found',
            message: 'The requested resource was not found'
        });
    }

    if (err.code === 'permission-denied' || err.code === 7) {
        return res.status(403).json({
            error: 'Permission denied',
            message: 'You do not have permission to access this resource'
        });
    }

    // Default server error
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        error: err.name || 'Server error',
        message: process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : err.message
    });
};

module.exports = errorHandler;
