const app = require('../server/app');

module.exports = (req, res) => {
  const routedPath = typeof req.query?.path === 'string' ? req.query.path : '';
  const search = new URLSearchParams(req.url.split('?')[1] || '');
  search.delete('path');

  req.url = routedPath === 'health'
    ? '/health'
    : `/api/${routedPath}${search.size ? `?${search}` : ''}`;

  return app(req, res);
};
