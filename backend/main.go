package main

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

const (
	MessageTypeOffer     = "offer"
	MessageTypeCandidate = "candidate"
	MessageTypeAnswer    = "answer"
)

var upgrader = websocket.Upgrader{
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

func main() {
	http.HandleFunc("/ws", handleWebsocket)

	log.Println("Server is running on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
