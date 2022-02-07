"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
// @ts-nocheck
const express_1 = (0, tslib_1.__importDefault)(require("express"));
const http = (0, tslib_1.__importStar)(require("http"));
const WebSocket = (0, tslib_1.__importStar)(require("ws"));
const randomstring_1 = (0, tslib_1.__importDefault)(require("randomstring"));
const app = (0, express_1.default)();
//initialize a simple http server
const server = http.createServer(app);
//initialize the WebSocket server instance
const wss = new WebSocket.Server({ server, path: "/ws" });
let rooms = {};
app.get("/rooms", (req, res) => {
    res.send(rooms);
});
wss.on('connection', (ws) => {
    ws.binaryType = 'arraybuffer';
    ws.id = randomstring_1.default.generate(7);
    //connection is up, let's add a simple simple event
    ws.on('message', (message) => {
        try {
            if (typeof message != "string") {
                if (message.byteLength == 6) {
                    rooms[ws.room]['users'][ws.intid]['position'] = Buffer.from(message);
                    let a = Buffer.alloc(1);
                    a = ((a ^ ws.intid) << 2) ^ 1;
                    let payload = Buffer.concat([Buffer.from([a]), Buffer.from(message)]);
                    for (let user in rooms[ws.room]['users']) {
                        if (user != ws.intid && rooms[ws.room]['users'][user].hasOwnProperty("ws")) {
                            rooms[ws.room]['users'][user]["ws"].send(payload);
                        }
                        if (rooms[ws.room]['users'][ws.intid]['new_user'] && user != ws.intid && rooms[ws.room]['users'][user].hasOwnProperty("position")) {
                            let b = Buffer.alloc(1);
                            b = ((b ^ user) << 2) ^ 1;
                            let tp = Buffer.concat([Buffer.from([b]), rooms[ws.room]['users'][user]['position']]);
                            ws.send(tp);
                            ws.send(JSON.stringify({ response: 'rgb', id: user, rgb: rooms[ws.room]['users'][user]['rgb'] }));
                            rooms[ws.room]['users'][user]["ws"].send(JSON.stringify({ response: 'rgb', id: ws.intid, rgb: rooms[ws.room]['users'][ws.intid]['rgb'] }));
                            if (rooms[ws.room]['users'][user]["mic"]) {
                                ws.send(JSON.stringify({ response: 'mic_on', id: user }));
                            }
                        }
                    }
                    if (rooms[ws.room]['users'][ws.intid]['new_user']) {
                        rooms[ws.room]['users'][ws.intid]['new_user'] = false;
                    }
                }
                else if (message.byteLength == 9) {
                    let a = Buffer.alloc(1);
                    a = ((a ^ ws.intid) << 2);
                    let payload = Buffer.concat([Buffer.from([a]), Buffer.from(message)]);
                    for (let user in rooms[ws.room]['users']) {
                        if (user != ws.intid && rooms[ws.room]['users'][user].hasOwnProperty("ws")) {
                            rooms[ws.room]['users'][user]["ws"].send(payload);
                        }
                    }
                }
            }
            else {
                message = JSON.parse(message);
                if (message.action == "join") {
                    if (!rooms.hasOwnProperty(message.room)) {
                        rooms[message.room] = { users: {} };
                        for (let i = 0; i < 100; i++) {
                            rooms[message.room]['users'][i] = {};
                        }
                    }
                    for (let i = 0; i < 100; i++) {
                        if (Object.keys(rooms[message.room]['users'][i]).length == 0) {
                            ws.intid = i;
                            rooms[message.room]['users'][i]["id"] = ws.id;
                            rooms[message.room]['users'][i]["new_user"] = true;
                            rooms[message.room]['users'][i]["rgb"] = [Math.random().toFixed(2), Math.random().toFixed(2), Math.random().toFixed(2)];
                            rooms[message.room]['users'][i]["mic"] = false;
                            break;
                        }
                    }
                    rooms[message.room].users[ws.intid]["ws"] = ws;
                    ws.room = message.room;
                    console.log(`User ${ws.id}-${ws.intid} joined ${ws.room} room`);
                    ws.send(JSON.stringify({ response: "room_joined", id: ws.intid, rgb: rooms[message.room].users[ws.intid]["rgb"] }));
                }
                else if (message.action == "mic_off") {
                    rooms[ws.room]['users'][ws.intid]["mic"] = false;
                    for (let user in rooms[ws.room]['users']) {
                        if (user != ws.intid && rooms[ws.room]['users'][user].hasOwnProperty("ws")) {
                            rooms[ws.room]['users'][user]["ws"].send(JSON.stringify({ response: "mic_off", id: ws.intid }));
                        }
                    }
                }
                else if (message.action == "mic_on") {
                    rooms[ws.room]['users'][ws.intid]["mic"] = true;
                    for (let user in rooms[ws.room]['users']) {
                        if (user != ws.intid && rooms[ws.room]['users'][user].hasOwnProperty("ws")) {
                            rooms[ws.room]['users'][user]["ws"].send(JSON.stringify({ response: "mic_on", id: ws.intid }));
                        }
                    }
                }
            }
        }
        catch (e) {
            console.log("Error: ws.on.message: " + e);
        }
    });
    ws.on('close', () => {
        try {
            rooms[ws.room].users[ws.intid] = {};
            let a = Buffer.alloc(1);
            a = ((a ^ ws.intid) << 2) ^ 3;
            let payload = Buffer.from([a]);
            for (let user in rooms[ws.room]['users']) {
                if (user != ws.intid && rooms[ws.room]['users'][user].hasOwnProperty("ws")) {
                    rooms[ws.room]['users'][user]["ws"].send(payload);
                }
            }
            console.log(`User ${ws.id}-${ws.intid} exited ${ws.room} room`);
        }
        catch (e) {
            console.log("Error: ws.on.close: " + e);
        }
    });
});
//start our server
server.listen(process.env.PORT || 3000, () => {
    console.log(`Server started on port ${server.address().port} :)`);
});
//# sourceMappingURL=server.js.map