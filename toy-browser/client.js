const net = require('net');

class Request {
    //method, url(host,port,path), body, headers
    constructor(options) {
        this.method = options.method || "GET";
        this.host = options.host;
        this.port = options.port || 80;
        this.path = options.path || '/';
        this.body = options.body || {};
        this.headers = options.headers || {};
        if(!this.headers["Content-Type"]) {
            this.headers["Content-Type"] = "application/x-www-form-urlencoded";
        }
        if(this.headers["Content-Type"] === "application/json") {
            this.bodyText = JSON.stringify(this.body);
        } else if(this.headers["Content-Type"] === "application/x-www-form-urlencoded") {
            this.bodyText = Object.keys(this.body).map(key => `${key}=${encodeURIComponent(this.body[key])}`).join('&');
        }

        this.headers["Content-Length"] = this.bodyText.length;
    }

    toString() {
        return `${this.method} ${this.path} HTTP/1.1\r
${Object.keys(this.headers).map(key => `${key}: ${this.headers[key]}`).join('\r\n')}\r
\r
${this.bodyText}`;
    }

    send(connection) {
        return new Promise((resolve,reject) => {
            let parser = new ResponseParser();
            if(connection) {
                connection.write(this.toString());
            } else {
                connection = net.createConnection({
                    host: this.host,
                    port: this.port
                }, () => {
                    connection.write(this.toString());
                });
            }
            connection.on('data', (data) => {
                parser.receive(data.toString());
                if(parser.isFinished) {
                    resolve(parser.response);
                }
                //resolve(data.toString());
                connection.end();
            });
            connection.on('error', (err) => {
                reject(err);
                connection.end();
            });
        });
        
    }
}

class ResponseParser {
    constructor() {
        this.WAITING_STATUS_LINE = 0;
        this.WAITING_STATUS_LINE_END = 1;
        this.WAITING_HEADER_NAME = 2;
        this.WAITING_HEADER_SPACE = 3;
        this.WAITING_HEADER_VALUE = 4;
        this.WAITING_HEADER_LINE_END = 5;
        this.WAITING_HEADER_BLOCK_END = 6;
        this.WAITING_BODY = 7;

        this.current = this.WAITING_STATUS_LINE;
        this.statusLine = '';
        this.headerName = '';
        this.headerValue = '';
        this.headers = {};
        this.bodyParser = null;
    }

    
    get isFinished() {
        return this.bodyParser && this.bodyParser.isFinished;
    }

    get response() {
        this.statusLine.match(/HTTP\/1.1 ([0-9]+) ([\s\S]+)/);
        return {
            statusCode: RegExp.$1,
            statusText: RegExp.$2,
            header: this.headers,
            body: this.bodyParser.content.join('')
        };
    }

    receive(str) {
        for(let i = 0; i < str.length; i++) {
            this.receiveChar(str.charAt(i));
        }
    }

    receiveChar(char) {
        //console.log(char);
        switch(this.current) {
            case this.WAITING_STATUS_LINE :
                if(char === '\r') {
                    this.current = this.WAITING_STATUS_LINE_END;
                } else {
                    this.statusLine += char;
                }
                break;
            case this.WAITING_STATUS_LINE_END :
                if(char === '\n') {
                    this.current = this.WAITING_HEADER_NAME;
                }
                break;
            case this.WAITING_HEADER_NAME : 
                if(char === ':') {
                    this.current = this.WAITING_HEADER_SPACE;
                } else if(char === '\r') {
                    this.current = this.WAITING_HEADER_BLOCK_END;
                    this.bodyParser = new TrunkedBodyParser();
                } else {
                    this.headerName += char;
                }
                break;
            case this.WAITING_HEADER_SPACE :
                if(char === ' ') {
                    this.current = this.WAITING_HEADER_VALUE;
                }
                break;
            case this.WAITING_HEADER_VALUE :
                if(char === '\r') {
                    this.current = this.WAITING_HEADER_LINE_END;
                    this.headers[this.headerName] = this.headerValue;
                    this.headerName = '';
                    this.headerValue = '';
                } else {
                    this.headerValue += char;
                }
                break;
            case this.WAITING_HEADER_LINE_END :
                if(char === '\n') {
                    this.current = this.WAITING_HEADER_NAME;
                }
                break;
            case this.WAITING_HEADER_BLOCK_END :
                if(char === '\n') {
                    this.current = this.WAITING_BODY;
                }
                break;
            case this.WAITING_BODY :
                this.bodyParser.receiveChar(char);
        }
    }
}

class TrunkedBodyParser {
    constructor() {
        this.WAITING_LENGTH = 0;
        this.WAITING_LENGTH_LINE_END = 1;
        this.READING_TRUNK = 2;
        this.WAITING_NEW_LINE = 3;
        this.WAITING_NEW_LINE_END = 4;
        this.length = 0;
        this.content = [];
        this.isFinished = false;

        this.current = this.WAITING_LENGTH;
    }

    receiveChar(char) {
        switch(this.current) {
            case this.WAITING_LENGTH:
                if(char === '\r') {
                    if(this.length === 0) {
                        console.log(this.content);
                        this.isFinished = true;
                    } else {
                        this.current = this.WAITING_LENGTH_LINE_END;
                    }                    
                } else {
                    this.length *= 16;
                    this.length += parseInt(char, 16);
                }
                break;
            case this.WAITING_LENGTH_LINE_END:
                if(char === '\n') {
                    this.current = this.READING_TRUNK;
                }
                break;
            case this.READING_TRUNK:
                this.content.push(char);
                this.length--;
                if(this.length === 0) {
                    this.current = this.WAITING_NEW_LINE;
                }
                break;
            case this.WAITING_NEW_LINE:
                if(char === '\r') {
                    this.current = this.WAITING_NEW_LINE_END;
                }
                break;
            case this.WAITING_NEW_LINE_END:
                if(char === '\n') {
                    this.current = this.WAITING_LENGTH;
                }
        }
    }
}

(async () => {
    let request = new Request({
        method: "POST",
        host: "127.0.0.1",
        port: "8088",
        path: "/",
        headers: {
            "Foo": "bar"
        },
        body: {
            name: "hello"
        }
    });

    let res = await request.send();
    console.log(res);
})();


