package main

import (
	"log"
	"net/http"
)

func main() {

	manager := NewManager()

	http.HandleFunc("/ws", manager.serveWebSocket)

	log.Println("Server is running on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
