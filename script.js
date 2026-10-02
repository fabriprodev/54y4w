/// Conexión con el servidor de Socket.IO
const socket = io();

console.log('PlainMessage cargado');

socket.on('connect', () => {
    console.log('Conectado al servidor');
});

socket.on('connect_error', (error) => {
    console.error('Error de conexión:', error);
});

// Referencias a los elementos del DOM
const homeScreen = document.getElementById('home-screen');
const chatScreen = document.getElementById('chat-screen');
const createRoomName = document.getElementById('create-room-name');
const createUsername = document.getElementById('create-username');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomCode = document.getElementById('join-room-code');
const joinUsername = document.getElementById('join-username');
const joinRoomBtn = document.getElementById('join-room-btn');
const roomDisplay = document.getElementById('room-display');
const roomCodeDisplay = document.getElementById('room-code-display');
const userDisplay = document.getElementById('user-display');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const leaveBtn = document.getElementById('leave-btn');
const errorMessage = document.getElementById('error-message');

// Variables de estado
let currentUser = null;
let currentRoom = null;
let currentRoomCode = null;

// Escucha cuando llega un mensaje nuevo
socket.on('message', (data) => {
    const div = document.createElement('div');
    div.classList.add('message');
    if (data.username === currentUser) div.classList.add('own');
    const time = new Date(data.time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `<div class="username">${data.username}</div><div class="text">${data.text}</div><div class="time">${time}</div>`;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

// Notificación cuando alguien entra a la sala
socket.on('user-joined', (data) => {
    const div = document.createElement('div');
    div.classList.add('message');
    div.innerHTML = `<div class="username">Sistema</div><div class="text">${data.text}</div>`;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

// Notificación cuando alguien sale de la sala
socket.on('user-left', (data) => {
    const div = document.createElement('div');
    div.classList.add('message');
    div.innerHTML = `<div class="username">Sistema</div><div class="text">${data.text}</div>`;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

// Crear una sala nueva
createRoomBtn.onclick = () => {
    const name = createRoomName.value.trim();
    const user = createUsername.value.trim();
    
    if (!name || !user) {
        showError('Completa todos los campos');
        return;
    }
    
    createRoomBtn.textContent = 'Creando...';
    createRoomBtn.disabled = true;
    
    socket.emit('create-room', { roomName: name, username: user }, (res) => {
        createRoomBtn.textContent = 'Crear Sala';
        createRoomBtn.disabled = false;
        
        if (res.success) {
            currentUser = user;
            currentRoom = res.roomName;
            currentRoomCode = res.roomCode;
            
            homeScreen.style.display = 'none';
            chatScreen.style.display = 'flex';
            roomDisplay.textContent = currentRoom;
            roomCodeDisplay.textContent = `Código: ${currentRoomCode}`;
            userDisplay.textContent = currentUser;
            
            const div = document.createElement('div');
            div.classList.add('message');
            div.innerHTML = `<div class="username">Sistema</div><div class="text">Sala "${currentRoom}" creada. Código: ${currentRoomCode}</div>`;
            messagesContainer.appendChild(div);
            
            showSuccess('Sala creada correctamente');
        } else {
            showError(res.error);
        }
    });
};

// Unirse a una sala existente
joinRoomBtn.onclick = () => {
    const code = joinRoomCode.value.trim().toUpperCase();
    const user = joinUsername.value.trim();
    
    if (!code || !user) {
        showError('Completa todos los campos');
        return;
    }
    
    joinRoomBtn.textContent = 'Uniéndose...';
    joinRoomBtn.disabled = true;
    
    socket.emit('join-room', { roomCode: code, username: user }, (res) => {
        joinRoomBtn.textContent = 'Unirse';
        joinRoomBtn.disabled = false;
        
        if (res.success) {
            currentUser = user;
            currentRoom = res.roomName;
            currentRoomCode = code;
            
            messagesContainer.innerHTML = '';
            
            // Mostrar el historial de mensajes de la sala
            if (res.messages) {
                res.messages.forEach(msg => {
                    const div = document.createElement('div');
                    div.classList.add('message');
                    if (msg.username === currentUser) div.classList.add('own');
                    const time = new Date(msg.time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                    div.innerHTML = `<div class="username">${msg.username}</div><div class="text">${msg.text}</div><div class="time">${time}</div>`;
                    messagesContainer.appendChild(div);
                });
            }
            
            homeScreen.style.display = 'none';
            chatScreen.style.display = 'flex';
            roomDisplay.textContent = currentRoom;
            roomCodeDisplay.textContent = `Código: ${currentRoomCode}`;
            userDisplay.textContent = currentUser;
            
            showSuccess('Te has unido a la sala');
        } else {
            showError(res.error);
        }
    });
};

// Enviar un mensaje
sendBtn.onclick = () => {
    const text = messageInput.value.trim();
    if (!text) return;
    socket.emit('send-message', { text });
    messageInput.value = '';
    messageInput.focus();
};

// Enviar con Enter
messageInput.onkeypress = (e) => {
    if (e.key === 'Enter') sendBtn.click();
};

// Salir de la sala
leaveBtn.onclick = () => {
    socket.emit('leave-room');
    messagesContainer.innerHTML = '';
    chatScreen.style.display = 'none';
    homeScreen.style.display = 'flex';
    currentUser = null;
    currentRoom = null;
    currentRoomCode = null;
};

// Atajos de teclado para los formularios
createRoomName.onkeypress = (e) => { if (e.key === 'Enter') createRoomBtn.click(); };
createUsername.onkeypress = (e) => { if (e.key === 'Enter') createRoomBtn.click(); };
joinRoomCode.onkeypress = (e) => { if (e.key === 'Enter') joinRoomBtn.click(); };
joinUsername.onkeypress = (e) => { if (e.key === 'Enter') joinRoomBtn.click(); };

// Convertir el código a mayúsculas automáticamente
joinRoomCode.oninput = function() {
    this.value = this.value.toUpperCase();
};

// Funciones para mostrar mensajes de estado
function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.style.color = 'var(--error)';
    errorMessage.style.background = 'var(--surface-variant)';
    errorMessage.style.display = 'block';
    errorMessage.style.padding = '8px 16px';
    errorMessage.style.borderRadius = '12px';
    setTimeout(() => {
        errorMessage.textContent = '';
        errorMessage.style.display = 'none';
    }, 5000);
}

function showSuccess(msg) {
    errorMessage.textContent = msg;
    errorMessage.style.color = 'var(--success)';
    errorMessage.style.background = 'var(--surface-variant)';
    errorMessage.style.display = 'block';
    errorMessage.style.padding = '8px 16px';
    errorMessage.style.borderRadius = '12px';
    setTimeout(() => {
        errorMessage.textContent = '';
        errorMessage.style.display = 'none';
    }, 3000);
}

console.log('PlainMessage listo');