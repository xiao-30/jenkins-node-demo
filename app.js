const http = require('node:http');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8'
  });

  res.end(JSON.stringify({
    message: 'Hello Jenkins CI/CD!',
    appName: 'jenkins-node-demo',
    version: '1.0.1',
    hostname: require('node:os').hostname(),
    path: req.url,
    timestamp: new Date().toISOString()
  }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
