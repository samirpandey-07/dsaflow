function ok(res, data, status = 200) {
    return res.status(status).json({ status: 'success', data });
}

function fail(res, status, message, details) {
    return res.status(status).json({
        status: 'error',
        message,
        ...(details ? { details } : {}),
    });
}

module.exports = { ok, fail };
