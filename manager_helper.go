package main

import (
	"encoding/json"
	"fmt"
)

func SendMessageHandler(event Event, client *Client) error {
	// TODO: implement
	return nil
}

func ChangeChatRoomHandler(event Event, client *Client) error {
	var changeChatRoomEvent ChangeChatRoomEvent

	if err := json.Unmarshal(event.Payload, &changeChatRoomEvent); err != nil {
		return fmt.Errorf("bad payload in request: %v", err)
	}

	client.chatroom = changeChatRoomEvent.Name
	return nil
}

func parseJSON(data interface{}, target interface{}) error {
	// Convert data directly to JSON bytes
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	// Unmarshal JSON bytes into the target interface
	return json.Unmarshal(jsonData, target)
}
