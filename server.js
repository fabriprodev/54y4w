const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir los archivos estáticos del proyecto
app.use(express.static('./'));

// Base de datos en memoria para las salas
const rooms = {};

// Genera un código aleatorio de 6 caracteres para las salas
function generateRoomCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
}

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);
    
    let currentRoom = null;
    let username = null;

    // Crear una sala nueva
    socket.on('create-room', (data, callback) => {
        const { roomName, username: user } = data;
        
        if (!roomName || !user) {
            callback({ success: false, error: 'Faltan datos' });
            return;
        }

        let roomCode;
        do {
            roomCode = generateRoomCode();
        } while (rooms[roomCode]);

        rooms[roomCode] = {
            name: roomName,
            creator: user,
            users: [],
            messages: []
        };

        username = user;
        currentRoom = roomCode;
        socket.join(roomCode);
        rooms[roomCode].users.push(username);

        console.log(`Sala creada: ${roomCode} - ${roomName}`);

        callback({ 
            success: true, 
            roomCode: roomCode,
            roomName: roomName
        });
    });

    // Unirse a una sala existente
    socket.on('join-room', (data, callback) => {
        const { roomCode, username: user } = data;

        if (!roomCode || !user) {
            callback({ success: false, error: 'Faltan datos' });
            return;
        }

        const room = rooms[roomCode];
        if (!room) {
            callback({ success: false, error: 'Sala no encontrada' });
            return;
        }

        username = user;
        currentRoom = roomCode;
        socket.join(roomCode);
        room.users.push(username);

        callback({ 
            success: true, 
            roomName: room.name,
            messages: room.messages
        });

        // Avisar a los demás que alguien entró
        socket.to(roomCode).emit('user-joined', {
            username: user,
            text: `${user} se ha unido a la sala`
        });

        console.log(`${user} se unió a ${roomCode}`);
    });

    // Recibir y reenviar un mensaje
    socket.on('send-message', (data) => {
        if (!currentRoom || !username) return;

        const room = rooms[currentRoom];
        if (!room) return;

        const message = {
            username: username,
            text: data.text,
            time: Date.now()
        };

        room.messages.push(message);
        io.to(currentRoom).emit('message', message);
    });

    // Salir de la sala
    socket.on('leave-room', () => {
        if (currentRoom && username) {
            const room = rooms[currentRoom];
            if (room) {
                room.users = room.users.filter(u => u !== username);
                socket.to(currentRoom).emit('user-left', {
                    username: username,
                    text: `${username} ha abandonado la sala`
                });

                // Si la sala queda vacía, se elimina
                if (room.users.length === 0) {
                    delete rooms[currentRoom];
                    console.log(`Sala ${currentRoom} eliminada`);
                }
            }
            socket.leave(currentRoom);
            currentRoom = null;
            username = null;
        }
    });

    // Manejar desconexión
    socket.on('disconnect', () => {
        if (currentRoom && username) {
            const room = rooms[currentRoom];
            if (room) {
                room.users = room.users.filter(u => u !== username);
                if (room.users.length === 0) {
                    delete rooms[currentRoom];
                }
            }
        }
        console.log('Usuario desconectado:', socket.id);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log('Comparte este enlace con tus amigos');
});