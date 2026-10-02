// Almacén del token de sesión. Se guarda en sessionStorage para que
// se borre al cerrar la pestaña, y nunca se exponga en el HTML.
let authToken = sessionStorage.getItem('pm_token') || null;
let socket = null;

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

// Escapa caracteres peligrosos para evitar inyección de HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Crea la conexión de Socket.IO enviando el token en el handshake
function connectSocket() {
    if (socket) {
        socket.disconnect();
    }
    socket = io({
        auth: { token: authToken }
    });

    socket.on('connect', () => {
        console.log('Conectado al servidor');
    });

    socket.on('connect_error', (error) => {
        console.error('Error de conexión:', error.message);
        showError('No se pudo conectar: ' + error.message);
        // Si el token ya no es válido, forzamos regreso al inicio
        if (error.message.includes('Token')) {
            logoutLocal();
        }
    });

    // Mensaje nuevo
    socket.on('message', (data) => {
        const div = document.createElement('div');
        div.classList.add('message');
        if (data.username === currentUser) div.classList.add('own');
        const time = new Date(data.time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        div.innerHTML = `<div class="username">${escapeHtml(data.username)}</div><div class="text">${escapeHtml(data.text)}</div><div class="time">${time}</div>`;
        messagesContainer.appendChild(div);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });

    // Notificación de entrada
    socket.on('user-joined', (data) => {
        const div = document.createElement('div');
        div.classList.add('message');
        div.innerHTML = `<div class="username">Sistema</div><div class="text">${escapeHtml(data.text)}</div>`;
        messagesContainer.appendChild(div);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });

    // Notificación de salida
    socket.on('user-left', (data) => {
        const div = document.createElement('div');
        div.classList.add('message');
        div.innerHTML = `<div class="username">Sistema</div><div class="text">${escapeHtml(data.text)}</div>`;
        messagesContainer.appendChild(div);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

// Al cargar, si ya hay un token guardado, intentamos reconectar
if (authToken) {
    connectSocket();
}

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

    fetch('/api/create-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: name, username: user })
    })
    .then(res => res.json())
    .then(res => {
        createRoomBtn.textContent = 'Crear Sala';
        createRoomBtn.disabled = false;

        if (res.success) {
            authToken = res.token;
            sessionStorage.setItem('pm_token', authToken);
            currentUser = res.username;
            currentRoom = res.roomName;
            currentRoomCode = res.roomCode;

            connectSocket();

            homeScreen.style.display = 'none';
            chatScreen.style.display = 'flex';
            roomDisplay.textContent = currentRoom;
            roomCodeDisplay.textContent = `Código: ${currentRoomCode}`;
            userDisplay.textContent = currentUser;

            const div = document.createElement('div');
            div.classList.add('message');
            div.innerHTML = `<div class="username">Sistema</div><div class="text">Sala "${escapeHtml(currentRoom)}" creada. Código: ${currentRoomCode}</div>`;
            messagesContainer.appendChild(div);

            showSuccess('Sala creada correctamente');
        } else {
            showError(res.error || 'Error al crear la sala');
        }
    })
    .catch(() => {
        createRoomBtn.textContent = 'Crear Sala';
        createRoomBtn.disabled = false;
        showError('Error de red al crear la sala');
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

    fetch('/api/join-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: code, username: user })
    })
    .then(res => res.json())
    .then(res => {
        joinRoomBtn.textContent = 'Unirse';
        joinRoomBtn.disabled = false;

        if (res.success) {
            authToken = res.token;
            sessionStorage.setItem('pm_token', authToken);
            currentUser = res.username;
            currentRoom = res.roomName;
            currentRoomCode = code;

            connectSocket();
            messagesContainer.innerHTML = '';

            if (res.messages) {
                res.messages.forEach(msg => {
                    const div = document.createElement('div');
                    div.classList.add('message');
                    if (msg.username === currentUser) div.classList.add('own');
                    const time = new Date(msg.time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                    div.innerHTML = `<div class="username">${escapeHtml(msg.username)}</div><div class="text">${escapeHtml(msg.text)}</div><div class="time">${time}</div>`;
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
            showError(res.error || 'Error al unirse');
        }
    })
    .catch(() => {
        joinRoomBtn.textContent = 'Unirse';
        joinRoomBtn.disabled = false;
        showError('Error de red al unirse');
    });
};

// Enviar un mensaje
sendBtn.onclick = () => {
    const text = messageInput.value.trim();
    if (!text || !socket) return;
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
    if (socket) {
        socket.emit('leave-room');
        socket.disconnect();
        socket = null;
    }
    logoutLocal();
};

// Limpia el estado local sin tocar el servidor
function logoutLocal() {
    sessionStorage.removeItem('pm_token');
    authToken = null;
    messagesContainer.innerHTML = '';
    chatScreen.style.display = 'none';
    homeScreen.style.display = 'flex';
    currentUser = null;
    currentRoom = null;
    currentRoomCode = null;
}

// Atajos de teclado
createRoomName.onkeypress = (e) => { if (e.key === 'Enter') createRoomBtn.click(); };
createUsername.onkeypress = (e) => { if (e.key === 'Enter') createRoomBtn.click(); };
joinRoomCode.onkeypress = (e) => { if (e.key === 'Enter') joinRoomBtn.click(); };
joinUsername.onkeypress = (e) => { if (e.key === 'Enter') joinRoomBtn.click(); };

// Convertir código a mayúsculas
joinRoomCode.oninput = function() {
    this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
};

// Funciones para mensajes de estado
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