package main

import (
	"encoding/json"
	"time"
)

type Event struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type EventHandler func(event Event, client *Client) error

const (
	EventSendMessage    = "send_message"
	EventReceiveMessage = "receive_message"
	EventChangeChatRoom = "change_chat_room"

	EventSignalOffer     = "offer"
	EventSignalCandidate = "candidate"
	EventSignalAnswer    = "answer"
)

type SendMessageEvent struct {
	Message string `json:"message"`
	From    string `json:"from"`
}

type ReceiveMessageEvent struct {
	SendMessageEvent
	Sent time.Time `json:"sent"`
}

type ChangeChatRoomEvent struct {
	Name string `json:"name"`
}
