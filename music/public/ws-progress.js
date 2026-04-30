/**
 * WebSocket Progress Helper for Voice Remover Pro
 * 
 * Usage:
 *   const ws = createProgressWebSocket();
 *   ws.subscribe(jobId);
 *   ws.on('progress', (data) => updateProgressBar(data.percent, data.message));
 *   ws.on('complete', (data) => showCompletion(data));
 *   ws.on('error', (data) => showError(data.message));
 */

function createProgressWebSocket() {
    const port = window.location.port || 8000;
    const wsUrl = `${window.location.protocol}//${window.location.hostname}:${port}`;
    
    const socket = io(wsUrl);
    const listeners = {};
    let currentJobId = null;

    // Обработка входящих событий
    socket.on('job:update', (data) => {
        const { event, ...payload } = data;
        
        // Emit generic event
        emitToListeners('any', { event, ...payload });
        
        // Emit specific event
        if (listeners[event]) {
            emitToListeners(event, payload);
        }
        
        // Handle lifecycle events
        if (event === 'complete' || event === 'error') {
            // Show premium features if job completed successfully
            if (event === 'complete' && window.showPremiumFeatures) {
                window.showPremiumFeatures();
            }
            setTimeout(() => {
                if (currentJobId === data.jobId) {
                    socket.emit('unsubscribe', currentJobId);
                    currentJobId = null;
                }
            }, 2000);
        }
    });

    socket.on('job:status', (data) => {
        emitToListeners('status', data);
    });

    socket.on('connect', () => {
        console.log('[WS] Connected to server');
        emitToListeners('connect', { id: socket.id });
    });

    socket.on('disconnect', () => {
        console.log('[WS] Disconnected from server');
        emitToListeners('disconnect', {});
    });

    socket.on('connect_error', (error) => {
        console.error('[WS] Connection error:', error.message);
        emitToListeners('error', { message: 'WebSocket connection failed', error: error.message });
    });

    /**
     * Подписаться на обновления задачи
     */
        function subscribe(jobId) {
            window.currentJobId = jobId; // Expose to other scripts
            currentJobId = jobId;
            socket.emit('subscribe', jobId);
            console.log(`[WS] Subscribed to job: ${jobId}`);
        }

    /**
     * Отписаться от задачи
     */
    function unsubscribe() {
        if (currentJobId) {
            socket.emit('unsubscribe', currentJobId);
            currentJobId = null;
        }
    }

    /**
     * Подписаться на событие
     */
    function on(event, callback) {
        if (!listeners[event]) {
            listeners[event] = [];
        }
        listeners[event].push(callback);
        return () => {
            listeners[event] = listeners[event].filter(cb => cb !== callback);
        };
    }

    /**
     * Отписаться от всех обработчиков события
     */
    function off(event) {
        delete listeners[event];
    }

    /**
     * Отправить всем обработчикам
     */
    function emitToListeners(event, data) {
        if (listeners[event]) {
            listeners[event].forEach(cb => {
                try {
                    cb(data);
                } catch (err) {
                    console.error(`[WS] Listener error (${event}):`, err);
                }
            });
        }
    }

    /**
     * Разорвать соединение
     */
    function disconnect() {
        unsubscribe();
        socket.disconnect();
    }

    return {
        subscribe,
        unsubscribe,
        on,
        off,
        disconnect,
        socket
    };
}
