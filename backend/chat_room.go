package main

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

// Room represents a video call room
type Room struct {
	ID      string
	clients map[*websocket.Conn]bool
	mutex   sync.Mutex
}

// NewRoom creates a new video call room
func NewRoom(roomID string) *Room {
	return &Room{
		ID:      roomID,
		clients: make(map[*websocket.Conn]bool),
	}
}

// AddClient adds a client to the room
func (r *Room) AddClient(client *websocket.Conn) {
	r.mutex.Lock()
	defer r.mutex.Unlock()
	r.clients[client] = true
}

// RemoveClient removes a client from the room
func (r *Room) RemoveClient(client *websocket.Conn) {
	r.mutex.Lock()
	defer r.mutex.Unlock()
	if r.clients[client] {
		delete(r.clients, client)
	}
}

// Broadcast sends a message to all clients in the room
func (r *Room) Broadcast(message map[string]interface{}) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	// Serialize the message map to JSON
	jsonMessage, err := json.Marshal(message)
	if err != nil {
		log.Println("Error serializing message to JSON:", err)
		return
	}

	for client := range r.clients {
		err := client.WriteMessage(websocket.TextMessage, jsonMessage)
		if err != nil {
			log.Println("Error broadcasting message:", err)
		}
	}
}

// Global room map
var rooms = make(map[string]*Room)
var roomMutex sync.Mutex

// GetOrCreateRoom returns an existing room or creates a new one
func GetOrCreateRoom(roomID string) *Room {
	roomMutex.Lock()
	defer roomMutex.Unlock()
	if _, ok := rooms[roomID]; !ok {
		rooms[roomID] = NewRoom(roomID)
	}
	return rooms[roomID]
}
