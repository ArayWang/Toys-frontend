const http = require("http");

const server = http.createServer((req, res) => {
    console.log("request received");
    console.log(req.headers);
    res.setHeader('X-Foo', 'bar');
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('OK');
});

server.listen(8088);