const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        // Si separas el frontend, cambia esto por tu dominio real
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST']
    }
});

// Clave secreta para firmar tokens. En producción define JWT_SECRET
// en las variables de entorno de Render. Si no, se genera una aleatoria
// al arrancar (los tokens se invalidan al reiniciar el servicio, lo
// cual es aceptable porque los datos también se pierden al reiniciar).
const JWT_SECRET = process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex');
const TOKEN_TTL = '2h';

// Middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.static('./'));

// Rate limit para las rutas de API: máximo 20 peticiones por minuto por IP
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Demasiadas peticiones, espera un momento' }
});

// Base de datos en memoria
const rooms = {};

// Genera un código de sala de 6 caracteres
function generateRoomCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
}

// Sanitiza texto: elimina etiquetas y limita longitud
function sanitize(text, maxLen) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/[<>]/g, '')
        .trim()
        .slice(0, maxLen);
}

// Crea un token firmado para un usuario y sala concreta
function createToken(username, roomCode) {
    return jwt.sign(
        { username, roomCode },
        JWT_SECRET,
        { expiresIn: TOKEN_TTL }
    );
}

// Middleware de autenticación para Socket.IO
io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Token requerido'));
    }
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        socket.user = payload;
        next();
    } catch (err) {
        next(new Error('Token inválido o expirado'));
    }
});

// API: crear sala
app.post('/api/create-room', apiLimiter, (req, res) => {
    const roomName = sanitize(req.body.roomName, 30);
    const username = sanitize(req.body.username, 15);

    if (!roomName || !username) {
        return res.json({ success: false, error: 'Faltan datos' });
    }

    let roomCode;
    do {
        roomCode = generateRoomCode();
    } while (rooms[roomCode]);

    rooms[roomCode] = {
        name: roomName,
        creator: username,
        users: new Set(),
        messages: []
    };

    const token = createToken(username, roomCode);
    console.log(`Sala creada: ${roomCode} - ${roomName}`);

    res.json({
        success: true,
        token,
        roomCode,
        roomName,
        username
    });
});

// API: unirse a sala
app.post('/api/join-room', apiLimiter, (req, res) => {
    const roomCode = sanitize(req.body.roomCode, 6).toUpperCase();
    const username = sanitize(req.body.username, 15);

    if (!roomCode || !username) {
        return res.json({ success: false, error: 'Faltan datos' });
    }

    const room = rooms[roomCode];
    if (!room) {
        return res.json({ success: false, error: 'Sala no encontrada' });
    }

    const token = createToken(username, roomCode);

    res.json({
        success: true,
        token,
        roomName: room.name,
        username,
        messages: room.messages
    });
});

// Conexión Socket.IO ya autenticada
io.on('connection', (socket) => {
    const { username, roomCode } = socket.user;
    console.log(`Usuario conectado: ${username} en ${roomCode}`);

    const room = rooms[roomCode];
    if (!room) {
        socket.emit('connect_error', new Error('La sala ya no existe'));
        socket.disconnect(true);
        return;
    }

    // Unir al socket a la sala y registrar al usuario
    socket.join(roomCode);
    room.users.add(username);

    // Avisar a los demás
    socket.to(roomCode).emit('user-joined', {
        username,
        text: `${username} se ha unido a la sala`
    });

    // Recibir mensaje
    socket.on('send-message', (data) => {
        const text = sanitize(data && data.text, 1000);
        if (!text) return;

        // Revalidamos que la sala siga existiendo
        const currentRoom = rooms[roomCode];
        if (!currentRoom) return;

        const message = {
            username,
            text,
            time: Date.now()
        };

        currentRoom.messages.push(message);
        // Limitar el historial a 200 mensajes por sala
        if (currentRoom.messages.length > 200) {
            currentRoom.messages.shift();
        }

        io.to(roomCode).emit('message', message);
    });

    // Salir de la sala
    socket.on('leave-room', () => {
        handleLeave(socket, username, roomCode);
    });

    // Desconexión
    socket.on('disconnect', () => {
        console.log(`Usuario desconectado: ${username}`);
        handleLeave(socket, username, roomCode, true);
    });
});

// Lógica compartida de salida
function handleLeave(socket, username, roomCode, isDisconnect = false) {
    const room = rooms[roomCode];
    if (!room) return;

    room.users.delete(username);

    if (!isDisconnect) {
        socket.to(roomCode).emit('user-left', {
            username,
            text: `${username} ha abandonado la sala`
        });
        socket.leave(roomCode);
    }

    // Si ya no queda nadie, eliminar la sala para no acumular datos
    if (room.users.size === 0) {
        delete rooms[roomCode];
        console.log(`Sala ${roomCode} eliminada`);
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
    console.log('Configura JWT_SECRET en producción para que los tokens persistan entre reinicios');
});