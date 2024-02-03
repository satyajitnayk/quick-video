package main

import (
	"errors"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var websocketUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Check the origin header and allow connections from trusted origins
		allowedOrigins := map[string]bool{
			"http://127.0.0.1:5500": true,
		}
		origin := r.Header.Get("Origin")
		return allowedOrigins[origin]
	},
}

type Manager struct {
	clients ClientList
	sync.RWMutex
	handlers map[string]EventHandler
}

func NewManager() *Manager {
	m := &Manager{
		clients:  make(ClientList),
		handlers: make(map[string]EventHandler),
	}

	m.setupEventHandlers()
	return m
}

func (m *Manager) setupEventHandlers() {
	m.handlers[EventSendMessage] = SendMessageHandler
	// m.handlers[EventReceiveMessage] =
	m.handlers[EventChangeChatRoom] = ChangeChatRoomHandler
}

func (m *Manager) routeEvent(event Event, client *Client) error {
	if handler, ok := m.handlers[event.Type]; ok {
		if err := handler(event, client); err != nil {
			return err
		}
		return nil
	} else {
		return errors.New("there is no such event type " + event.Type + "\n" + string(event.Payload))
	}
}

func (m *Manager) addClient(client *Client) {
	m.Lock()
	defer m.Unlock()

	m.clients[client] = true
}

func (m *Manager) removeClient(client *Client) {
	m.Lock()
	defer m.Unlock()

	if _, ok := m.clients[client]; ok {
		client.connection.Close()
		delete(m.clients, client)
	}
}

func (m *Manager) serveWebSocket(w http.ResponseWriter, r *http.Request) {
	// Upgrade HTTP connection to WebSocket
	conn, err := websocketUpgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Failed to upgrade to websocket: ", err)
		return
	}

	// Read room ID from URL query parameter
	roomID := r.URL.Query().Get("roomID")
	if roomID == "" {
		http.Error(w, "Room ID is required", http.StatusBadRequest)
		return
	}

	client := NewClient(conn, m)
	client.setupWebRTC()

	m.addClient(client)

	go client.readMessages()
	go client.writeMessages()
}
