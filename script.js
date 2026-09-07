// --- CHAT ANÓNIMO CON RENDER ---

// Conexión al servidor (se conecta automáticamente a la URL de Render)
const socket = io();

console.log('🚀 Script cargado');

// Verificar conexión
socket.on('connect', () => {
    console.log('✅ Conectado al servidor');
});

socket.on('connect_error', (error) => {
    console.error('❌ Error de conexión:', error);
    alert('Error de conexión al servidor. Revisa la consola (F12)');
});

// --- ELEMENTOS DEL DOM ---
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

// --- ESTADO ---
let currentUser = null;
let currentRoom = null;
let currentRoomCode = null;

// --- RECIBIR MENSAJES ---
socket.on('message', (data) => {
    console.log('📨 Mensaje recibido:', data);
    const div = document.createElement('div');
    div.classList.add('message');
    if (data.username === currentUser) div.classList.add('own');
    const time = new Date(data.time).toLocaleTimeString();
    div.innerHTML = `<div class="username">${data.username}</div><div class="text">${data.text}</div><div class="time">${time}</div>`;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

socket.on('user-joined', (data) => {
    console.log('👋 Alguien se unió:', data);
    const div = document.createElement('div');
    div.classList.add('message');
    div.innerHTML = `<div class="username">Sistema</div><div class="text">${data.text}</div>`;
    messagesContainer.appendChild(div);
});

socket.on('user-left', (data) => {
    console.log('👋 Alguien se fue:', data);
    const div = document.createElement('div');
    div.classList.add('message');
    div.innerHTML = `<div class="username">Sistema</div><div class="text">${data.text}</div>`;
    messagesContainer.appendChild(div);
});

// --- CREAR SALA ---
createRoomBtn.onclick = () => {
    console.log('🔵 Botón Crear Sala presionado');
    const name = createRoomName.value.trim();
    const user = createUsername.value.trim();
    
    if (!name || !user) {
        errorMessage.textContent = '⚠️ Completa todos los campos';
        console.log('❌ Faltan campos');
        return;
    }
    
    errorMessage.textContent = '';
    createRoomBtn.textContent = 'Creando...';
    createRoomBtn.disabled = true;
    
    console.log('📤 Enviando create-room:', { roomName: name, username: user });
    
    socket.emit('create-room', { roomName: name, username: user }, (res) => {
        createRoomBtn.textContent = 'Crear Sala';
        createRoomBtn.disabled = false;
        
        console.log('📥 Respuesta create-room:', res);
        
        if (res.success) {
            currentUser = user;
            currentRoom = res.roomName;
            currentRoomCode = res.roomCode;
            
            homeScreen.style.display = 'none';
            chatScreen.style.display = 'flex';
            roomDisplay.textContent = `📚 ${currentRoom}`;
            roomCodeDisplay.textContent = `🔑 Código: ${currentRoomCode}`;
            userDisplay.textContent = `👤 ${currentUser}`;
            
            const div = document.createElement('div');
            div.classList.add('message');
            div.innerHTML = `<div class="username">Sistema</div><div class="text">🏠 Sala "${currentRoom}" creada. Código: ${currentRoomCode}</div>`;
            messagesContainer.appendChild(div);
            
            console.log('✅ Sala creada exitosamente');
        } else {
            errorMessage.textContent = '❌ ' + res.error;
            console.error('❌ Error al crear sala:', res.error);
        }
    });
};

// --- UNIRSE A SALA ---
joinRoomBtn.onclick = () => {
    console.log('🔵 Botón Unirse presionado');
    const code = joinRoomCode.value.trim().toUpperCase();
    const user = joinUsername.value.trim();
    
    if (!code || !user) {
        errorMessage.textContent = '⚠️ Completa todos los campos';
        console.log('❌ Faltan campos');
        return;
    }
    
    errorMessage.textContent = '';
    joinRoomBtn.textContent = 'Uniéndose...';
    joinRoomBtn.disabled = true;
    
    console.log('📤 Enviando join-room:', { roomCode: code, username: user });
    
    socket.emit('join-room', { roomCode: code, username: user }, (res) => {
        joinRoomBtn.textContent = 'Unirse';
        joinRoomBtn.disabled = false;
        
        console.log('📥 Respuesta join-room:', res);
        
        if (res.success) {
            currentUser = user;
            currentRoom = res.roomName;
            currentRoomCode = code;
            
            messagesContainer.innerHTML = '';
            
            if (res.messages) {
                res.messages.forEach(msg => {
                    const div = document.createElement('div');
                    div.classList.add('message');
                    if (msg.username === currentUser) div.classList.add('own');
                    const time = new Date(msg.time).toLocaleTimeString();
                    div.innerHTML = `<div class="username">${msg.username}</div><div class="text">${msg.text}</div><div class="time">${time}</div>`;
                    messagesContainer.appendChild(div);
                });
            }
            
            homeScreen.style.display = 'none';
            chatScreen.style.display = 'flex';
            roomDisplay.textContent = `📚 ${currentRoom}`;
            roomCodeDisplay.textContent = `🔑 Código: ${currentRoomCode}`;
            userDisplay.textContent = `👤 ${currentUser}`;
            
            console.log('✅ Unido a sala exitosamente');
        } else {
            errorMessage.textContent = '❌ ' + res.error;
            console.error('❌ Error al unirse:', res.error);
        }
    });
};

// --- ENVIAR MENSAJE ---
sendBtn.onclick = () => {
    const text = messageInput.value.trim();
    if (!text) return;
    console.log('📤 Enviando mensaje:', text);
    socket.emit('send-message', { text });
    messageInput.value = '';
};

messageInput.onkeypress = (e) => {
    if (e.key === 'Enter') sendBtn.click();
};

// --- SALIR ---
leaveBtn.onclick = () => {
    console.log('🚪 Saliendo de la sala');
    socket.emit('leave-room');
    messagesContainer.innerHTML = '';
    chatScreen.style.display = 'none';
    homeScreen.style.display = 'flex';
    currentUser = null;
    currentRoom = null;
    currentRoomCode = null;
};

// --- ENTER PARA CREAR ---
createRoomName.onkeypress = (e) => { if (e.key === 'Enter') createRoomBtn.click(); };
createUsername.onkeypress = (e) => { if (e.key === 'Enter') createRoomBtn.click(); };
joinRoomCode.onkeypress = (e) => { if (e.key === 'Enter') joinRoomBtn.click(); };
joinUsername.onkeypress = (e) => { if (e.key === 'Enter') joinRoomBtn.click(); };

// --- CONVERTIR CÓDIGO A MAYÚSCULAS ---
joinRoomCode.oninput = function() {
    this.value = this.value.toUpperCase();
};

console.log('✅ Chat cargado correctamente');
console.log('🔗 URL actual:', window.location.href);